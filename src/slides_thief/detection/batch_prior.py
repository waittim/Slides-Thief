"""Safe multi-image geometry priors for repeated camera positions."""

from __future__ import annotations

import math

import numpy as np

from .candidate_factory import make_candidate
from .config import DETECTION_CONFIG
from .numeric import average

_BATCH_CONFIG = DETECTION_CONFIG["batchPrior"]


def build_batch_priors(results: list[dict]) -> list[dict]:
    reliable = [
        result
        for result in results
        if result["confidence"] >= float(_BATCH_CONFIG["minimumReliableConfidence"])
        and result["method"] != "fallback-frame"
    ]
    clusters: list[list[dict]] = []
    for result in reliable:
        orientation = _orientation(result["width"], result["height"])
        best_cluster = None
        best_distance = math.inf
        for cluster in clusters:
            if _orientation(cluster[0]["width"], cluster[0]["height"]) != orientation:
                continue
            center = _median_quad([item["normalized_quad"] for item in cluster])
            distance = _quad_distance(result["normalized_quad"], center)
            if distance < float(_BATCH_CONFIG["clusterDistance"]) and distance < best_distance:
                best_cluster = cluster
                best_distance = distance
        if best_cluster is None:
            clusters.append([result])
        else:
            best_cluster.append(result)

    priors = []
    for cluster in clusters:
        if len(cluster) < int(_BATCH_CONFIG["minimumClusterMembers"]):
            continue
        normalized_quad = _median_quad([item["normalized_quad"] for item in cluster])
        rms_deviation = math.sqrt(
            average([_quad_distance(item["normalized_quad"], normalized_quad) ** 2 for item in cluster])
        )
        if rms_deviation >= float(_BATCH_CONFIG["maximumRmsDeviation"]):
            continue
        priors.append(
            {
                "id": f"camera-position-cluster-{len(priors) + 1}",
                "orientation": _orientation(cluster[0]["width"], cluster[0]["height"]),
                "normalized_quad": normalized_quad,
                "member_count": len(cluster),
                "rms_deviation": rms_deviation,
                "consistency": min(
                    1.0,
                    max(0.0, 1 - rms_deviation / float(_BATCH_CONFIG["consistencyScale"])),
                ),
            }
        )
    return priors


def batch_prior_candidates(priors: list[dict], width: int, height: int) -> list[dict]:
    orientation = _orientation(width, height)
    candidates = []
    for prior in priors:
        if prior["orientation"] != orientation:
            continue
        scale = np.array([width, height], dtype=np.float64)
        candidates.append(
            make_candidate(
                prior["normalized_quad"] * scale,
                "batch-prior",
                {
                    "batch_prior_id": prior["id"],
                    "batch_prior_member_count": prior["member_count"],
                    "batch_prior_rms_deviation": round(prior["rms_deviation"], 5),
                    "batch_prior_consistency": round(prior["consistency"], 4),
                },
                batch_consistency=prior["consistency"],
            )
        )
    return candidates


def normalize_result(
    image_id: str,
    width: int,
    height: int,
    quad: np.ndarray,
    diagnostics: dict,
) -> dict:
    return {
        "image_id": image_id,
        "width": width,
        "height": height,
        "normalized_quad": quad / np.array([width, height], dtype=np.float64),
        "confidence": diagnostics["confidence"],
        "method": diagnostics["method"],
        "needs_review": diagnostics["needs_review"],
    }


def _median_quad(quads: list[np.ndarray]) -> np.ndarray:
    return np.median(np.stack(quads), axis=0)


def _quad_distance(first: np.ndarray, second: np.ndarray) -> float:
    return float(np.linalg.norm(first - second, axis=1).mean())


def _orientation(width: int, height: int) -> str:
    return "landscape" if width >= height else "portrait"
