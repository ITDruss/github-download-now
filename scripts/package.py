import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FIXED_TIME = (2026, 7, 13, 0, 0, 0)
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]


def add_file(archive: ZipFile, source: Path, name: str) -> None:
    info = ZipInfo(name, FIXED_TIME)
    info.compress_type = ZIP_DEFLATED
    info.external_attr = (0o644 & 0xFFFF) << 16
    archive.writestr(info, source.read_bytes())


for target in ("chromium", "firefox"):
    source = DIST / target
    versioned = ROOT / f"github-download-now-{target}-v{VERSION}.zip"
    alias = ROOT / f"github-download-now-{target}.zip"

    for output in (versioned, alias):
        if output.exists():
            output.unlink()

    with ZipFile(versioned, "w") as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                add_file(archive, path, path.relative_to(source).as_posix())

    shutil.copyfile(versioned, alias)
    print(f"Created {versioned.name} and {alias.name}")
