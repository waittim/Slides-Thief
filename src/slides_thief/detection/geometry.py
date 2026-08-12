"""Canonical quadrilateral geometry primitives for the detector."""

from __future__ import annotations

import math

import numpy as np

from .config import DETECTION_CONFIG

_GEOMETRY_CONFIG = DETECTION_CONFIG["geometry"]


def polygon_area(points: np.ndarray) -> float:
    """Return the absolute area of an ordered polygon."""

    if len(points) < 3:
        return 0.0
    return 0.5 * abs(
        float(np.dot(points[:, 0], np.roll(points[:, 1], -1))
        - np.dot(points[:, 1], np.roll(points[:, 0], -1)))
    )


def geometry_is_valid(quad: np.ndarray, width: int, height: int) -> bool:
    """Validate an ordered top-left, top-right, bottom-right, bottom-left quad."""

    if quad.shape != (4, 2) or not np.isfinite(quad).all():
        return False
    if polygon_area(quad) < width * height * float(_GEOMETRY_CONFIG["minimumAreaRatio"]):
        return False
    bounds_ratio = float(_GEOMETRY_CONFIG["boundsRatio"])
    if np.any(quad[:, 0] < -width * bounds_ratio) or np.any(quad[:, 0] > width * (1 + bounds_ratio)):
        return False
    if np.any(quad[:, 1] < -height * bounds_ratio) or np.any(quad[:, 1] > height * (1 + bounds_ratio)):
        return False

    edge_vectors = np.roll(quad, -1, axis=0) - quad
    edge_lengths = np.linalg.norm(edge_vectors, axis=1)
    if np.any(edge_lengths < min(width, height) * float(_GEOMETRY_CONFIG["minimumEdgeRatio"])):
        return False
    crosses = edge_vectors[:, 0] * np.roll(edge_vectors[:, 1], -1) - edge_vectors[:, 1] * np.roll(
        edge_vectors[:, 0], -1
    )
    if not (np.all(crosses > 1e-6) or np.all(crosses < -1e-6)):
        return False

    for index in range(4):
        previous = quad[(index + 3) % 4] - quad[index]
        following = quad[(index + 1) % 4] - quad[index]
        cosine = float(np.dot(previous, following) / max(1e-9, np.linalg.norm(previous) * np.linalg.norm(following)))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, cosine))))
        if angle < float(_GEOMETRY_CONFIG["minimumAngleDegrees"]) or angle > float(
            _GEOMETRY_CONFIG["maximumAngleDegrees"]
        ):
            return False
    return True


def line_intersection(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    """Intersect two homogeneous lines, returning NaN coordinates when parallel."""

    denominator = first[0] * second[1] - second[0] * first[1]
    if abs(denominator) < 1e-9:
        return np.array([np.nan, np.nan], dtype=np.float64)
    return np.array(
        [
            (first[1] * second[2] - second[1] * first[2]) / denominator,
            (first[2] * second[0] - second[2] * first[0]) / denominator,
        ],
        dtype=np.float64,
    )


def normalized_corner_distance(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean() / math.hypot(width, height))


def quad_iou(first: np.ndarray, second: np.ndarray) -> float:
    """Return exact IoU for two convex quads using polygon clipping."""

    intersection = _clip_convex_polygon(first, second)
    intersection_area = polygon_area(intersection)
    union_area = polygon_area(first) + polygon_area(second) - intersection_area
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


def _signed_polygon_area(points: np.ndarray) -> float:
    if len(points) < 3:
        return 0.0
    return 0.5 * float(
        np.dot(points[:, 0], np.roll(points[:, 1], -1))
        - np.dot(points[:, 1], np.roll(points[:, 0], -1))
    )
