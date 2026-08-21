#!/usr/bin/env python3
"""Run the shared Python/TypeScript detection golden contract."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANNOTATIONS = ROOT / "tests" / "fixtures" / "detection" / "annotations.json"
CONTRACT = ROOT / "tests" / "fixtures" / "detection" / "golden-contract.json"
sys.path.insert(0, str(ROOT / "src"))

from slides_thief.detection.confidence import is_ambiguous_candidate

FEATURE_NAME_MAP = {
    "edge_strength": "edgeStrength",
    "edge_support": "edgeSupport",
    "edge_continuity": "edgeContinuity",
    "gradient_alignment": "gradientAlignment",
    "inside_outside_difference": "insideOutsideDifference",
    "region_consistency": "regionConsistency",
    "normalized_area": "normalizedArea",
    "geometry_validity": "geometryValidity",
    "aspect_prior": "aspectPrior",
    "batch_consistency": "batchConsistency",
}
EXPECTED_FEATURES = set(FEATURE_NAME_MAP.values())


def run_evaluators(directory: Path) -> dict[str, list[dict]]:
    python_output = directory / "python-predictions.json"
    node_output = directory / "typescript-predictions.json"
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "generate_detection_config.py"),
            "--check",
        ],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "evaluate_detection.py"),
            "--annotations",
            str(ANNOTATIONS),
            "--predictions-output",
            str(python_output),
        ],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
    )

    node = os.environ.get("NODE_BIN") or shutil.which("node")
    if not node:
        raise RuntimeError("node is required for the cross-implementation detection contract")
    subprocess.run(
        [
            node,
            str(ROOT / "site" / "scripts" / "evaluate-detection.mjs"),
            str(ANNOTATIONS),
            "--predictions-output",
            str(node_output),
        ],
        cwd=ROOT / "site",
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return {
        "python": json.loads(python_output.read_text(encoding="utf-8"))["images"],
        "typescript": json.loads(node_output.read_text(encoding="utf-8"))["images"],
    }


def row_value(row: dict, snake: str, camel: str):
    return row[snake] if snake in row else row[camel]


def optional_row_value(row: dict, snake: str, camel: str):
    return row[snake] if snake in row else row.get(camel)


def normalized_features(row: dict, implementation: str, file: str) -> dict[str, float]:
    features = optional_row_value(row, "selected_features", "selectedFeatures") or {}
    if not isinstance(features, dict):
        raise TypeError(f"{implementation}/{file}: selected features are not an object")
    if not features:
        return {}
    keys = set(features)
    if keys == set(FEATURE_NAME_MAP):
        features = {FEATURE_NAME_MAP[name]: value for name, value in features.items()}
    if set(features) != EXPECTED_FEATURES:
        raise AssertionError(
            f"{implementation}/{file}: selected feature set is {sorted(features)}, "
            f"expected {sorted(EXPECTED_FEATURES)}"
        )
    normalized = {name: float(value) for name, value in features.items()}
    if any(not math.isfinite(value) for value in normalized.values()):
        raise AssertionError(f"{implementation}/{file}: selected features contain a non-finite value")
    return normalized


def validate_rows(contract: dict, predictions: dict[str, list[dict]]) -> None:
    expected_by_file = {item["file"]: item for item in contract["fixtures"]}
    for implementation, rows in predictions.items():
        rows_by_file = {row["file"]: row for row in rows}
        if set(rows_by_file) != set(expected_by_file):
            raise AssertionError(f"{implementation}: fixture set differs from golden contract")
        for file, expected in expected_by_file.items():
            row = rows_by_file[file]
            confidence = float(row["confidence"])
            if row["method"] != expected["method"]:
                raise AssertionError(f"{implementation}/{file}: method={row['method']!r}")
            if not expected["confidence"]["min"] <= confidence <= expected["confidence"]["max"]:
                raise AssertionError(f"{implementation}/{file}: confidence={confidence}")
            if row_value(row, "needs_review", "needsReview") != expected["needsReview"]:
                raise AssertionError(f"{implementation}/{file}: needs_review changed")
            if row_value(row, "review_reasons", "reviewReasons") != expected["reviewReasons"]:
                raise AssertionError(f"{implementation}/{file}: review reasons changed")
            if "maxCornerError" in expected:
                max_corner_error = optional_row_value(row, "max_corner_error", "maxCornerError")
                if max_corner_error is None or float(max_corner_error) > expected["maxCornerError"]:
                    raise AssertionError(f"{implementation}/{file}: corner error exceeded contract")
            if "minQuadIoU" in expected:
                quad_iou = optional_row_value(row, "quad_iou", "quadIou")
                if quad_iou is None or float(quad_iou) < expected["minQuadIoU"]:
                    raise AssertionError(f"{implementation}/{file}: IoU fell below contract")
            candidate_methods = optional_row_value(row, "candidate_methods", "candidateMethods") or []
            for required_method in expected.get("requiredCandidateMethods", []):
                if required_method not in candidate_methods:
                    raise AssertionError(
                        f"{implementation}/{file}: candidate method {required_method!r} missing"
                    )
            if "candidateCountRange" in expected:
                candidate_count = int(optional_row_value(row, "candidate_count", "candidateCount"))
                minimum, maximum = expected["candidateCountRange"]
                if not minimum <= candidate_count <= maximum:
                    raise AssertionError(
                        f"{implementation}/{file}: candidate count {candidate_count} outside range"
                    )
            features = normalized_features(row, implementation, file)
            if expected["method"] == "fallback-frame":
                if features:
                    raise AssertionError(f"{implementation}/{file}: fallback exposes score features")
            elif set(features) != EXPECTED_FEATURES:
                raise AssertionError(f"{implementation}/{file}: scored candidate feature set is incomplete")


def validate_cross_implementation(contract: dict, predictions: dict[str, list[dict]]) -> None:
    python_rows = {row["file"]: row for row in predictions["python"]}
    typescript_rows = {row["file"]: row for row in predictions["typescript"]}
    for file, python_row in python_rows.items():
        typescript_row = typescript_rows[file]
        python_quad = python_row["quad"]
        typescript_quad = typescript_row["quad"]
        ppm_path = (ROOT / "tests" / "fixtures" / "detection" / file).with_suffix(".ppm")
        header = ppm_path.read_bytes().split(None, 4)
        width, height = int(header[1]), int(header[2])
        diagonal = math.hypot(width, height)
        normalized_delta = sum(
            math.hypot(first[0] - second[0], first[1] - second[1])
            for first, second in zip(python_quad, typescript_quad)
        ) / (4 * diagonal)
        if normalized_delta > contract["crossImplementation"]["maxNormalizedCornerDelta"]:
            raise AssertionError(f"{file}: cross-implementation corner delta={normalized_delta:.6f}")
        cross = contract["crossImplementation"]
        python_count = int(optional_row_value(python_row, "candidate_count", "candidateCount"))
        typescript_count = int(optional_row_value(typescript_row, "candidate_count", "candidateCount"))
        if abs(python_count - typescript_count) > cross.get("maxCandidateCountDelta", math.inf):
            raise AssertionError(f"{file}: candidate count delta={abs(python_count - typescript_count)}")
        confidence_delta = abs(
            float(python_row["confidence"]) - float(typescript_row["confidence"])
        )
        if confidence_delta > cross.get("maxConfidenceDelta", math.inf):
            raise AssertionError(f"{file}: confidence delta={confidence_delta:.6f}")
        score_delta = abs(
            float(python_row["best_score"]) - float(typescript_row["bestScore"])
        )
        if score_delta > cross.get("maxBestScoreDelta", math.inf):
            raise AssertionError(f"{file}: best score delta={score_delta:.6f}")
        python_features = normalized_features(python_row, "python", file)
        typescript_features = normalized_features(typescript_row, "typescript", file)
        if bool(python_features) != bool(typescript_features):
            raise AssertionError(f"{file}: one implementation omitted selected score features")
        python_warnings = optional_row_value(python_row, "selected_warnings", "selectedWarnings") or []
        typescript_warnings = optional_row_value(
            typescript_row, "selected_warnings", "selectedWarnings"
        ) or []
        if python_warnings != typescript_warnings:
            raise AssertionError(f"{file}: selected warning sets differ")
        if not python_features:
            if (
                python_row["method"] != "fallback-frame"
                or typescript_row["method"] != "fallback-frame"
            ):
                raise AssertionError(f"{file}: scored candidate feature comparison is empty")
            continue
        if set(python_features) != set(typescript_features) or not set(python_features):
            raise AssertionError(f"{file}: selected feature comparison has an empty or incomplete key set")
        feature_delta = max(
            (
                abs(python_features[name] - typescript_features[name])
                for name in EXPECTED_FEATURES
            ),
        )
        if feature_delta > cross.get("maxFeatureDelta", math.inf):
            raise AssertionError(f"{file}: selected feature delta={feature_delta:.6f}")


def validate_decision_contract(contract: dict) -> None:
    cases = contract.get("decisionCases", [])
    if not cases:
        return
    python_results = [
        is_ambiguous_candidate(case["secondBestIoU"], case["breakdown"])
        for case in cases
    ]
    node = os.environ.get("NODE_BIN") or shutil.which("node")
    if not node:
        raise RuntimeError("node is required for the ambiguity decision contract")
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as handle:
        json.dump(cases, handle)
        handle.flush()
        completed = subprocess.run(
            [
                node,
                str(ROOT / "site" / "scripts" / "evaluate-decision-contract.mjs"),
                handle.name,
            ],
            cwd=ROOT / "site",
            check=True,
            capture_output=True,
            text=True,
        )
    typescript_results = json.loads(completed.stdout)
    expected = [case["expected"] for case in cases]
    if python_results != expected:
        raise AssertionError(f"Python ambiguity decisions differ from golden contract: {python_results}")
    if typescript_results != expected:
        raise AssertionError(
            f"TypeScript ambiguity decisions differ from golden contract: {typescript_results}"
        )


def main() -> int:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="slides-thief-detection-contract-") as directory:
        predictions = run_evaluators(Path(directory))
    validate_rows(contract, predictions)
    validate_cross_implementation(contract, predictions)
    validate_decision_contract(contract)
    print("Python/TypeScript detection golden contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
