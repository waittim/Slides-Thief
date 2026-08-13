"""Runtime validation for JSON contracts crossing the CLI boundary."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Any

import jsonschema
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


@lru_cache(maxsize=None)
def _load_schema(filename: str) -> dict:
    try:
        resource = resources.files("slides_thief.schemas").joinpath(filename)
        return json.loads(resource.read_text(encoding="utf-8"))
    except (FileNotFoundError, ModuleNotFoundError, OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not load packaged JSON Schema {filename!r}") from exc


def _validate_schema(value: object, *, schema_name: str, source: str) -> None:
    schema = _load_schema(schema_name)
    validator = jsonschema.Draft202012Validator(schema)
    error = next(
        iter(sorted(validator.iter_errors(value), key=lambda item: list(item.absolute_path))),
        None,
    )
    if error is None:
        return
    location = ".".join(str(part) for part in error.absolute_path) or "$"
    raise ContractValidationError(f"{source} at {location}: {error.message}")


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
    validated = _validate_manual_shape(raw, path)
    _validate_schema(raw, schema_name="manual-quads.schema.json", source=str(path))
    return validated


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

def validate_slide_lens_report(value: object) -> None:
    """Validate a report against the packaged public Draft 2020-12 Schema."""

    _validate_schema(value, schema_name="slide-lens-report.schema.json", source="slide-lens report")


__all__ = [
    "ContractValidationError",
    "ManualQuad",
    "ManualQuads",
    "load_manual_quads",
    "validate_manual_quad_for_image",
    "validate_slide_lens_report",
]
