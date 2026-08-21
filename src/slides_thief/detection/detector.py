"""Core quadrilateral detector combining contrast edge search, gradient Hough candidates, batch priors, and score refinement."""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageFilter, ImageOps

from ..geometry import Line, intersect, order_quad, robust_fit
from .batch_prior import batch_prior_candidates
from .candidate_factory import make_candidate
from .confidence import (
    AUTO_REVIEW_CONFIDENCE,
    calculate_confidence,
    is_ambiguous_candidate,
)
from .config import DETECTION_CONFIG
from .geometry import normalized_corner_distance, polygon_area, quad_iou
from .gradient import build_gradient_pyramid
from .hough_lines import hough_quad_candidates
from .image_sizing import DETECTION_MAX_SIDE, constrained_image_size
from .numeric import average, percentile
from .refine import refine_quad
from .scoring import score_quad_candidate

DETECTION_MAX_PIXELS = 1_200_000
_CONTRAST_CONFIG = DETECTION_CONFIG["contrastLines"]
_MASK_CONFIG = DETECTION_CONFIG["maskLines"]
_DEDUP_CONFIG = DETECTION_CONFIG["deduplication"]
_FALLBACK_CONFIG = DETECTION_CONFIG["fallback"]


def box_blur(gray: np.ndarray, radius: int = 5) -> np.ndarray:
    # Two cumulative-sum passes keep the detector quick without SciPy/OpenCV.
    arr = gray.astype(np.float64)
    window_size = radius * 2 + 1
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (radius, radius)
        padded = np.pad(arr, pad, mode="edge")
        csum = np.cumsum(padded, axis=axis)

        # The leading zero makes each difference represent a complete window
        # starting at the corresponding output coordinate. Without it, the
        # first padded sample is skipped and the result loses one element.
        zero_shape = list(csum.shape)
        zero_shape[axis] = 1
        csum = np.concatenate((np.zeros(zero_shape, dtype=csum.dtype), csum), axis=axis)

        head_indices = [slice(None)] * arr.ndim
        tail_indices = [slice(None)] * arr.ndim
        head_indices[axis] = slice(window_size, None)
        tail_indices[axis] = slice(None, -window_size)
        arr = (csum[tuple(head_indices)] - csum[tuple(tail_indices)]) / window_size
    return arr


