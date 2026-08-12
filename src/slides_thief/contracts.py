"""Runtime validation for JSON contracts crossing the CLI boundary."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Mapping

import numpy as np


ManualQuad = list[list[float]]
ManualQuads = dict[str, ManualQuad]


class ContractValidationError(ValueError):
    """Raised when a user-provided or generated JSON contract is invalid."""


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def _reject_non_standard_json_constant(value: str) -> None:
    raise ContractValidationError(f"non-finite JSON number {value!r} is not supported")


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ContractValidationError(f"duplicate JSON object key {key!r}")
        result[key] = value
    return result


def _format_path(path: Path, location: str | None = None) -> str:
    return f"{path}{location or ''}"


def _order_quad(quad: np.ndarray) -> np.ndarray:
    """Return the project's canonical top-left-first point order."""

    scores = quad.sum(axis=1)
    differences = quad[:, 0] - quad[:, 1]
    return np.array(
        [
            quad[np.argmin(scores)],
            quad[np.argmax(differences)],
            quad[np.argmax(scores)],
            quad[np.argmin(differences)],
        ],
        dtype=np.float64,
    )


def _validate_manual_shape(value: object, path: Path) -> ManualQuads:
    if not isinstance(value, dict):
        raise ContractValidationError(
            f"{_format_path(path)}: expected a JSON object keyed by source filename or stem"
        )

    result: ManualQuads = {}
    for filename, raw_quad in value.items():
        entry_path = _format_path(path, f" entry {filename!r}")
        if not isinstance(filename, str) or not filename.strip():
            raise ContractValidationError(f"{_format_path(path)}: entry keys must be non-empty strings")
        if not isinstance(raw_quad, list) or len(raw_quad) != 4:
            actual = len(raw_quad) if isinstance(raw_quad, list) else type(raw_quad).__name__
            raise ContractValidationError(f"{entry_path}: expected exactly 4 corner points, got {actual}")

        quad: ManualQuad = []
        for corner_index, raw_point in enumerate(raw_quad, 1):
            corner_path = f"{entry_path} corner {corner_index}"
            if not isinstance(raw_point, list) or len(raw_point) != 2:
                raise ContractValidationError(f"{corner_path}: expected [x, y]")
            if not all(_is_number(coordinate) for coordinate in raw_point):
                raise ContractValidationError(f"{corner_path}: x and y must be finite numbers")
            quad.append([float(raw_point[0]), float(raw_point[1])])
        result[filename] = quad
    return result


