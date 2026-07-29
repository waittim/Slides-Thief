"""Explainable confidence calibration from rank margin and detector agreement."""

from __future__ import annotations

import numpy as np

AUTO_REVIEW_CONFIDENCE = 0.68


def calculate_confidence(
    best: dict,
    second: dict | None,
    candidates: list[dict],
    width: int,
    height: int,
) -> dict:
    raw_margin = max(0.0, best["score"] - second["score"]) if second else best["score"]
    normalized_margin = min(1.0, max(0.0, raw_margin / 0.18))
    features = best["score_diagnostics"]["features"]
    edge_evidence = best["score_diagnostics"].get("edge_evidence", [])
    minimum_edge_support = (
        min(item.get("support_ratio", features["edge_support"]) for item in edge_evidence)
        if edge_evidence
        else features["edge_support"]
    )
    minimum_continuity = (
        min(item.get("longest_run_ratio", features["edge_continuity"]) for item in edge_evidence)
        if edge_evidence
        else features["edge_continuity"]
    )
    agreeing_methods = sorted(
        {
            candidate["method"]
            for candidate in candidates
            if candidate["method"] in {"contrast-lines", "mask-lines", "hough-lines"}
            and (
                candidate is best
                or (
                    _normalized_corner_distance(best["quad"], candidate["quad"], width, height) < 0.035
                    and quad_iou(best["quad"], candidate["quad"], width, height) > 0.9
                )
            )
        }
    )
    detector_agreement = 1.0 if len(agreeing_methods) >= 3 else 0.8 if len(agreeing_methods) == 2 else 0.2
    best_normalized_score = min(1.0, max(0.0, best["score"]))
    geometry_validity = min(1.0, max(0.0, features["geometry_validity"]))
    confidence = min(
        1.0,
        max(
            0.0,
            0.30 * best_normalized_score
            + 0.25 * normalized_margin
            + 0.20 * minimum_edge_support
            + 0.15 * detector_agreement
            + 0.10 * geometry_validity,
        ),
    )
    return {
        "best_normalized_score": float(best_normalized_score),
        "score_margin": float(raw_margin),
        "normalized_margin": float(normalized_margin),
        "minimum_edge_support": float(minimum_edge_support),
        "minimum_continuity": float(minimum_continuity),
        "detector_agreement": detector_agreement,
        "agreeing_methods": agreeing_methods,
        "geometry_validity": float(geometry_validity),
        "confidence": float(confidence),
    }


def is_ambiguous_candidate(second_best_iou: float, breakdown: dict) -> bool:
    return (
        breakdown["normalized_margin"] < 0.33
        and second_best_iou < 0.75
        and breakdown["detector_agreement"] < 0.8
    )


def _normalized_corner_distance(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean() / np.hypot(width, height))


def quad_iou(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    del width, height
    intersection = _clip_convex_polygon(first, second)
    intersection_area = _polygon_area(intersection)
    union_area = _polygon_area(first) + _polygon_area(second) - intersection_area
    return intersection_area / union_area if union_area > 0 else 0.0


def _clip_convex_polygon(subject: np.ndarray, clip: np.ndarray) -> np.ndarray:
    output = [np.asarray(point, dtype=np.float64) for point in subject]
    orientation = 1.0 if _signed_polygon_area(clip) >= 0 else -1.0
    for edge_index in range(len(clip)):
        edge_start = clip[edge_index]
        edge_end = clip[(edge_index + 1) % len(clip)]
        input_points = output
        output = []
        if not input_points:
            break
        previous = input_points[-1]
        previous_inside = _half_plane(previous, edge_start, edge_end) * orientation >= -1e-7
        for current in input_points:
            current_inside = _half_plane(current, edge_start, edge_end) * orientation >= -1e-7
            if current_inside:
                if not previous_inside:
                    output.append(_segment_line_intersection(previous, current, edge_start, edge_end))
                output.append(current)
            elif previous_inside:
                output.append(_segment_line_intersection(previous, current, edge_start, edge_end))
            previous = current
            previous_inside = current_inside
    return np.asarray(output, dtype=np.float64)


def _segment_line_intersection(
    start: np.ndarray,
    end: np.ndarray,
    line_start: np.ndarray,
    line_end: np.ndarray,
) -> np.ndarray:
    segment = end - start
    line = line_end - line_start
    denominator = segment[0] * line[1] - segment[1] * line[0]
    if abs(denominator) < 1e-9:
        return end
    offset = line_start - start
    fraction = (offset[0] * line[1] - offset[1] * line[0]) / denominator
    return start + segment * fraction


def _half_plane(point: np.ndarray, start: np.ndarray, end: np.ndarray) -> float:
    return float((end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]))


def _polygon_area(points: np.ndarray) -> float:
    return abs(_signed_polygon_area(points))


def _signed_polygon_area(points: np.ndarray) -> float:
    if len(points) < 3:
        return 0.0
    return 0.5 * float(
        np.dot(points[:, 0], np.roll(points[:, 1], -1))
        - np.dot(points[:, 1], np.roll(points[:, 0], -1))
    )