def sample_nearest(gray: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    xi = np.clip(np.rint(xs).astype(np.int32), 0, w - 1)
    yi = np.clip(np.rint(ys).astype(np.int32), 0, h - 1)
    return gray[yi, xi]


def contrast_score(diff: np.ndarray) -> float:
    if len(diff) == 0:
        return 0.0
    scores = []
    for signed in (diff, -diff):
        positive = signed[signed > 0]
        if len(positive) < max(
            int(_CONTRAST_CONFIG["minimumPositiveCount"]),
            len(diff) * float(_CONTRAST_CONFIG["minimumPositiveFraction"]),
        ):
            scores.append(0.0)
        else:
            scores.append(
                float(
                    percentile(positive, float(_CONTRAST_CONFIG["positivePercentile"]))
                    + average(positive) * float(_CONTRAST_CONFIG["positiveMeanWeight"])
                )
            )
    return max(scores)


def horizontal_edge_candidates(
    gray: np.ndarray,
    kind: str,
    limit: int | None = None,
) -> list[tuple[Line, float]]:
    limit = int(_CONTRAST_CONFIG["candidateLimit"]) if limit is None else int(limit)
    h, w = gray.shape
    xs = np.linspace(w * 0.16, w * 0.88, int(_CONTRAST_CONFIG["horizontalSampleCount"]))
    x_center = w / 2.0
    offset = max(float(_CONTRAST_CONFIG["minimumOffset"]), h * float(_CONTRAST_CONFIG["horizontalOffsetRatio"]))
    if kind == "top":
        start, end = _CONTRAST_CONFIG["topRange"]
        y_values = np.arange(
            h * float(start),
            h * float(end),
            max(2, h // int(_CONTRAST_CONFIG["horizontalStepDivisor"])),
        )
    else:
        start, end = _CONTRAST_CONFIG["bottomRange"]
        y_values = np.arange(
            h * float(start),
            h * float(end),
            max(2, h // int(_CONTRAST_CONFIG["horizontalStepDivisor"])),
        )

    candidates: list[tuple[Line, float, float, float]] = []
    for slope in np.linspace(
        float(_CONTRAST_CONFIG["horizontalSlopeRange"][0]),
        float(_CONTRAST_CONFIG["horizontalSlopeRange"][1]),
        int(_CONTRAST_CONFIG["horizontalSlopeCount"]),
    ):
        for y0 in y_values:
            ys = slope * (xs - x_center) + y0
            valid = (ys > offset + 1) & (ys < h - offset - 1)
            if valid.mean() < float(_CONTRAST_CONFIG["horizontalValidFraction"]):
                continue
            if kind == "top":
                diff = sample_nearest(gray, xs[valid], ys[valid] + offset) - sample_nearest(
                    gray, xs[valid], ys[valid] - offset
                )
            else:
                diff = sample_nearest(gray, xs[valid], ys[valid] - offset) - sample_nearest(
                    gray, xs[valid], ys[valid] + offset
                )
            score = contrast_score(diff)
            if score > float(_CONTRAST_CONFIG["minimumScore"]):
                candidates.append((Line(float(-slope), 1.0, float(slope * x_center - y0)), score, float(y0), float(slope)))

    candidates.sort(key=lambda item: item[1], reverse=True)
    selected: list[tuple[Line, float, float, float]] = []
    for candidate in candidates:
        _, _, y0, slope = candidate
        if all(
            abs(y0 - kept[2]) > h * float(_CONTRAST_CONFIG["positionDeduplicationRatio"])
            or abs(slope - kept[3]) > float(_CONTRAST_CONFIG["horizontalSlopeGap"])
            for kept in selected
        ):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return [(line, score) for line, score, _, _ in selected]


def best_horizontal_edge(gray: np.ndarray, kind: str) -> tuple[Line, float] | None:
    candidates = horizontal_edge_candidates(gray, kind, limit=1)
    return candidates[0] if candidates else None


def vertical_edge_candidates(
    gray: np.ndarray,
    kind: str,
    limit: int | None = None,
) -> list[tuple[Line, float]]:
    limit = int(_CONTRAST_CONFIG["candidateLimit"]) if limit is None else int(limit)
    h, w = gray.shape
    ys = np.linspace(h * 0.18, h * 0.84, int(_CONTRAST_CONFIG["verticalSampleCount"]))
    y_center = h / 2.0
    offset = max(float(_CONTRAST_CONFIG["minimumOffset"]), w * float(_CONTRAST_CONFIG["verticalOffsetRatio"]))
    if kind == "left":
        start, end = _CONTRAST_CONFIG["leftRange"]
        x_values = np.arange(
            w * float(start),
            w * float(end),
            max(2, w // int(_CONTRAST_CONFIG["verticalStepDivisor"])),
        )
    else:
        start, end = _CONTRAST_CONFIG["rightRange"]
        x_values = np.arange(
            w * float(start),
            w * float(end),
            max(2, w // int(_CONTRAST_CONFIG["verticalStepDivisor"])),
        )

    candidates: list[tuple[Line, float, float, float]] = []
    for slope in np.linspace(
        float(_CONTRAST_CONFIG["verticalSlopeRange"][0]),
        float(_CONTRAST_CONFIG["verticalSlopeRange"][1]),
        int(_CONTRAST_CONFIG["verticalSlopeCount"]),
    ):
        for x0 in x_values:
            xs = slope * (ys - y_center) + x0
            valid = (xs > offset + 1) & (xs < w - offset - 1)
            if valid.mean() < float(_CONTRAST_CONFIG["verticalValidFraction"]):
                continue
            if kind == "left":
                diff = sample_nearest(gray, xs[valid] + offset, ys[valid]) - sample_nearest(
                    gray, xs[valid] - offset, ys[valid]
                )
            else:
                diff = sample_nearest(gray, xs[valid] - offset, ys[valid]) - sample_nearest(
                    gray, xs[valid] + offset, ys[valid]
                )
            score = contrast_score(diff)
            if score > float(_CONTRAST_CONFIG["minimumScore"]):
                candidates.append((Line(1.0, float(-slope), float(slope * y_center - x0)), score, float(x0), float(slope)))

    candidates.sort(key=lambda item: item[1], reverse=True)
    selected: list[tuple[Line, float, float, float]] = []
    for candidate in candidates:
        _, _, x0, slope = candidate
        if all(
            abs(x0 - kept[2]) > w * float(_CONTRAST_CONFIG["positionDeduplicationRatio"])
            or abs(slope - kept[3]) > float(_CONTRAST_CONFIG["verticalSlopeGap"])
            for kept in selected
        ):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return [(line, score) for line, score, _, _ in selected]


def best_vertical_edge(gray: np.ndarray, kind: str) -> tuple[Line, float] | None:
    candidates = vertical_edge_candidates(gray, kind, limit=1)
    return candidates[0] if candidates else None


def contrast_quad(gray: np.ndarray, ratio: float) -> tuple[np.ndarray, dict] | None:
    h, w = gray.shape
    candidate_limit = int(_CONTRAST_CONFIG["candidateLimit"])
    tops = horizontal_edge_candidates(gray, "top", limit=candidate_limit)
    bottoms = horizontal_edge_candidates(gray, "bottom", limit=candidate_limit)
    lefts = vertical_edge_candidates(gray, "left", limit=candidate_limit)
    rights = vertical_edge_candidates(gray, "right", limit=candidate_limit)
    if not all([tops, bottoms, lefts, rights]):
        return None

    best: tuple[float, np.ndarray, list[float], float, float] | None = None
    for top, top_score in tops:
        for bottom, bottom_score in bottoms:
            if bottom.y_at(w / 2.0) <= top.y_at(w / 2.0) + h * float(
                _CONTRAST_CONFIG["topBottomSeparationRatio"]
            ):
                continue
            for left, left_score in lefts:
                for right, right_score in rights:
                    if right.x_at(h / 2.0) <= left.x_at(h / 2.0) + w * float(
                        _CONTRAST_CONFIG["leftRightSeparationRatio"]
                    ):
                        continue
                    quad = order_quad(
                        np.vstack(
                            [
                                intersect(top, left),
                                intersect(top, right),
                                intersect(bottom, right),
                                intersect(bottom, left),
                            ]
                        )
                    )
                    if not np.isfinite(quad).all():
                        continue
                    if np.any(quad[:, 0] < -w * 0.18) or np.any(quad[:, 0] > w * 1.18):
                        continue
                    if np.any(quad[:, 1] < -h * 0.18) or np.any(quad[:, 1] > h * 1.18):
                        continue

                    top_len = float(np.linalg.norm(quad[1] - quad[0]))
                    bottom_len = float(np.linalg.norm(quad[2] - quad[3]))
                    left_len = float(np.linalg.norm(quad[3] - quad[0]))
                    right_len = float(np.linalg.norm(quad[2] - quad[1]))
                    mean_width = (top_len + bottom_len) / 2.0
                    mean_height = (left_len + right_len) / 2.0
                    aspect_est = mean_width / max(1.0, mean_height)
                    area = polygon_area(quad)
                    area_norm = area / (w * h)
                    if area_norm < float(_CONTRAST_CONFIG["minimumAreaRatio"]) or not (
                        ratio * float(_CONTRAST_CONFIG["aspectMinimumRatio"])
                        <= aspect_est
                        <= ratio * float(_CONTRAST_CONFIG["aspectMaximumRatio"])
                    ):
                        continue
                    aspect_error = abs(math.log(max(0.05, aspect_est / ratio)))
                    edge_score = average([top_score, bottom_score, left_score, right_score])
                    total = edge_score + 10.0 * area_norm - aspect_error
                    if best is None or total > best[0]:
                        best = (total, quad, [top_score, bottom_score, left_score, right_score], aspect_est, area_norm)

    if best is None:
        return None

    _, quad, scores, aspect_est, area_norm = best

    diagnostics = {
        "method": "contrast-lines",
        "confidence": round(float(min(1.0, 0.42 + average(scores) / 65.0 + area_norm * 0.25)), 3),
        "contrast_scores": [round(float(score), 2) for score in scores],
        "aspect_est": round(float(aspect_est), 3),
        "area_norm": round(float(area_norm), 3),
    }
    return quad, diagnostics


def detect_quad(
    image: Image.Image,
    ratio: float,
    max_width: int = 1200,
    manual_quad: list[list[float]] | None = None,
    batch_priors: list[dict] | None = None,
    enable_batch_prior: bool = False,
    max_pixels: int = DETECTION_MAX_PIXELS,
    max_side: int = DETECTION_MAX_SIDE,
) -> tuple[np.ndarray, dict]:
    if manual_quad:
        return np.asarray(manual_quad, dtype=np.float64), {
            "method": "manual",
            "confidence": 1.0,
            "needs_review": False,
            "review_reasons": [],
            "best_score": 1.0,
            "second_best_score": None,
            "candidates_evaluated": 1,
            "diagnostics": {},
        }

    orig_w, orig_h = image.size
    constrained = constrained_image_size(orig_w, orig_h, max_width, max_pixels, max_side)
    small = image.convert("RGB")
    if (small.width, small.height) != (constrained.width, constrained.height):
        small = small.resize((constrained.width, constrained.height), Image.Resampling.LANCZOS)

    detection_to_source = np.array(
        [orig_w / small.width, orig_h / small.height],
        dtype=np.float64,
    )

    rgb_small = np.asarray(small, dtype=np.float64)
    gray_img = ImageOps.grayscale(small).filter(ImageFilter.GaussianBlur(radius=2.0))
    gray = np.asarray(gray_img, dtype=np.float64)
    h, w = gray.shape

    contrast_result = contrast_quad(gray, ratio)
    gradient = build_gradient_pyramid(rgb_small)
    hough_candidates = hough_quad_candidates(gradient)

    # Projected slides/screens in this set are mostly neutral gray, while the
    # wall, curtains, and audience are either saturated or dark. Segmenting the
    # low-saturation screen body gives a better document boundary than raw
    # brightness, especially when the cyan wall is brighter than the slide.
    _p05, p25, p55, p92 = [
        percentile(gray, fraction)
        for fraction in (
            0.05,
            float(_MASK_CONFIG["grayPercentiles"]["lower"]),
            float(_MASK_CONFIG["grayPercentiles"]["threshold"]),
            float(_MASK_CONFIG["grayPercentiles"]["highlight"]),
        )
    ]
    rgb_max = rgb_small.max(axis=2)
    rgb_min = rgb_small.min(axis=2)
    sat = np.divide(
        (rgb_max - rgb_min) * 255.0,
        rgb_max,
        out=np.zeros_like(rgb_max),
        where=rgb_max > 1.0,
    )
    threshold = max(
        float(_MASK_CONFIG["primaryMinimumGray"]),
        min(
            p55 - float(_MASK_CONFIG["thresholdOffset"]),
            p25 + (p92 - p25) * float(_MASK_CONFIG["thresholdRangeScale"]),
        ),
    )
    sat_threshold = float(
        max(
            float(_MASK_CONFIG["primarySaturationMinimum"]),
            min(
                float(_MASK_CONFIG["primarySaturationMaximum"]),
                percentile(sat, float(_MASK_CONFIG["primarySaturationPercentile"]))
                + float(_MASK_CONFIG["primarySaturationOffset"]),
            ),
        )
    )
    mask = (gray > threshold) & (sat < sat_threshold)

    # Bring bright white text back into the same component without letting the
    # cyan wall dominate the top edge.
    mask = mask | (
        (gray > max(float(_MASK_CONFIG["highlightMinimumGray"]), p92 * float(_MASK_CONFIG["highlightGrayScale"])))
        & (sat < sat_threshold + float(_MASK_CONFIG["highlightSaturationOffset"]))
    )

    density = box_blur(mask.astype(np.float64), radius=max(3, round(w * float(_MASK_CONFIG["densityBlurRatio"]))))

    left_pts: list[tuple[float, float]] = []
    right_pts: list[tuple[float, float]] = []
    top_pts: list[tuple[float, float]] = []
    bottom_pts: list[tuple[float, float]] = []

    row_min = max(0, int(h * 0.04))
    row_max = min(h, int(h * 0.96))
    for y in range(row_min, row_max, int(_MASK_CONFIG["scanStep"])):
        row = density[y]
        active = np.flatnonzero(row > float(_MASK_CONFIG["densityThreshold"]))
        if len(active) < w * float(_MASK_CONFIG["rowActiveFraction"]):
            continue
        x1, x2 = int(active[0]), int(active[-1])
        if x2 - x1 < w * float(_MASK_CONFIG["rowSpanFraction"]):
            continue
        # Ignore isolated bright text by requiring a reasonably dense span.
        if row[x1:x2 + 1].mean() < float(_MASK_CONFIG["rowDensityFraction"]):
            continue
        left_pts.append((x1, y))
        right_pts.append((x2, y))

    col_min = max(0, int(w * 0.04))
    col_max = min(w, int(w * 0.96))
    for x in range(col_min, col_max, int(_MASK_CONFIG["scanStep"])):
        col = density[:, x]
        active = np.flatnonzero(col > float(_MASK_CONFIG["densityThreshold"]))
        if len(active) < h * float(_MASK_CONFIG["columnActiveFraction"]):
            continue
        y1, y2 = int(active[0]), int(active[-1])
        if y2 - y1 < h * float(_MASK_CONFIG["columnSpanFraction"]):
            continue
        if col[y1:y2 + 1].mean() < float(_MASK_CONFIG["columnDensityFraction"]):
            continue
        top_pts.append((x, y1))
        bottom_pts.append((x, y2))

    left = robust_fit(left_pts, "x")
    right = robust_fit(right_pts, "x")
    top = robust_fit(top_pts, "y")
    bottom = robust_fit(bottom_pts, "y")

    method = "mask-lines"
    if not all([left, right, top, bottom]):
        method = "fallback-frame"
        margin_x = w * float(_FALLBACK_CONFIG["marginXRatio"])
        margin_y = h * float(_FALLBACK_CONFIG["marginYRatio"])
        left = Line(1.0, 0.0, -margin_x)
        right = Line(1.0, 0.0, -(w - margin_x))
        top = Line(0.0, 1.0, -margin_y)
        bottom = Line(0.0, 1.0, -(h - margin_y))

    quad = order_quad(np.vstack([intersect(top, left), intersect(top, right), intersect(bottom, right), intersect(bottom, left)]))

    if not np.isfinite(quad).all():
        method = "fallback-frame"
        margin_x = w * 0.03
        margin_y = h * 0.04
        quad = np.array(
            [
                [margin_x, margin_y],
                [w - margin_x, margin_y],
                [w - margin_x, h - margin_y],
                [margin_x, h - margin_y],
            ],
            dtype=np.float64,
        )

    raw_candidates: list[dict] = []
    if contrast_result is not None:
        contrast_quad_value, contrast_diagnostics = contrast_result
        raw_candidates.append(
            make_candidate(
                contrast_quad_value,
                "contrast-lines",
                {
                    key: value
                    for key, value in contrast_diagnostics.items()
                    if key not in {"method", "confidence"}
                },
            )
        )
    if method == "mask-lines":
        center = quad.mean(axis=0)
        for variant_config in _MASK_CONFIG["variants"]:
            factor = float(variant_config["scale"])
            variant = str(variant_config["name"])
            raw_candidates.append(
                make_candidate(
                    center + (quad - center) * factor,
                    "mask-lines",
                    {
                        "variant": variant,
                        "threshold": round(float(threshold), 2),
                        "sat_threshold": round(float(sat_threshold), 2),
                        "points": {
                            "left": len(left_pts),
                            "right": len(right_pts),
                            "top": len(top_pts),
                            "bottom": len(bottom_pts),
                        },
                    },
                )
            )
    raw_candidates.extend(
        make_candidate(candidate["quad"], "hough-lines", candidate["detector_diagnostics"])
        for candidate in hough_candidates
    )
    if enable_batch_prior and batch_priors:
        raw_candidates.extend(batch_prior_candidates(batch_priors, w, h))

    scored_candidates: list[dict] = []
    for candidate in raw_candidates:
        scored = score_quad_candidate(
            gray,
            candidate["quad"],
            ratio,
            gradient,
            candidate.get("batch_consistency", 0.0),
        )
        if scored is None:
            continue
        score, score_diagnostics = scored
        scored_candidates.append({**candidate, "score": score, "score_diagnostics": score_diagnostics})
    refined_batch_candidates = []
    for candidate in scored_candidates:
        if candidate["method"] != "batch-prior":
            continue
        refinement_attempt = refine_quad(candidate["quad"], gray, gradient)
        if refinement_attempt is None:
            continue
        refined_quad, refinement_diagnostics = refinement_attempt
        refined_score = score_quad_candidate(
            gray,
            refined_quad,
            ratio,
            gradient,
            candidate.get("batch_consistency", 0.0),
        )
        if refined_score is None:
            continue
        score, score_diagnostics = refined_score
        refined_batch_candidates.append(
            {
                **candidate,
                "quad": refined_quad,
                "score": score,
                "score_diagnostics": score_diagnostics,
                "detector_diagnostics": {
                    **candidate["detector_diagnostics"],
                    "batch_refinement": refinement_diagnostics,
                },
            }
        )
    scored_candidates.extend(refined_batch_candidates)
    scored_candidates.sort(key=lambda candidate: candidate["score"], reverse=True)

    ranked: list[dict] = []
    for candidate in scored_candidates:
        if any(
            quad_iou(candidate["quad"], kept["quad"])
            > float(_DEDUP_CONFIG["iouThreshold"])
            or normalized_corner_distance(candidate["quad"], kept["quad"], w, h)
            < float(_DEDUP_CONFIG["cornerDistanceThreshold"])
            for kept in ranked
        ):
            continue
        ranked.append(candidate)

    if not ranked:
        margin_x = w * float(_FALLBACK_CONFIG["marginXRatio"])
        margin_y = h * float(_FALLBACK_CONFIG["marginYRatio"])
        fallback_quad = np.array(
            [
                [margin_x, margin_y],
                [w - margin_x, margin_y],
                [w - margin_x, h - margin_y],
                [margin_x, h - margin_y],
            ],
            dtype=np.float64,
        )
        return fallback_quad * detection_to_source, {
            "method": "fallback-frame",
            "confidence": 0.0,
            "needs_review": True,
            "review_reasons": ["fallback_used"],
            "best_score": 0.0,
            "second_best_score": None,
            "candidates_evaluated": len(raw_candidates),
            "diagnostics": {
                "message": "No supported slide boundary was detected.",
                "candidate_count_before_validation": len(raw_candidates),
                "candidate_count_after_validation": len(scored_candidates),
            },
        }

    initial_best = ranked[0]
    refinement_attempt = refine_quad(initial_best["quad"], gray, gradient)
    refined_candidate = None
    if refinement_attempt is not None:
        refined_quad, refinement_diagnostics = refinement_attempt
        refined_score = score_quad_candidate(gray, refined_quad, ratio, gradient)
        if refined_score is not None:
            score, score_diagnostics = refined_score
            if score >= initial_best["score"]:
                refined_candidate = {
                    **initial_best,
                    "quad": refined_quad,
                    "score": score,
                    "score_diagnostics": score_diagnostics,
                    "detector_diagnostics": {
                        **initial_best["detector_diagnostics"],
                        "refinement": refinement_diagnostics,
                        "refinement_accepted": True,
                        "score_before_refinement": round(float(initial_best["score"]), 4),
                        "score_after_refinement": round(float(score), 4),
                    },
                }
    if refined_candidate is not None:
        ranked = [refined_candidate, *ranked[1:]]
        ranked.sort(key=lambda candidate: candidate["score"], reverse=True)
    else:
        initial_best["detector_diagnostics"] = {
            **initial_best["detector_diagnostics"],
            "refinement_accepted": False,
            "score_before_refinement": round(float(initial_best["score"]), 4),
        }

    best = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None
    confidence_breakdown = calculate_confidence(
        best,
        second,
        [*scored_candidates, best],
        w,
        h,
    )
    confidence = confidence_breakdown["confidence"]
    review_reasons = []
    if confidence < AUTO_REVIEW_CONFIDENCE:
        review_reasons.append("low_confidence")
    if confidence_breakdown["minimum_edge_support"] < float(
        DETECTION_CONFIG["scoring"]["weakEdgeSupportReview"]
    ):
        review_reasons.append("weak_edge_support")
    if (
        second
        and is_ambiguous_candidate(
            quad_iou(best["quad"], second["quad"]),
            confidence_breakdown,
        )
    ):
        review_reasons.append("ambiguous_candidates")

    return best["quad"] * detection_to_source, {
        "method": best["method"],
        "confidence": round(float(confidence), 3),
        "needs_review": bool(review_reasons),
        "review_reasons": review_reasons,
        "best_score": round(float(best["score"]), 4),
        "second_best_score": round(float(second["score"]), 4) if second else None,
        "candidates_evaluated": len(raw_candidates),
        "features": best["score_diagnostics"]["features"],
        "diagnostics": {
            "candidate_count_before_validation": len(raw_candidates),
            "candidate_count_after_validation": len(scored_candidates),
            "candidate_count_after_deduplication": len(ranked),
            "selected_polarity": [
                item["polarity"] for item in best["score_diagnostics"]["edge_evidence"]
            ],
            "selected_detector_diagnostics": best["detector_diagnostics"],
            "selected_warnings": best["score_diagnostics"].get("warnings", []),
            "confidence_breakdown": {
                key: (
                    round(float(value), 4)
                    if isinstance(value, (int, float, np.floating))
                    else value
                )
                for key, value in confidence_breakdown.items()
            },
            "ranked_candidates": [
                {
                    "method": candidate["method"],
                    "score": round(float(candidate["score"]), 4),
                    "quad": [[round(float(x), 2), round(float(y), 2)] for x, y in candidate["quad"]],
                }
                for candidate in ranked[:5]
            ],
        },
    }
