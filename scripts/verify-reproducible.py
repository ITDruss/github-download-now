import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
TARGETS = [
    ROOT / f"github-download-now-chromium-v{VERSION}.zip",
    ROOT / f"github-download-now-firefox-v{VERSION}.zip",
]


def source_epoch() -> str:
    raw = os.environ.get("SOURCE_DATE_EPOCH", "").strip()
    if raw:
        int(raw)
        return raw
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "315532800"


def build(epoch: str) -> dict[str, str]:
    env = {**os.environ, "SOURCE_DATE_EPOCH": epoch}
    subprocess.run(["npm", "run", "package"], cwd=ROOT, env=env, check=True)
    return {target.name: hashlib.sha256(target.read_bytes()).hexdigest() for target in TARGETS}


epoch = source_epoch()
first = build(epoch)
second = build(epoch)
if first != second:
    raise SystemExit(f"Browser packages are not reproducible:\nfirst={first}\nsecond={second}")

print(f"Reproducible browser packages: OK (SOURCE_DATE_EPOCH={epoch})")
for name, digest in sorted(second.items()):
    print(f"{digest}  {name}")