def load_manual_quads(path: Path | None) -> ManualQuads:
    """Load and structurally validate a ``--manual`` JSON file.

    Image-dependent checks are intentionally performed by
    :func:`validate_manual_quad_for_image` after each source image has been
    opened, so errors can name the exact file and corner.
    """

    if path is None:
        return {}
    try:
        with path.open("r", encoding="utf-8") as fh:
            raw = json.load(
                fh,
                parse_constant=_reject_non_standard_json_constant,
                object_pairs_hook=_reject_duplicate_keys,
            )
    except ContractValidationError as exc:
        raise ContractValidationError(f"{path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise ContractValidationError(f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc
    except OSError as exc:
        detail = exc.strerror or str(exc)
        raise ContractValidationError(f"{path}: could not read manual quads file: {detail}") from exc
    return _validate_manual_shape(raw, path)


def validate_manual_quad_for_image(
    quad: ManualQuad,
    *,
    filename: str,
    image_size: tuple[int, int],
) -> ManualQuad:
    """Validate order, geometry, and image bounds for one manual quad."""

    width, height = image_size
    points = np.asarray(quad, dtype=np.float64)
    prefix = f"manual quad for {filename!r}"

    for corner_index, (x, y) in enumerate(points, 1):
        if not (0 <= x <= width and 0 <= y <= height):
            raise ContractValidationError(
                f"{prefix} corner {corner_index} is outside image bounds "
                f"(x={x:g}, y={y:g}; expected 0 <= x <= {width} and 0 <= y <= {height})"
            )

    canonical = _order_quad(points)
    if not np.allclose(canonical, points, rtol=0.0, atol=1e-6):
        expected = [[round(float(x), 4), round(float(y), 4)] for x, y in canonical]
        raise ContractValidationError(
            f"{prefix} corners must be ordered top-left, top-right, bottom-right, bottom-left; "
            f"expected order {expected}"
        )

    edge_vectors = np.roll(points, -1, axis=0) - points
    crosses = edge_vectors[:, 0] * np.roll(edge_vectors[:, 1], -1) - edge_vectors[:, 1] * np.roll(
        edge_vectors[:, 0], -1
    )
    if not (np.all(crosses > 1e-9) or np.all(crosses < -1e-9)):
        raise ContractValidationError(f"{prefix} must form a non-degenerate convex quadrilateral")
    return quad


def _require_mapping(value: object, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractValidationError(f"{path}: expected an object")
    return value


def _require_string(value: object, path: str) -> None:
    if not isinstance(value, str):
        raise ContractValidationError(f"{path}: expected a string")


def _require_non_negative_integer(value: object, path: str) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ContractValidationError(f"{path}: expected a non-negative integer")


def _require_positive_integer(value: object, path: str) -> None:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ContractValidationError(f"{path}: expected a positive integer")


def _require_finite_number(value: object, path: str, *, minimum: float | None = None, maximum: float | None = None) -> None:
    if not _is_number(value):
        raise ContractValidationError(f"{path}: expected a finite number")
    numeric = float(value)
    if minimum is not None and numeric < minimum:
        raise ContractValidationError(f"{path}: expected a number >= {minimum}")
    if maximum is not None and numeric > maximum:
        raise ContractValidationError(f"{path}: expected a number <= {maximum}")


def _validate_report_quad(value: object, path: str) -> None:
    if not isinstance(value, list) or len(value) != 4:
        raise ContractValidationError(f"{path}: expected exactly 4 points")
    for index, point in enumerate(value, 1):
        if not isinstance(point, list) or len(point) != 2:
            raise ContractValidationError(f"{path}[{index}]: expected [x, y]")
        for axis, coordinate in zip(("x", "y"), point):
            _require_finite_number(coordinate, f"{path}[{index}].{axis}")


def validate_slide_lens_report(value: object) -> None:
    """Validate the report shape before it is persisted to disk.

    This is deliberately a small runtime counterpart to the public JSON
    Schema. It catches producer regressions without requiring the CLI package
    to discover a source-tree-only schema file at runtime.
    """

    report = _require_mapping(value, "report")
    required_strings = (
        "input_dir",
        "output_pdf",
        "ratio",
        "source_slide_ratio",
        "output_page_ratio",
    )
    for field in required_strings:
        if field not in report:
            raise ContractValidationError(f"report.{field}: missing required field")
        _require_string(report[field], f"report.{field}")

    if "size" not in report or not isinstance(report["size"], list) or len(report["size"]) != 2:
        raise ContractValidationError("report.size: expected [width, height]")
    for index, dimension in enumerate(report["size"]):
        _require_positive_integer(dimension, f"report.size[{index}]")

    summary = _require_mapping(report.get("batch_summary"), "report.batch_summary")
    for field in ("preliminary_count", "reliable_count", "prior_count"):
        if field not in summary:
            raise ContractValidationError(f"report.batch_summary.{field}: missing required field")
        _require_non_negative_integer(summary[field], f"report.batch_summary.{field}")
    priors = summary.get("priors")
    if not isinstance(priors, list):
        raise ContractValidationError("report.batch_summary.priors: expected an array")
    for index, raw_prior in enumerate(priors):
        prior = _require_mapping(raw_prior, f"report.batch_summary.priors[{index}]")
        for field in ("id", "orientation"):
            if field not in prior:
                raise ContractValidationError(f"report.batch_summary.priors[{index}].{field}: missing required field")
            _require_string(prior[field], f"report.batch_summary.priors[{index}].{field}")
        if prior["orientation"] not in {"landscape", "portrait"}:
            raise ContractValidationError(f"report.batch_summary.priors[{index}].orientation: invalid value")
        _validate_report_quad(prior.get("normalized_quad"), f"report.batch_summary.priors[{index}].normalized_quad")
        _require_positive_integer(prior.get("member_count"), f"report.batch_summary.priors[{index}].member_count")
        _require_finite_number(prior.get("rms_deviation"), f"report.batch_summary.priors[{index}].rms_deviation", minimum=0)
        _require_finite_number(prior.get("consistency"), f"report.batch_summary.priors[{index}].consistency", minimum=0, maximum=1)

    slides = report.get("slides")
    if not isinstance(slides, list):
        raise ContractValidationError("report.slides: expected an array")
    for index, raw_slide in enumerate(slides):
        slide = _require_mapping(raw_slide, f"report.slides[{index}]")
        for field in ("index", "source", "output", "quad", "method", "confidence"):
            if field not in slide:
                raise ContractValidationError(f"report.slides[{index}].{field}: missing required field")
        _require_positive_integer(slide["index"], f"report.slides[{index}].index")
        _require_string(slide["source"], f"report.slides[{index}].source")
        _require_string(slide["output"], f"report.slides[{index}].output")
        _validate_report_quad(slide["quad"], f"report.slides[{index}].quad")
        _require_string(slide["method"], f"report.slides[{index}].method")
        _require_finite_number(slide["confidence"], f"report.slides[{index}].confidence", minimum=0, maximum=1)
        if "needs_review" in slide and not isinstance(slide["needs_review"], bool):
            raise ContractValidationError(f"report.slides[{index}].needs_review: expected a boolean")
        if "review_reasons" in slide and (
            not isinstance(slide["review_reasons"], list)
            or not all(isinstance(reason, str) for reason in slide["review_reasons"])
        ):
            raise ContractValidationError(f"report.slides[{index}].review_reasons: expected an array of strings")
        if "best_score" in slide:
            _require_finite_number(slide["best_score"], f"report.slides[{index}].best_score")
        if "second_best_score" in slide and slide["second_best_score"] is not None:
            _require_finite_number(slide["second_best_score"], f"report.slides[{index}].second_best_score")
        if "candidates_evaluated" in slide:
            _require_non_negative_integer(slide["candidates_evaluated"], f"report.slides[{index}].candidates_evaluated")
        for field in ("features", "diagnostics"):
            if field in slide:
                _require_mapping(slide[field], f"report.slides[{index}].{field}")


__all__ = [
    "ContractValidationError",
    "ManualQuad",
    "ManualQuads",
    "load_manual_quads",
    "validate_manual_quad_for_image",
    "validate_slide_lens_report",
]
