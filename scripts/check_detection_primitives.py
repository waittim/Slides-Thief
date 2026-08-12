#!/usr/bin/env python3
"""Check the shared Python/TypeScript detector primitive golden contract."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "detection" / "shared-primitives.json"
sys.path.insert(0, str(ROOT / "src"))

from slides_thief.detection.candidate_factory import empty_candidate_features  # noqa: E402
from slides_thief.detection.geometry import (  # noqa: E402
    geometry_is_valid,
    line_intersection,
    normalized_corner_distance,
    quad_iou,
)
from slides_thief.detection.numeric import average, percentile  # noqa: E402


def python_result(fixture: dict) -> dict:
    geometry = fixture["geometry"]
    numeric = fixture["numeric"]
    return {
        "validGeometry": geometry_is_valid(
            np.asarray(geometry["validQuad"], dtype=np.float64), geometry["width"], geometry["height"]
        ),
        "invalidConcaveGeometry": geometry_is_valid(
            np.asarray(geometry["invalidConcaveQuad"], dtype=np.float64), geometry["width"], geometry["height"]
        ),
        "outOfBoundsGeometry": geometry_is_valid(
            np.asarray(geometry["outOfBoundsQuad"], dtype=np.float64), geometry["width"], geometry["height"]
        ),
        "intersection": line_intersection(
            np.asarray(geometry["intersectionLines"][0], dtype=np.float64),
            np.asarray(geometry["intersectionLines"][1], dtype=np.float64),
        ).tolist(),
        "iou": quad_iou(
            np.asarray(fixture["iou"]["first"], dtype=np.float64),
            np.asarray(fixture["iou"]["second"], dtype=np.float64),
        ),
        "normalizedCornerDistance": normalized_corner_distance(
            np.asarray(fixture["distance"]["first"], dtype=np.float64),
            np.asarray(fixture["distance"]["second"], dtype=np.float64),
            fixture["distance"]["width"],
            fixture["distance"]["height"],
        ),
        "average": average(numeric["values"]),
        "percentiles": [percentile(numeric["values"], fraction) for fraction in numeric["percentileFractions"]],
        "pythonEmptyFeatureKeys": list(empty_candidate_features()),
        "emptyFeatureValues": list(empty_candidate_features().values()),
    }


def assert_close(actual, expected, path: str) -> None:
    if isinstance(expected, list):
        if len(actual) != len(expected):
            raise AssertionError(f"{path}: length {len(actual)} != {len(expected)}")
        for index, (actual_value, expected_value) in enumerate(zip(actual, expected)):
            assert_close(actual_value, expected_value, f"{path}[{index}]")
        return
    if isinstance(expected, float):
        if not math.isclose(float(actual), expected, rel_tol=1e-12, abs_tol=1e-12):
            raise AssertionError(f"{path}: {actual!r} != {expected!r}")
        return
    if actual != expected:
        raise AssertionError(f"{path}: {actual!r} != {expected!r}")


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    expected = fixture["expected"]
    python_values = python_result(fixture)
    for key, expected_value in expected.items():
        if key == "emptyFeatureKeys":
            continue
        assert_close(python_values[key], expected_value, f"python.{key}")

    node = os.environ.get("NODE_BIN") or shutil.which("node")
    if not node:
        raise RuntimeError("node is required for the shared primitive contract")
    completed = subprocess.run(
        [node, str(ROOT / "site" / "scripts" / "evaluate-detection-primitives.mjs"), str(FIXTURE)],
        cwd=ROOT / "site",
        check=True,
        capture_output=True,
        text=True,
    )
    typescript_values = json.loads(completed.stdout)
    for key, expected_value in expected.items():
        if key == "pythonEmptyFeatureKeys":
            continue
        assert_close(typescript_values[key], expected_value, f"typescript.{key}")
    for key in expected:
        if key in {"emptyFeatureKeys", "pythonEmptyFeatureKeys"}:
            continue
        assert_close(typescript_values[key], python_values[key], f"cross.{key}")
    if any(value != 0 for value in python_values["emptyFeatureValues"]):
        raise AssertionError("python empty feature values are not all zero")
    if any(value != 0 for value in typescript_values["emptyFeatureValues"]):
        raise AssertionError("typescript empty feature values are not all zero")
    print("Python/TypeScript detection primitive golden contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
