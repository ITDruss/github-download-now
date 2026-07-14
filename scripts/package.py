import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]


def source_date_epoch() -> int:
    raw = os.environ.get("SOURCE_DATE_EPOCH", "").strip()
    if raw:
        try:
            return max(315532800, int(raw))
        except ValueError as error:
            raise SystemExit("SOURCE_DATE_EPOCH must be an integer Unix timestamp") from error
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        return max(315532800, int(result.stdout.strip()))
    except (OSError, ValueError, subprocess.CalledProcessError):
        return 315532800


ZIP_TIME = datetime.fromtimestamp(source_date_epoch(), tz=timezone.utc).timetuple()[:6]


def add_file(archive: ZipFile, source: Path, name: str) -> None:
    info = ZipInfo(name, ZIP_TIME)
    info.compress_type = ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (0o644 & 0xFFFF) << 16
    archive.writestr(info, source.read_bytes())


for target in ("chromium", "firefox"):
    source = DIST / target
    if not source.is_dir():
        raise SystemExit(f"Missing build directory: {source}")
    versioned = ROOT / f"github-download-now-{target}-v{VERSION}.zip"
    alias = ROOT / f"github-download-now-{target}.zip"

    for output in (versioned, alias):
        if output.exists():
            output.unlink()

    with ZipFile(versioned, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                add_file(archive, path, path.relative_to(source).as_posix())

    shutil.copyfile(versioned, alias)
    print(f"Created {versioned.name} and {alias.name}")
