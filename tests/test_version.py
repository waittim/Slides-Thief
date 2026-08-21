"""Keep package, web, and citation versions aligned."""

from __future__ import annotations

import json
import re
from pathlib import Path

from slides_thief import __version__
from slides_thief.product_metadata import PRODUCT_METADATA

ROOT = Path(__file__).resolve().parents[1]


def test_version_markers_match() -> None:
    package = json.loads((ROOT / "site" / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "site" / "package-lock.json").read_text(encoding="utf-8"))
    citation = json.loads((ROOT / "site" / "public" / "citation.json").read_text(encoding="utf-8"))
    citation_cff = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    cff_match = re.search(r"(?m)^version:\s*([^\s#]+)\s*$", citation_cff)

    assert package["version"] == __version__
    assert PRODUCT_METADATA["version"] == __version__
    assert lock["version"] == __version__
    assert lock["packages"][""]["version"] == __version__
    assert citation["version"] == __version__
    assert cff_match is not None
    assert cff_match.group(1) == __version__


def test_changelog_documents_released_versions() -> None:
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## [{__version__}]" in changelog
    assert "## [2.0.0]" in changelog
    assert "## [0.1.0]" in changelog
