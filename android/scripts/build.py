#!/usr/bin/env python3
"""Use existing offline Android tooling; never install or upload anything."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

project = Path(__file__).resolve().parents[1]
user = Path.home()
sdk = Path(os.environ.get("ANDROID_HOME", user / "Library/Android/sdk"))
gradles = sorted((user / ".gradle/wrapper/dists/gradle-8.14.3-bin").glob("*/gradle-8.14.3/bin/gradle"))
jdks = sorted((user / ".gradle/jdks").glob("*17*/jdk-*/Contents/Home"))
if not gradles or not jdks or not (sdk / "platforms/android-36/android.jar").is_file():
    sys.exit("HOLD: cached Gradle 8.14.3/JDK17/Android SDK36 is missing; no download was attempted.")
env = os.environ.copy()
env.update(JAVA_HOME=str(jdks[0]), ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
output = project / ".build"
output.mkdir(exist_ok=True)
log = output / "gradle.log"
command = [str(gradles[0]), "--offline", "--no-daemon", "--max-workers=1", "--console=plain", "--stacktrace",
           "-Dorg.gradle.java.home=" + str(jdks[0]), ":app:assembleDebug", ":app:bundleRelease", ":app:lintDebug"]
with log.open("w") as stream:
    result = subprocess.run(command, cwd=project, env=env, stdout=stream, stderr=subprocess.STDOUT)
print(f"Offline Android build exit={result.returncode}; log={log}")
if result.returncode:
    lines = log.read_text(errors="replace").splitlines()
    section = next((index for index, line in enumerate(lines) if line == "* What went wrong:"), 0)
    print("\n".join(lines[section:section + 35]))
    sys.exit(result.returncode)
artifacts = {}
for name, path in {"debug_apk": project / "app/build/outputs/apk/debug/app-debug.apk",
                   "unsigned_release_aab": project / "app/build/outputs/bundle/release/app-release.aab"}.items():
    if not path.is_file():
        sys.exit("HOLD: expected output missing: " + str(path))
    artifacts[name] = {"path": str(path), "bytes": path.stat().st_size,
                       "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
sources = {str(path.relative_to(project)): hashlib.sha256(path.read_bytes()).hexdigest()
           for path in sorted(project.rglob("*")) if path.is_file()
           and not any(part in ("build", ".build", ".gradle", "private", "__pycache__") for part in path.relative_to(project).parts)}
report = {"observed_at": datetime.now(timezone.utc).isoformat(), "status": "LOCAL_BUILD_ONLY",
          "package": "com.invitehub.weddingpreview", "version": "0.1.0", "version_code": 1,
          "compile_sdk": 36, "target_sdk": 36, "min_sdk": 26, "offline": True,
          "store_upload": False, "real_device_test": False, "release_signing": "UNSIGNED",
          "billing_enabled": False, "application_dependencies_added": 0, "lint_debug": "PASS",
          "artifacts": artifacts, "source_fingerprints": sources}
report_path = output / "candidate.json"
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print("APK and unsigned AAB built; evidence=" + str(report_path))
