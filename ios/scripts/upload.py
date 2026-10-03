"""Upload this signed IPA with the existing Apple key; redact authentication metadata."""
import datetime
import hashlib
import json
import os
import pathlib
import plistlib
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
META = pathlib.Path('/Users/jyb-m3max/Desktop/codex/.private/apple-app-store-connect/metadata.json')
IPA = ROOT / 'ios/artifacts/export/WeddingInvitation.ipa'
meta = json.loads(META.read_text())
with zipfile.ZipFile(IPA) as archive:
    info = plistlib.loads(archive.read('Payload/WeddingInvitation.app/Info.plist'))
assert info['CFBundleIdentifier'] == 'com.invitehub.wedding-preview'
assert info['UIDeviceFamily'] == [1]
assert info['UISupportedInterfaceOrientations'] == ['UIInterfaceOrientationPortrait']
env = dict(os.environ)
env['API_PRIVATE_KEYS_DIR'] = meta['api_private_keys_dir']
command = ['xcrun', 'altool', '--upload-app', '-f', str(IPA),
           '--api-key', meta['key_id'], '--api-issuer', meta['issuer_id'],
           '--p8-file-path', meta['private_key_path']]
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
process = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
with (ROOT / 'ios/artifacts/upload.log').open('w') as log:
    for line in process.stdout:
        for value in meta.values():
            if isinstance(value, str) and value:
                line = line.replace(value, '[redacted]')
        log.write(line)
        log.flush()
code = process.wait()
receipt = {'appId': '6818721229', 'bundleId': 'com.invitehub.wedding-preview',
           'version': info['CFBundleShortVersionString'], 'buildNumber': info['CFBundleVersion'], 'startedAt': started,
           'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'exitCode': code, 'ipaSha256': hashlib.sha256(IPA.read_bytes()).hexdigest(),
           'processing': 'not_yet_verified', 'deviceInstallation': 'not_yet_verified'}
(ROOT / 'ios/artifacts/upload-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(code)
