#!/usr/bin/env python3
"""Sign a locally proven unsigned AAB with an independent local upload key. Never upload."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import zipfile

project = Path(__file__).resolve().parents[1]
repo = project.parent
proof = repo / 'docs/evidence/store-release-20261007/android-candidate-local.json'
candidate = json.loads(proof.read_text())
if candidate['package'] != 'com.invitehub.weddingpreview' or candidate['release_signing'] != 'UNSIGNED':
    sys.exit('HOLD: unsigned app identity was not confirmed.')
original = Path(candidate['artifacts']['unsigned_release_aab']['path'])
if not original.is_file() or hashlib.sha256(original.read_bytes()).hexdigest() != candidate['artifacts']['unsigned_release_aab']['sha256']:
    sys.exit('HOLD: unsigned bundle no longer matches the recorded build.')
for name, digest in candidate['source_fingerprints'].items():
    if hashlib.sha256((project / name).read_bytes()).hexdigest() != digest:
        sys.exit('HOLD: recorded build input changed: ' + name)
jdks = sorted((Path.home() / '.gradle/jdks').glob('*17*/jdk-*/Contents/Home'))
if not jdks:
    sys.exit('HOLD: existing JDK17 is unavailable. No download attempted.')
private = project / 'private'
output = project / '.build/signed'
for folder in [private, output]:
    if folder.is_symlink():
        sys.exit('HOLD: signing directory is a symbolic link.')
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
private.chmod(0o700)
keystore, password_file = private / 'upload.p12', private / 'upload-password.txt'
certificate, identity = private / 'upload.cer', private / 'upload-key.json'
signed = output / 'wedding-invitation-0.1.0-1-upload.aab'
for file in [keystore, password_file, certificate, identity, signed]:
    if file.is_symlink():
        sys.exit('HOLD: signing file is a symbolic link.')
if keystore.exists() != password_file.exists():
    sys.exit('HOLD: incomplete existing key material. Nothing overwritten or regenerated.')
created = not keystore.exists()
if created:
    if certificate.exists() or identity.exists():
        sys.exit('HOLD: existing identity metadata without its key. Nothing regenerated.')
    with password_file.open('x') as stream:
        password_file.chmod(0o600)
        stream.write(secrets.token_urlsafe(48) + '\n')
else:
    if not identity.is_file() or not certificate.is_file():
        sys.exit('HOLD: existing key lacks its independent app identity proof.')
    key_identity = json.loads(identity.read_text())
    if key_identity.get('package') != candidate['package'] or key_identity.get('alias') != 'wedding-upload':
        sys.exit('HOLD: existing key belongs to an unconfirmed app identity.')
    if hashlib.sha256(certificate.read_bytes()).hexdigest() != key_identity.get('certificate_sha256'):
        sys.exit('HOLD: existing certificate changed. No key rotation attempted.')
    keystore.chmod(0o600)
    password_file.chmod(0o600)
password = password_file.read_text().strip()
if len(password) < 48:
    sys.exit('HOLD: insufficient local key password.')
alias = 'wedding-upload'
log = output / 'signing.log'
log.write_text('')

def run(tool, args, stage):
    command = [str(jdks[0] / 'bin' / tool), '-J-Xmx256m', *args]
    with log.open('a') as stream:
        stream.write(stage + '\n')
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
        stream.write(result.stdout.decode(errors='replace').replace(password, '[REDACTED]'))
    if result.returncode:
        sys.exit(f'HOLD: {stage} exit={result.returncode}; log={log}')

previous_umask = os.umask(0o077)
try:
    if created:
        run('keytool', ['-genkeypair', '-keystore', str(keystore), '-storetype', 'PKCS12',
                       '-storepass:file', str(password_file), '-keypass:file', str(password_file),
                       '-alias', alias, '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
                       '-dname', 'CN=WeddingInvitationUpload', '-noprompt'], 'create independent local upload key')
        keystore.chmod(0o600)
        run('keytool', ['-exportcert', '-keystore', str(keystore), '-storepass:file', str(password_file),
                       '-alias', alias, '-file', str(certificate)], 'export public certificate')
        key_identity = {'created_at': datetime.now(timezone.utc).isoformat(), 'package': candidate['package'],
                        'alias': alias, 'algorithm': 'RSA4096', 'store_type': 'PKCS12',
                        'certificate_sha256': hashlib.sha256(certificate.read_bytes()).hexdigest(),
                        'play_registered': False, 'key_uploaded': False}
        identity.write_text(json.dumps(key_identity, indent=2) + '\n')
    actual_certificate = output / 'current-upload.cer'
    run('keytool', ['-exportcert', '-keystore', str(keystore), '-storepass:file', str(password_file),
                   '-alias', alias, '-file', str(actual_certificate)], 'verify existing key certificate identity')
    if actual_certificate.read_bytes() != certificate.read_bytes():
        sys.exit('HOLD: keystore certificate differs from the recorded upload key. No signing attempted.')
    run('jarsigner', ['-keystore', str(keystore), '-storepass:file', str(password_file),
                     '-keypass:file', str(password_file), '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256',
                     '-signedjar', str(signed), str(original), alias], 'sign separate AAB')
    # Use the known local certificate as the trust anchor; no public CA or network/TSA request.
    run('jarsigner', ['-verify', '-strict', '-verbose', '-certs', '-keystore', str(keystore),
                     '-storepass:file', str(password_file), str(signed)], 'strict verification against local upload certificate')
finally:
    os.umask(previous_umask)
with zipfile.ZipFile(original) as before, zipfile.ZipFile(signed) as after:
    added = sorted(set(after.namelist()) - set(before.namelist()))
    if any(not name.startswith('META-INF/') for name in added):
        sys.exit('HOLD: signing added unexpected bundle payload.')
    if any(before.read(name) != after.read(name) for name in before.namelist()):
        sys.exit('HOLD: compiled bundle payload changed during signing.')
    signatures = [name for name in after.namelist() if name.startswith('META-INF/') and name.endswith(('.RSA', '.SF'))]
    if len(signatures) != 2:
        sys.exit('HOLD: unexpected signature structure.')
for file in [keystore, password_file, certificate, identity]:
    file.chmod(0o600)
checks = subprocess.run(['git', 'check-ignore', '--quiet', str(private / 'upload.p12')], cwd=repo)
if checks.returncode:
    sys.exit('HOLD: local private key is not excluded from Git.')
for p in [log, identity]:
    if password in p.read_text():
        sys.exit('HOLD: sensitive password appeared outside its private password file.')
report = {'observed_at': datetime.now(timezone.utc).isoformat(), 'status': 'LOCAL_UPLOAD_KEY_SIGNED_NOT_REGISTERED',
          'package': candidate['package'], 'version': '0.1.0', 'version_code': 1,
          'artifact': {'path': str(signed), 'bytes': signed.stat().st_size, 'sha256': hashlib.sha256(signed.read_bytes()).hexdigest()},
          'original_unsigned_sha256': candidate['artifacts']['unsigned_release_aab']['sha256'],
          'source_build_proof': str(proof), 'signed_bundle_payload_identical': True,
          'strict_signature_verification_exit': 0, 'signature_files': signatures,
          'certificate_sha256': hashlib.sha256(certificate.read_bytes()).hexdigest(),
          'key_alias': alias, 'key_created_in_this_run': created, 'key_material_git_ignored': True,
          'key_directory_mode': oct(private.stat().st_mode & 0o777),
          'keystore_mode': oct(keystore.stat().st_mode & 0o777), 'password_file_mode': oct(password_file.stat().st_mode & 0o777),
          'application_dependencies_added': 0, 'network_or_tsa_request': False,
          'google_play_app_or_key_registered': False, 'store_uploaded': False, 'runtime_verified': False,
          'billing_enabled': False, 'signer_script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(repo / 'docs/evidence/store-release-20261007/android-upload-signed.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'strict_verification_exit': 0, 'payload_unchanged': True,
                  'private_key_git_ignored': True, 'play_upload': False, 'artifact': str(signed)}))
