"""Local four-edge refinement around a validated initial quadrilateral."""

from __future__ import annotations

import math

import numpy as np

from .gradient import GradientMap
from .config import DETECTION_CONFIG
from .scoring import evaluate_edge_evidence


_REFINEMENT_CONFIG = DETECTION_CONFIG["refinement"]


def refine_quad(
    quad: np.ndarray,
    gray: np.ndarray,
    gradient: GradientMap,
) -> tuple[np.ndarray, dict] | None:
    edges = [
        _refine_edge(quad[index], quad[(index + 1) % 4], gray, gradient)
        for index in range(4)
    ]
    refined = np.asarray(
        [
            _intersection(edges[3]["line"], edges[0]["line"]),
            _intersection(edges[0]["line"], edges[1]["line"]),
            _intersection(edges[1]["line"], edges[2]["line"]),
            _intersection(edges[2]["line"], edges[3]["line"]),
        ],
        dtype=np.float64,
    )
    height, width = gray.shape
    if not _geometry_is_valid(refined, width, height):
        return None
    movements = np.linalg.norm(refined - quad, axis=1)
    movement_limit = math.hypot(width, height) * float(_REFINEMENT_CONFIG["movementRatio"])
    if float(movements.max()) > movement_limit:
        return None
    return refined, {
        "angle_deltas_degrees": [round(math.degrees(edge["angle_delta"]), 2) for edge in edges],
        "offsets": [round(edge["offset"], 2) for edge in edges],
        "edge_objectives_before": [round(edge["objective_before"], 4) for edge in edges],
        "edge_objectives_after": [round(edge["objective"], 4) for edge in edges],
        "localization_offsets_after": [round(edge["localization_offset"], 3) for edge in edges],
        "maximum_corner_movement": round(float(movements.max()), 3),
        "movement_limit": round(movement_limit, 3),
    }


def _refine_edge(
    start: np.ndarray,
    end: np.ndarray,
    gray: np.ndarray,
    gradient: GradientMap,
) -> dict:
    midpoint = (start + end) / 2
    length = float(np.linalg.norm(end - start))
    base_angle = math.atan2(end[1] - start[1], end[0] - start[0])
    best = _evaluate_transform(midpoint, length, base_angle, 0.0, 0.0, gray, gradient)
    objective_before = best["objective"]

    angle_range = float(_REFINEMENT_CONFIG["coarseAngleRangeDegrees"])
    offset_range = float(_REFINEMENT_CONFIG["coarseOffset"])
    for angle_degrees in np.arange(
        -angle_range,
        angle_range + float(_REFINEMENT_CONFIG["coarseAngleStepDegrees"]) * 0.01,
        float(_REFINEMENT_CONFIG["coarseAngleStepDegrees"]),
    ):
        for offset in np.arange(
            -offset_range,
            offset_range + float(_REFINEMENT_CONFIG["coarseOffsetStep"]) * 0.01,
            float(_REFINEMENT_CONFIG["coarseOffsetStep"]),
        ):
            candidate = _evaluate_transform(
                midpoint,
                length,
                base_angle,
                math.radians(float(angle_degrees)),
                float(offset),
                gray,
                gradient,
            )
            if candidate["selection_score"] > best["selection_score"]:
                best = candidate

    coarse_angle = best["angle_delta"]
    coarse_offset = best["offset"]
    for angle_delta in np.arange(
        coarse_angle - math.radians(float(_REFINEMENT_CONFIG["fineAngleRangeDegrees"])),
        coarse_angle + math.radians(
            float(_REFINEMENT_CONFIG["fineAngleRangeDegrees"])
            + float(_REFINEMENT_CONFIG["fineAngleStepDegrees"]) * 0.01
        ),
        math.radians(float(_REFINEMENT_CONFIG["fineAngleStepDegrees"])),
    ):
        fine_offset_range = float(_REFINEMENT_CONFIG["fineOffsetRange"])
        for offset in np.arange(
            coarse_offset - fine_offset_range,
            coarse_offset + fine_offset_range
            + float(_REFINEMENT_CONFIG["fineOffsetStep"]) * 0.01,
            float(_REFINEMENT_CONFIG["fineOffsetStep"]),
        ):
            if abs(angle_delta) > math.radians(angle_range) or abs(offset) > offset_range:
                continue
            candidate = _evaluate_transform(
                midpoint,
                length,
                base_angle,
                float(angle_delta),
                float(offset),
                gray,
                gradient,
            )
            if candidate["selection_score"] > best["selection_score"]:
                best = candidate
    best["objective_before"] = objective_before
    return best


