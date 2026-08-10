"""Explainable P0 candidate validation, polarity evidence, and scoring."""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from .config import DETECTION_CONFIG
from .gradient import GradientMap

_GEOMETRY_CONFIG = DETECTION_CONFIG["geometry"]
_SCORING_CONFIG = DETECTION_CONFIG["scoring"]
_WEIGHTS = _SCORING_CONFIG["weights"]


def _sample_nearest(gray: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    height, width = gray.shape
    xi = np.clip(np.rint(xs).astype(np.int32), 0, width - 1)
    yi = np.clip(np.rint(ys).astype(np.int32), 0, height - 1)
    return gray[yi, xi]


def _polygon_area(quad: np.ndarray) -> float:
    return 0.5 * abs(
        float(np.dot(quad[:, 0], np.roll(quad[:, 1], -1)) - np.dot(quad[:, 1], np.roll(quad[:, 0], -1)))
    )


def _geometry_is_valid(quad: np.ndarray, width: int, height: int) -> bool:
    if not np.isfinite(quad).all() or _polygon_area(quad) < width * height * float(
        _GEOMETRY_CONFIG["minimumAreaRatio"]
    ):
        return False
    bounds_ratio = float(_GEOMETRY_CONFIG["boundsRatio"])
    if np.any(quad[:, 0] < -width * bounds_ratio) or np.any(quad[:, 0] > width * (1 + bounds_ratio)):
        return False
    if np.any(quad[:, 1] < -height * bounds_ratio) or np.any(quad[:, 1] > height * (1 + bounds_ratio)):
        return False
    crosses = []
    for index in range(4):
        first = quad[index]
        second = quad[(index + 1) % 4]
        third = quad[(index + 2) % 4]
        first_vector = second - first
        second_vector = third - second
        crosses.append(float(first_vector[0] * second_vector[1] - first_vector[1] * second_vector[0]))
        if np.linalg.norm(first_vector) < min(width, height) * float(_GEOMETRY_CONFIG["minimumEdgeRatio"]):
            return False
    if not (all(value > 1e-6 for value in crosses) or all(value < -1e-6 for value in crosses)):
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


def _longest_true_run(values: np.ndarray) -> int:
    longest = 0
    current = 0
    for value in values:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return longest


def evaluate_edge_evidence(
    gray: np.ndarray,
    start: np.ndarray,
    end: np.ndarray,
    gradient: GradientMap | None = None,
) -> dict:
    height, width = gray.shape
    edge = end - start
    length = float(np.linalg.norm(edge))
    count = max(
        int(_SCORING_CONFIG["edgeSampleMinimum"]),
        min(int(_SCORING_CONFIG["edgeSampleMaximum"]), round(length / float(_SCORING_CONFIG["edgeSamplesPerPixel"]))),
    )
    direction = edge / max(1e-9, length)
    normal = np.array([-direction[1], direction[0]])
    normal_angle = math.atan2(normal[1], normal[0])
    offset = max(
        float(_SCORING_CONFIG["normalOffsetMinimum"]),
        min(
            float(_SCORING_CONFIG["normalOffsetMaximum"]),
            min(width, height) * float(_SCORING_CONFIG["normalOffsetRatio"]),
        ),
    )
    fractions = (np.arange(count, dtype=np.float64) + 0.5) / count
    points = start[None, :] + edge[None, :] * fractions[:, None]
    inner = _sample_nearest(gray, points[:, 0] + normal[0] * offset, points[:, 1] + normal[1] * offset)
    outer = _sample_nearest(gray, points[:, 0] - normal[0] * offset, points[:, 1] - normal[1] * offset)
    differences = inner - outer
    contrast_threshold = float(_SCORING_CONFIG["contrastSupportThreshold"])
    positive = differences > contrast_threshold
    negative = differences < -contrast_threshold
    positive_ratio = float(positive.mean())
    negative_ratio = float(negative.mean())
    mixed = (
        abs(positive_ratio - negative_ratio) < float(_SCORING_CONFIG["mixedPolarityDelta"])
        and max(positive_ratio, negative_ratio) >= float(_SCORING_CONFIG["mixedPolarityMinimum"])
    )
    use_positive = positive_ratio >= negative_ratio
    contrast_supported = positive if use_positive else negative
    signed = differences if use_positive else -differences
    strengths = signed[signed > 0]
    polarity = "mixed" if mixed else ("inside-brighter" if use_positive else "inside-darker")

    if gradient is None:
        gradient_strengths = np.zeros(count, dtype=np.float64)
        gradient_alignments = np.zeros(count, dtype=np.float64)
        gradient_offsets = np.zeros(count, dtype=np.float64)
        gradient_supported = np.zeros(count, dtype=bool)
    else:
        gradient_strengths = np.zeros(count, dtype=np.float64)
        gradient_alignments = np.zeros(count, dtype=np.float64)
        gradient_offsets = np.zeros(count, dtype=np.float64)
        best_aligned = np.zeros(count, dtype=np.float64)
        for normal_offset in range(-4, 5):
            xs = points[:, 0] + normal[0] * normal_offset
            ys = points[:, 1] + normal[1] * normal_offset
            sampled_strength = _sample_nearest(gradient.magnitude, xs, ys)
            sampled_orientation = _sample_nearest(gradient.orientation, xs, ys)
            alignment = np.abs(np.cos(sampled_orientation - normal_angle))
            aligned_strength = sampled_strength * (0.35 + 0.65 * alignment)
            replace = aligned_strength > best_aligned
            best_aligned[replace] = aligned_strength[replace]
            gradient_strengths[replace] = sampled_strength[replace]
            gradient_alignments[replace] = alignment[replace]
            gradient_offsets[replace] = normal_offset
        gradient_threshold = max(
            float(_SCORING_CONFIG["gradientSupportFloor"]),
            gradient.threshold * float(_SCORING_CONFIG["gradientSupportScale"]),
        )
        gradient_supported = gradient_strengths >= gradient_threshold
        gradient_supported &= gradient_alignments >= float(_SCORING_CONFIG["gradientAlignmentMinimum"])

    supported = gradient_supported | contrast_supported
    longest_run_ratio = _longest_true_run(supported) / count
    largest_gap_ratio = _longest_true_run(~supported) / count
    return {
        "polarity": polarity,
        "mean_strength": float(gradient_strengths.mean()),
        "median_strength": float(
            np.percentile(gradient_strengths, float(_SCORING_CONFIG["medianPercentile"]) * 100)
        ),
        "median_contrast": float(
            np.percentile(strengths, float(_SCORING_CONFIG["medianPercentile"]) * 100)
        ) if len(strengths) else 0.0,
        "percentile_contrast": float(
            np.percentile(strengths, float(_SCORING_CONFIG["contrastPercentile"]) * 100)
        ) if len(strengths) else 0.0,
        "support_ratio": float(supported.mean()) * (
            float(_SCORING_CONFIG["mixedPolarityScale"]) if mixed else 1.0
        ),
        "longest_run_ratio": longest_run_ratio,
        "largest_gap_ratio": largest_gap_ratio,
        "gradient_alignment": float(gradient_alignments.mean()),
        "localization_offset": float(
            np.percentile(np.abs(gradient_offsets), float(_SCORING_CONFIG["medianPercentile"]) * 100)
        ),
        "signed_contrast": float(
            np.percentile(signed, float(_SCORING_CONFIG["medianPercentile"]) * 100)
        ),
        "continuity": longest_run_ratio,
    }


def _point_mask_for_quad(quad: np.ndarray, width: int, height: int) -> np.ndarray:
    mask = Image.new("1", (width, height))
    ImageDraw.Draw(mask).polygon([tuple(point) for point in quad], fill=1)
    return np.asarray(mask, dtype=bool)


def score_quad_candidate(
    gray: np.ndarray,
    quad: np.ndarray,
    ratio: float,
    gradient: GradientMap | None = None,
    batch_consistency: float = 0.0,
) -> tuple[float, dict] | None:
    height, width = gray.shape
    if not _geometry_is_valid(quad, width, height):
        return None
    evidence = [evaluate_edge_evidence(gray, quad[index], quad[(index + 1) % 4], gradient) for index in range(4)]
    if any(item["support_ratio"] < float(_SCORING_CONFIG["minimumEdgeSupport"]) for item in evidence):
        return None

    area_norm = _polygon_area(quad) / (width * height)
    top_len = float(np.linalg.norm(quad[1] - quad[0]))
    bottom_len = float(np.linalg.norm(quad[2] - quad[3]))
    left_len = float(np.linalg.norm(quad[3] - quad[0]))
    right_len = float(np.linalg.norm(quad[2] - quad[1]))
    aspect = ((top_len + bottom_len) / 2) / max(1.0, (left_len + right_len) / 2)
    mask = _point_mask_for_quad(quad, width, height)
    step = max(3, round(max(width, height) / float(_SCORING_CONFIG["regionSamplingDivisor"])))
    sampled_gray = gray[::step, ::step]
    sampled_mask = mask[::step, ::step]
    inside = sampled_gray[sampled_mask]
    outside = sampled_gray[~sampled_mask]
    if len(inside) and len(outside):
        distribution_difference = min(
            1.0,
            abs(float(inside.mean() - outside.mean())) / float(_SCORING_CONFIG["regionDifferenceScale"]),
        )
        inside_consistency = 1 - min(1.0, float(inside.std()) / float(_SCORING_CONFIG["regionConsistencyScale"]))
        region_consistency = (
            float(_SCORING_CONFIG["regionDistributionWeight"]) * distribution_difference
            + float(_SCORING_CONFIG["regionInsideConsistencyWeight"]) * inside_consistency
        )
    else:
        region_consistency = 0.0

    features = {
        "edge_strength": float(
            np.mean(
                [
                    (
                        float(_SCORING_CONFIG["edgeStrengthGradientWeight"])
                        * min(
                            1.0,
                            item["median_strength"]
                            / max(
                                float(_SCORING_CONFIG["gradientEdgeStrengthFloor"]),
                                gradient.threshold * float(_SCORING_CONFIG["gradientEdgeStrengthScale"]),
                            ),
                        )
                        + float(_SCORING_CONFIG["edgeStrengthContrastWeight"])
                        * min(1.0, item["percentile_contrast"] / float(_SCORING_CONFIG["contrastEdgeStrengthScale"]))
                        if gradient is not None
                        else min(1.0, item["percentile_contrast"] / float(_SCORING_CONFIG["contrastEdgeStrengthScale"]))
                    )
                    for item in evidence
                ]
            )
        ),
        "edge_support": float(np.mean([item["support_ratio"] for item in evidence])),
        "edge_continuity": float(
            np.mean(
                [
                    item["longest_run_ratio"]
                    * (1 - item["largest_gap_ratio"] * float(_SCORING_CONFIG["continuityGapWeight"]))
                    for item in evidence
                ]
            )
        ),
        "gradient_alignment": float(np.mean([item["gradient_alignment"] for item in evidence])),
        "inside_outside_difference": float(
            np.mean(
                [
                    min(1.0, item["median_contrast"] / float(_SCORING_CONFIG["insideOutsideContrastScale"]))
                    for item in evidence
                ]
            )
        ),
        "region_consistency": region_consistency,
        "normalized_area": min(1.0, area_norm / float(_SCORING_CONFIG["normalizedAreaTarget"])),
        "geometry_validity": 1.0,
        "aspect_prior": math.exp(-abs(math.log(max(0.05, aspect / ratio)))),
        "batch_consistency": batch_consistency,
    }
    warnings = []
    if any(item["polarity"] == "mixed" for item in evidence):
        warnings.append("mixed_edge_polarity")
    if any(
        item["longest_run_ratio"] < float(_SCORING_CONFIG["edgeContinuityWarning"])
        for item in evidence
    ):
        warnings.append("weak_edge_continuity")

    score = (
        float(_WEIGHTS["edgeStrength"]) * features["edge_strength"]
        + float(_WEIGHTS["edgeSupport"]) * features["edge_support"]
        + float(_WEIGHTS["edgeContinuity"]) * features["edge_continuity"]
        + float(_WEIGHTS["gradientAlignment"]) * features["gradient_alignment"]
        + float(_WEIGHTS["insideOutsideDifference"]) * features["inside_outside_difference"]
        + float(_WEIGHTS["regionConsistency"]) * features["region_consistency"]
        + float(_WEIGHTS["geometryValidity"]) * features["geometry_validity"]
        + float(_WEIGHTS["normalizedArea"]) * features["normalized_area"]
        + float(_WEIGHTS["aspectPrior"]) * features["aspect_prior"]
        + float(_WEIGHTS["batchConsistency"]) * features["batch_consistency"]
    )
    return score, {
        "features": features,
        "edge_evidence": evidence,
        "warnings": warnings,
        "aspect_est": round(aspect, 3),
        "area_norm": round(area_norm, 3),
    }


def normalized_quad_distance(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean() / math.hypot(width, height))
