"""Explainable confidence calibration from rank margin and detector agreement."""

from __future__ import annotations

from .config import DETECTION_CONFIG
from .geometry import normalized_corner_distance, quad_iou

_CONFIDENCE_CONFIG = DETECTION_CONFIG["confidence"]
_SCORING_CONFIG = DETECTION_CONFIG["scoring"]
_FORMULA_WEIGHTS = _SCORING_CONFIG["formulaWeights"]
AUTO_REVIEW_CONFIDENCE = float(_CONFIDENCE_CONFIG["autoReviewThreshold"])


def calculate_confidence(
    best: dict,
    second: dict | None,
    candidates: list[dict],
    width: int,
    height: int,
) -> dict:
    raw_margin = max(0.0, best["score"] - second["score"]) if second else best["score"]
    normalized_margin = min(1.0, max(0.0, raw_margin / float(_CONFIDENCE_CONFIG["marginScale"])))
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
                    normalized_corner_distance(best["quad"], candidate["quad"], width, height)
                    < float(_SCORING_CONFIG["agreementCornerDistance"])
                    and quad_iou(best["quad"], candidate["quad"])
                    > float(_SCORING_CONFIG["agreementIoU"])
                )
            )
        }
    )
    detector_agreement = (
        1.0
        if len(agreeing_methods) >= 3
        else float(_CONFIDENCE_CONFIG["twoDetectorAgreement"])
        if len(agreeing_methods) == 2
        else float(_CONFIDENCE_CONFIG["minimumDetectorAgreement"])
    )
    best_normalized_score = min(1.0, max(0.0, best["score"]))
    geometry_validity = min(1.0, max(0.0, features["geometry_validity"]))
    confidence = min(
        1.0,
        max(
            0.0,
            float(_FORMULA_WEIGHTS["bestScore"]) * best_normalized_score
            + float(_FORMULA_WEIGHTS["margin"]) * normalized_margin
            + float(_FORMULA_WEIGHTS["edgeSupport"]) * minimum_edge_support
            + float(_FORMULA_WEIGHTS["detectorAgreement"]) * detector_agreement
            + float(_FORMULA_WEIGHTS["geometryValidity"]) * geometry_validity,
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
        breakdown["normalized_margin"] < float(_CONFIDENCE_CONFIG["ambiguousMargin"])
        and second_best_iou < float(_CONFIDENCE_CONFIG["ambiguousIoU"])
        and breakdown["detector_agreement"] < float(_CONFIDENCE_CONFIG["ambiguousAgreement"])
    )
