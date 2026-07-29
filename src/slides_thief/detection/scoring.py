"""Explainable P0 candidate validation, polarity evidence, and scoring."""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw


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
    if not np.isfinite(quad).all() or _polygon_area(quad) < width * height * 0.08:
        return False
    if np.any(quad[:, 0] < -width * 0.2) or np.any(quad[:, 0] > width * 1.2):
        return False
    if np.any(quad[:, 1] < -height * 0.2) or np.any(quad[:, 1] > height * 1.2):
        return False
    crosses = []
    for index in range(4):
        first = quad[index]
        second = quad[(index + 1) % 4]
        third = quad[(index + 2) % 4]
        first_vector = second - first
        second_vector = third - second
        crosses.append(float(first_vector[0] * second_vector[1] - first_vector[1] * second_vector[0]))
        if np.linalg.norm(first_vector) < min(width, height) * 0.1:
            return False
    if not (all(value > 1e-6 for value in crosses) or all(value < -1e-6 for value in crosses)):
        return False
    for index in range(4):
        previous = quad[(index + 3) % 4] - quad[index]
        following = quad[(index + 1) % 4] - quad[index]
        cosine = float(np.dot(previous, following) / max(1e-9, np.linalg.norm(previous) * np.linalg.norm(following)))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, cosine))))
        if angle < 12 or angle > 168:
            return False
    return True


def _longest_true_run(values: np.ndarray) -> int:
    longest = 0
    current = 0
    for value in values:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return longest


def _edge_evidence(gray: np.ndarray, start: np.ndarray, end: np.ndarray) -> dict:
    height, width = gray.shape
    edge = end - start
    length = float(np.linalg.norm(edge))
    count = max(64, min(144, round(length / 4)))
    direction = edge / max(1e-9, length)
    normal = np.array([-direction[1], direction[0]])
    offset = max(3.0, min(8.0, min(width, height) * 0.012))
    fractions = (np.arange(count, dtype=np.float64) + 0.5) / count
    points = start[None, :] + edge[None, :] * fractions[:, None]
    inner = _sample_nearest(gray, points[:, 0] + normal[0] * offset, points[:, 1] + normal[1] * offset)
    outer = _sample_nearest(gray, points[:, 0] - normal[0] * offset, points[:, 1] - normal[1] * offset)
    differences = inner - outer
    positive = differences > 3
    negative = differences < -3
    positive_ratio = float(positive.mean())
    negative_ratio = float(negative.mean())
    mixed = abs(positive_ratio - negative_ratio) < 0.08 and max(positive_ratio, negative_ratio) >= 0.18
    use_positive = positive_ratio >= negative_ratio
    supported = positive if use_positive else negative
    strengths = differences if use_positive else -differences
    strengths = strengths[strengths > 0]
    polarity = "mixed" if mixed else ("inside-brighter" if use_positive else "inside-darker")
    return {
        "polarity": polarity,
        "median_contrast": float(np.percentile(strengths, 50)) if len(strengths) else 0.0,
        "percentile_contrast": float(np.percentile(strengths, 72)) if len(strengths) else 0.0,
        "support_ratio": max(positive_ratio, negative_ratio) * (0.72 if mixed else 1.0),
        "continuity": _longest_true_run(supported) / count,
    }


def _point_mask_for_quad(quad: np.ndarray, width: int, height: int) -> np.ndarray:
    mask = Image.new("1", (width, height))
    ImageDraw.Draw(mask).polygon([tuple(point) for point in quad], fill=1)
    return np.asarray(mask, dtype=bool)


def score_quad_candidate(gray: np.ndarray, quad: np.ndarray, ratio: float) -> tuple[float, dict] | None:
    height, width = gray.shape
    if not _geometry_is_valid(quad, width, height):
        return None
    evidence = [_edge_evidence(gray, quad[index], quad[(index + 1) % 4]) for index in range(4)]
    if any(item["support_ratio"] < 0.18 for item in evidence):
        return None

    area_norm = _polygon_area(quad) / (width * height)
    top_len = float(np.linalg.norm(quad[1] - quad[0]))
    bottom_len = float(np.linalg.norm(quad[2] - quad[3]))
    left_len = float(np.linalg.norm(quad[3] - quad[0]))
    right_len = float(np.linalg.norm(quad[2] - quad[1]))
    aspect = ((top_len + bottom_len) / 2) / max(1.0, (left_len + right_len) / 2)
    mask = _point_mask_for_quad(quad, width, height)
    step = max(3, round(max(width, height) / 90))
    sampled_gray = gray[::step, ::step]
    sampled_mask = mask[::step, ::step]
    inside = sampled_gray[sampled_mask]
    outside = sampled_gray[~sampled_mask]
    if len(inside) and len(outside):
        distribution_difference = min(1.0, abs(float(inside.mean() - outside.mean())) / 72)
        inside_consistency = 1 - min(1.0, float(inside.std()) / 90)
        region_consistency = 0.65 * distribution_difference + 0.35 * inside_consistency
    else:
        region_consistency = 0.0

    features = {
        "edge_strength": float(np.mean([min(1.0, item["percentile_contrast"] / 42) for item in evidence])),
        "edge_support": float(np.mean([item["support_ratio"] for item in evidence])),
        "edge_continuity": float(np.mean([item["continuity"] for item in evidence])),
        "gradient_alignment": 0.0,
        "inside_outside_difference": float(
            np.mean([min(1.0, item["median_contrast"] / 32) for item in evidence])
        ),
        "region_consistency": region_consistency,
        "normalized_area": min(1.0, area_norm / 0.78),
        "geometry_validity": 1.0,
        "aspect_prior": math.exp(-abs(math.log(max(0.05, aspect / ratio)))),
        "batch_consistency": 0.0,
    }
    score = (
        0.30 * features["edge_strength"]
        + 0.22 * features["edge_support"]
        + 0.16 * features["inside_outside_difference"]
        + 0.12 * features["region_consistency"]
        + 0.10 * features["geometry_validity"]
        + 0.07 * features["normalized_area"]
        + 0.03 * features["aspect_prior"]
    )
    return score, {
        "features": features,
        "edge_evidence": evidence,
        "aspect_est": round(aspect, 3),
        "area_norm": round(area_norm, 3),
    }


def normalized_quad_distance(first: np.ndarray, second: np.ndarray, width: int, height: int) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean() / math.hypot(width, height))
