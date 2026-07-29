"""Orientation-guided probabilistic Hough line and free-direction quad generation."""

from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np

from .gradient import GradientMap


ANGLE_STEP = math.pi / 90
RHO_STEP = 3.0


@dataclass
class Segment:
    line: np.ndarray
    angle: float
    normal_angle: float
    rho: float
    length: float
    support: float


def hough_quad_candidates(gradient: GradientMap) -> list[dict]:
    height, width = gradient.magnitude.shape
    points = _edge_points(gradient)
    if len(points) < 48:
        return []
    peaks = _vote(points, width, height)
    segments = _extract_segments(peaks, points, width, height)
    families = _cluster_directions(segments)
    if families is None:
        return []
    first_family, second_family = families
    family_angle = _orientation_difference(first_family[0], second_family[0])
    if family_angle < math.radians(35) or family_angle > math.radians(145):
        return []

    first_pairs = _line_pairs(first_family[1], width, height)
    second_pairs = _line_pairs(second_family[1], width, height)
    candidates = []
    for first_pair in first_pairs:
        for second_pair in second_pairs:
            corners = [
                _intersection(first_pair[0].line, second_pair[0].line),
                _intersection(first_pair[0].line, second_pair[1].line),
                _intersection(first_pair[1].line, second_pair[1].line),
                _intersection(first_pair[1].line, second_pair[0].line),
            ]
            quad = _order_quad(np.asarray(corners, dtype=np.float64))
            if not _coarse_geometry_valid(quad, width, height):
                continue
            area = _polygon_area(quad) / (width * height)
            supports = [segment.support for segment in (*first_pair, *second_pair)]
            candidates.append(
                {
                    "quad": quad,
                    "method": "hough-lines",
                    "detector_score": float(np.mean(supports) + min(0.8, area)),
                    "detector_diagnostics": {
                        "edge_point_count": len(points),
                        "hough_peak_count": len(peaks),
                        "segment_count": len(segments),
                        "family_angle_degrees": round(math.degrees(family_angle), 2),
                        "line_support": [round(value, 3) for value in supports],
                        "gradient_threshold": round(gradient.threshold, 4),
                        "gradient_scales": list(gradient.scales),
                    },
                }
            )

    candidates.sort(key=lambda item: item["detector_score"], reverse=True)
    selected = []
    for candidate in candidates:
        if any(_quad_distance(candidate["quad"], kept["quad"], width, height) < 0.012 for kept in selected):
            continue
        selected.append(candidate)
        if len(selected) >= 5:
            break
    return selected


def _edge_points(gradient: GradientMap) -> np.ndarray:
    ys, xs = np.nonzero(gradient.magnitude >= gradient.threshold)
    if len(xs) > 28000:
        keep = np.arange(len(xs)) % 2 == 0
        xs = xs[keep]
        ys = ys[keep]
    magnitude = gradient.magnitude[ys, xs]
    orientation = np.mod(gradient.orientation[ys, xs], math.pi)
    return np.column_stack((xs, ys, magnitude, orientation))


def _vote(points: np.ndarray, width: int, height: int) -> list[tuple[int, int, float]]:
    diagonal = math.hypot(width, height)
    angle_bins = 90
    rho_bins = math.ceil(diagonal * 2 / RHO_STEP) + 1
    accumulator = np.zeros((angle_bins, rho_bins), dtype=np.float64)
    center_indices = np.rint(points[:, 3] / ANGLE_STEP).astype(np.int32) % angle_bins
    weights = 0.35 + np.minimum(1.0, points[:, 2])
    for offset in (-2, -1, 0, 1, 2):
        angle_indices = (center_indices + offset) % angle_bins
        angles = angle_indices * ANGLE_STEP
        rho_indices = np.rint(
            (points[:, 0] * np.cos(angles) + points[:, 1] * np.sin(angles) + diagonal) / RHO_STEP
        ).astype(np.int32)
        np.add.at(accumulator, (angle_indices, rho_indices), weights)

    minimum_votes = max(8.0, min(width, height) * 0.018)
    angle_indices, rho_indices = np.nonzero(accumulator >= minimum_votes)
    candidates = sorted(
        (
            (int(angle_index), int(rho_index), float(accumulator[angle_index, rho_index]))
            for angle_index, rho_index in zip(angle_indices, rho_indices)
        ),
        key=lambda item: item[2],
        reverse=True,
    )
    peaks: list[tuple[int, int, float]] = []
    for candidate in candidates:
        if all(
            _circular_bin_distance(candidate[0], peak[0], angle_bins) > 2 or abs(candidate[1] - peak[1]) > 3
            for peak in peaks
        ):
            peaks.append(candidate)
        if len(peaks) >= 40:
            break
    return peaks


