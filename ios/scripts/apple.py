"""Task-local Apple API helper. Tokens stay in memory; no private material is logged."""
import base64
import datetime
import json
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

APP_ID = ""
OUT = pathlib.Path(__file__).resolve().parent
META = pathlib.Path("/Users/jyb-m3max/Desktop/codex/.private/apple-app-store-connect/metadata.json")


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def der_item(blob, offset):
    tag, size = blob[offset], blob[offset + 1]
    offset += 2
    if size & 128:
        count = size & 127
        size = int.from_bytes(blob[offset:offset + count], "big")
        offset += count
    return tag, blob[offset:offset + size], offset + size


def token():
    meta = json.loads(META.read_text())
    now = int(time.time())
    header = {"alg": "ES256", "kid": meta["key_id"], "typ": "JWT"}
    claims = {"iss": meta["issuer_id"], "iat": now - 10, "exp": now + 600, "aud": "appstoreconnect-v1"}
    signed = (b64(json.dumps(header, separators=(",", ":")).encode()) + "." +
              b64(json.dumps(claims, separators=(",", ":")).encode())).encode()
    result = subprocess.run(["openssl", "dgst", "-sha256", "-sign", meta["private_key_path"]],
                            input=signed, capture_output=True, check=True)
    tag, body, end = der_item(result.stdout, 0)
    assert tag == 48 and end == len(result.stdout)
    r_tag, r, pos = der_item(body, 0)
    s_tag, s, end = der_item(body, pos)
    assert r_tag == s_tag == 2 and end == len(body)
    signature = int.from_bytes(r, "big").to_bytes(32, "big") + int.from_bytes(s, "big").to_bytes(32, "big")
    return signed.decode() + "." + b64(signature)


def request(path, params=None, method="GET", data=None):
    assert path.startswith("/v1/") and ".." not in path
    url = "https://api.appstoreconnect.apple.com" + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"Authorization": "Bearer " + token(), "Content-Type": "application/json"}
    payload = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            raw = response.read()
            return {"status": response.status, "response": json.loads(raw) if raw else {}}
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        return {"status": exc.code, "response": json.loads(raw) if raw else {}}

