#!/usr/bin/env python3
"""Evaluate the CLI detector against the shared annotated fixture set."""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from slides_thief.cli import detect_quad  # noqa: E402


def quad_iou(predicted: np.ndarray, expected: np.ndarray, width: int, height: int) -> float:
    predicted_mask = Image.new("1", (width, height))
    expected_mask = Image.new("1", (width, height))
    ImageDraw.Draw(predicted_mask).polygon([tuple(point) for point in predicted], fill=1)
    ImageDraw.Draw(expected_mask).polygon([tuple(point) for point in expected], fill=1)
    predicted_arr = np.asarray(predicted_mask, dtype=bool)
    expected_arr = np.asarray(expected_mask, dtype=bool)
    union = np.logical_or(predicted_arr, expected_arr).sum()
    return float(np.logical_and(predicted_arr, expected_arr).sum() / union) if union else 0.0


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * fraction) - 1))
    return ordered[index]


def evaluate(annotations_path: Path) -> tuple[dict, dict]:
    fixture_root = annotations_path.parent
    annotations = json.loads(annotations_path.read_text(encoding="utf-8"))
    rows = []
    runtimes = []

    for item in annotations["images"]:
        image_path = fixture_root / item["file"]
        image = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
        started = time.perf_counter()
        predicted, diagnostics = detect_quad(image, 16 / 9)
        runtimes.append((time.perf_counter() - started) * 1000)
        expected = np.asarray(item["quad"], dtype=np.float64)
        diagonal = math.hypot(image.width, image.height)
        errors = np.linalg.norm(predicted - expected, axis=1) / diagonal
        iou = quad_iou(predicted, expected, image.width, image.height)
        rows.append(
            {
                "file": item["file"],
                "quad": [[round(float(x), 4), round(float(y), 4)] for x, y in predicted],
                "method": diagnostics["method"],
                "confidence": diagnostics["confidence"],
                "needs_review": diagnostics["needs_review"],
                "review_reasons": diagnostics["review_reasons"],
                "best_score": diagnostics["best_score"],
                "second_best_score": diagnostics["second_best_score"],
                "confidence_breakdown": diagnostics["diagnostics"].get("confidence_breakdown"),
                "mean_corner_error": float(errors.mean()),
                "max_corner_error": float(errors.max()),
                "quad_iou": iou,
            }
        )

    mean_errors = [row["mean_corner_error"] for row in rows]
    metrics = {
        "fixture_count": len(rows),
        "mean_corner_error": statistics.fmean(mean_errors) if mean_errors else 0.0,
        "median_corner_error": statistics.median(mean_errors) if mean_errors else 0.0,
        "max_corner_error_mean": statistics.fmean(row["max_corner_error"] for row in rows) if rows else 0.0,
        "quad_iou_mean": statistics.fmean(row["quad_iou"] for row in rows) if rows else 0.0,
        "all_corners_under_1_percent": sum(row["max_corner_error"] < 0.01 for row in rows) / len(rows) if rows else 0.0,
        "all_corners_under_2_percent": sum(row["max_corner_error"] < 0.02 for row in rows) / len(rows) if rows else 0.0,
        "review_rate": sum(row["needs_review"] for row in rows) / len(rows) if rows else 0.0,
        "high_confidence_failure_rate": (
            sum(row["confidence"] >= 0.8 and row["quad_iou"] < 0.75 for row in rows) / len(rows) if rows else 0.0
        ),
        "runtime_p50_ms": statistics.median(runtimes) if runtimes else 0.0,
        "runtime_p95_ms": percentile(runtimes, 0.95),
    }
    predictions = {"images": rows}
    return metrics, predictions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--annotations",
        type=Path,
        default=REPO_ROOT / "tests" / "fixtures" / "detection" / "annotations.json",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--predictions-output", type=Path)
    args = parser.parse_args()
    metrics, predictions = evaluate(args.annotations)
    payload = json.dumps(metrics, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(f"{payload}\n", encoding="utf-8")
    if args.predictions_output:
        args.predictions_output.write_text(
            f"{json.dumps(predictions, indent=2, sort_keys=True)}\n",
            encoding="utf-8",
        )
    print(payload)


if __name__ == "__main__":
    main()
