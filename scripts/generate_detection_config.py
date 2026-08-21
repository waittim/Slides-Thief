#!/usr/bin/env python3
"""Generate the Python and TypeScript views of the canonical detector config."""

from __future__ import annotations

import argparse
import json
import pprint
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "schemas" / "detection-config.json"
PYTHON_TARGET = ROOT / "src" / "slides_thief" / "detection" / "config.py"
TYPESCRIPT_TARGET = ROOT / "site" / "app" / "detection" / "config.ts"


def render_python(config: dict) -> str:
    payload = pprint.pformat(config, sort_dicts=False, width=120)
    return (
        "\"\"\"Generated from schemas/detection-config.json; do not edit manually.\"\"\"\n\n"
        "from __future__ import annotations\n\n"
        f"DETECTION_CONFIG = {payload}\n"
    )


def render_typescript(config: dict) -> str:
    payload = json.dumps(config, indent=2, ensure_ascii=False)
    return (
        "// Generated from schemas/detection-config.json; do not edit manually.\n\n"
        f"export const DETECTION_CONFIG = {payload} as const;\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail when generated files are stale")
    args = parser.parse_args()

    config = json.loads(SOURCE.read_text(encoding="utf-8"))
    expected = {
        PYTHON_TARGET: render_python(config),
        TYPESCRIPT_TARGET: render_typescript(config),
    }
    stale = [path for path, contents in expected.items() if not path.exists() or path.read_text(encoding="utf-8") != contents]
    if args.check:
        if stale:
            for path in stale:
                print(f"stale generated detector config: {path.relative_to(ROOT)}")
            return 1
        return 0

    for path, contents in expected.items():
        path.write_text(contents, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
