"""Cross-runtime golden contract for the Python and Web detectors."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_python_and_typescript_detection_contract() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_detection_contract.py")],
        cwd=ROOT,
        check=True,
    )


def test_python_and_typescript_detection_primitives_contract() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_detection_primitives.py")],
        cwd=ROOT,
        check=True,
    )