def _evaluate_transform(
    midpoint: np.ndarray,
    length: float,
    base_angle: float,
    angle_delta: float,
    offset: float,
    gray: np.ndarray,
    gradient: GradientMap,
) -> dict:
    angle = base_angle + angle_delta
    direction = np.array([math.cos(angle), math.sin(angle)])
    normal = np.array([-direction[1], direction[0]])
    shifted_midpoint = midpoint + normal * offset
    start = shifted_midpoint - direction * length / 2
    end = shifted_midpoint + direction * length / 2
    evidence = evaluate_edge_evidence(gray, start, end, gradient)
    objective = _edge_objective(evidence, gradient)
    localization_score = 1 - min(
        1.0,
        evidence["localization_offset"] / float(_REFINEMENT_CONFIG["localizationScale"]),
    )
    regularization = float(_REFINEMENT_CONFIG["regularizationWeight"]) * (
        abs(angle_delta) / math.radians(float(_REFINEMENT_CONFIG["coarseAngleRangeDegrees"]))
        + abs(offset) / float(_REFINEMENT_CONFIG["coarseOffset"])
    )
    return {
        "line": np.array([normal[0], normal[1], -float(normal @ shifted_midpoint)]),
        "angle_delta": angle_delta,
        "offset": offset,
        "objective": objective,
        "localization_offset": evidence["localization_offset"],
        "selection_score": objective + 0.02 * localization_score - regularization,
    }


def _edge_objective(evidence: dict, gradient: GradientMap) -> float:
    edge_strength = min(
        1.0,
        evidence["median_strength"]
        / max(
            float(_REFINEMENT_CONFIG["gradientStrengthFloor"]),
            gradient.threshold * float(_REFINEMENT_CONFIG["gradientStrengthScale"]),
        ),
    )
    signed_contrast = max(
        0.0,
        min(1.0, evidence["signed_contrast"] / float(_REFINEMENT_CONFIG["signedContrastScale"])),
    )
    weights = _REFINEMENT_CONFIG["edgeObjectiveWeights"]
    return (
        float(weights["edgeStrength"]) * edge_strength
        + float(weights["edgeSupport"]) * evidence["support_ratio"]
        + float(weights["edgeContinuity"]) * evidence["longest_run_ratio"]
        + float(weights["gradientAlignment"]) * evidence["gradient_alignment"]
        + float(weights["signedContrast"]) * signed_contrast
    )


def _intersection(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    denominator = first[0] * second[1] - second[0] * first[1]
    if abs(denominator) < 1e-9:
        return np.array([np.nan, np.nan])
    return np.array(
        [
            (first[1] * second[2] - second[1] * first[2]) / denominator,
            (first[2] * second[0] - second[2] * first[0]) / denominator,
        ]
    )


def _geometry_is_valid(quad: np.ndarray, width: int, height: int) -> bool:
    if not np.isfinite(quad).all():
        return False
    area = 0.5 * abs(
        float(np.dot(quad[:, 0], np.roll(quad[:, 1], -1)) - np.dot(quad[:, 1], np.roll(quad[:, 0], -1)))
    )
    if area < width * height * 0.08:
        return False
    if np.any(quad[:, 0] < -width * 0.2) or np.any(quad[:, 0] > width * 1.2):
        return False
    if np.any(quad[:, 1] < -height * 0.2) or np.any(quad[:, 1] > height * 1.2):
        return False
    crosses = []
    for index in range(4):
        first = quad[(index + 1) % 4] - quad[index]
        second = quad[(index + 2) % 4] - quad[(index + 1) % 4]
        if np.linalg.norm(first) < min(width, height) * 0.1:
            return False
        crosses.append(first[0] * second[1] - first[1] * second[0])
    return all(value > 1e-6 for value in crosses) or all(value < -1e-6 for value in crosses)
