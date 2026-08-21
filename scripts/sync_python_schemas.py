#!/usr/bin/env python3
"""Keep the packaged Python Schema resources aligned with the public schemas."""

from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "schemas"
PACKAGE_DIR = ROOT / "src" / "slides_thief" / "schemas"
SCHEMA_NAMES = ("manual-quads.schema.json", "slide-lens-report.schema.json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail when packaged schemas are stale")
    args = parser.parse_args()

    stale: list[Path] = []
    expected: dict[Path, str] = {}
    for name in SCHEMA_NAMES:
        source = SOURCE_DIR / name
        target = PACKAGE_DIR / name
        contents = source.read_text(encoding="utf-8")
        expected[target] = contents
        if not target.exists() or target.read_text(encoding="utf-8") != contents:
            stale.append(target)

    if args.check:
        for path in stale:
            print(f"stale packaged schema: {path.relative_to(ROOT)}")
        return 1 if stale else 0

    for path, contents in expected.items():
        path.write_text(contents, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
