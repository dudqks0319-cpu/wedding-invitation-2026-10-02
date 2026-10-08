#!/usr/bin/env python3
import os
from pathlib import Path
import subprocess
import sys

project = Path(__file__).resolve().parents[1]
jdks = sorted((Path.home() / ".gradle/jdks").glob("*17*/jdk-*/Contents/Home"))
if not jdks:
    sys.exit("Existing JDK17 required; no installation attempted")
output = project / ".build/policy"
output.mkdir(parents=True, exist_ok=True)
sources = [project / "app/src/main/java/com/invitehub/weddingpreview/NativePolicy.java", project / "tests/NativePolicyTest.java"]
subprocess.run([str(jdks[0] / "bin/javac"), "--release", "17", "-d", str(output), *map(str, sources)], check=True)
subprocess.run([str(jdks[0] / "bin/java"), "-ea", "-cp", str(output), "com.invitehub.weddingpreview.NativePolicyTest"], check=True)