def _extract_segments(
    peaks: list[tuple[int, int, float]],
    points: np.ndarray,
    width: int,
    height: int,
) -> list[Segment]:
    diagonal = math.hypot(width, height)
    candidates = []
    for angle_index, rho_index, _ in peaks:
        normal_angle = angle_index * ANGLE_STEP
        normal = np.array([math.cos(normal_angle), math.sin(normal_angle)])
        direction = np.array([-normal[1], normal[0]])
        rho = rho_index * RHO_STEP - diagonal
        distances = np.abs(points[:, 0] * normal[0] + points[:, 1] * normal[1] - rho)
        alignment = np.minimum(
            np.abs(points[:, 3] - normal_angle),
            math.pi - np.abs(points[:, 3] - normal_angle),
        )
        support_points = points[(distances <= 2.75) & (alignment <= math.radians(12))]
        if len(support_points) < 8:
            continue
        projections = np.sort(support_points[:, 0] * direction[0] + support_points[:, 1] * direction[1])
        split_indices = np.flatnonzero(np.diff(projections) > max(5.0, diagonal * 0.012)) + 1
        for group in np.split(projections, split_indices):
            if len(group) < 2:
                continue
            length = float(group[-1] - group[0])
            if length < diagonal * 0.08:
                continue
            candidates.append(
                Segment(
                    np.array([normal[0], normal[1], -rho]),
                    (normal_angle + math.pi / 2) % math.pi,
                    normal_angle,
                    rho,
                    length,
                    min(1.0, len(group) / max(1.0, length / 2)),
                )
            )

    candidates.sort(key=lambda segment: segment.length * segment.support, reverse=True)
    selected = []
    for segment in candidates:
        if all(
            _orientation_difference(segment.normal_angle, kept.normal_angle) > math.radians(4)
            or abs(segment.rho - kept.rho) > 5
            for kept in selected
        ):
            selected.append(segment)
        if len(selected) >= 28:
            break
    return selected


def _cluster_directions(segments: list[Segment]) -> tuple[tuple[float, list[Segment]], tuple[float, list[Segment]]] | None:
    if len(segments) < 4:
        return None
    vectors = np.asarray([(math.cos(2 * segment.angle), math.sin(2 * segment.angle)) for segment in segments])
    first_center = vectors[0]
    second_center = vectors[np.argmax(np.sum((vectors - first_center) ** 2, axis=1))]
    centers = np.asarray([first_center, second_center])
    assignments = np.zeros(len(segments), dtype=np.int32)
    for _ in range(8):
        distances = np.sum((vectors[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        assignments = np.argmin(distances, axis=1)
        for family in (0, 1):
            indices = np.flatnonzero(assignments == family)
            if not len(indices):
                continue
            weights = np.asarray([segments[index].length * max(0.15, segments[index].support) for index in indices])
            centers[family] = np.average(vectors[indices], axis=0, weights=weights)
    grouped = [[segment for index, segment in enumerate(segments) if assignments[index] == family] for family in (0, 1)]
    if any(len(group) < 2 for group in grouped):
        return None
    angles = [math.atan2(center[1], center[0]) * 0.5 % math.pi for center in centers]
    return (angles[0], grouped[0]), (angles[1], grouped[1])


def _line_pairs(segments: list[Segment], width: int, height: int) -> list[tuple[Segment, Segment]]:
    center = np.array([width / 2, height / 2])
    positioned = [
        (
            segment,
            float(segment.line[0] * center[0] + segment.line[1] * center[1] + segment.line[2]),
        )
        for segment in segments
    ]
    pairs = []
    for first_index, first in enumerate(positioned):
        for second in positioned[first_index + 1 :]:
            separation = abs(first[1] - second[1])
            if separation < min(width, height) * 0.16:
                continue
            straddles = first[1] * second[1] <= 0
            score = (
                first[0].support
                + second[0].support
                + (first[0].length + second[0].length) / math.hypot(width, height)
                + (0.45 if straddles else 0)
            )
            pairs.append(((first[0], second[0]), score))
    pairs.sort(key=lambda item: item[1], reverse=True)
    return [pair for pair, _ in pairs[:6]]


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


def _order_quad(points: np.ndarray) -> np.ndarray:
    sums = points.sum(axis=1)
    differences = points[:, 0] - points[:, 1]
    return np.asarray(
        [points[np.argmin(sums)], points[np.argmax(differences)], points[np.argmax(sums)], points[np.argmin(differences)]]
    )


def _coarse_geometry_valid(quad: np.ndarray, width: int, height: int) -> bool:
    if not np.isfinite(quad).all() or _polygon_area(quad) < width * height * 0.08:
        return False
    if np.any(quad[:, 0] < -width * 0.2) or np.any(quad[:, 0] > width * 1.2):
        return False
    if np.any(quad[:, 1] < -height * 0.2) or np.any(quad[:, 1] > height * 1.2):
        return False
    crosses = []
    for index in range(4):
        first = quad[(index + 1) % 4] - quad[index]
        second = quad[(index + 2) % 4] - quad[(index + 1) % 4]
        crosses.append(first[0] * second[1] - first[1] * second[0])
    return all(value > 1e-6 for value in crosses) or all(value < -1e-6 for value in crosses)


def _polygon_area(quad: np.ndarray) -> float:
    return 0.5 * abs(
        float(np.dot(quad[:, 0], np.roll(quad[:, 1], -1)) - np.dot(quad[:, 1], np.roll(quad[:, 0], -1)))
    )


def _orientation_difference(first: float, second: float) -> float:
    difference = abs(first % math.pi - second % math.pi)
    return min(difference, math.pi - difference)


def _circular_bin_distance(first: int, second: int, count: int) -> int:
    difference = abs(first - second)
    return min(difference, count - difference)


def _quad_distance(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean() / math.hypot(width, height))
