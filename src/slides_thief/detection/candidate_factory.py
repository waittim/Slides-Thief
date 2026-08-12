"""Factories for detector candidate contracts."""

from __future__ import annotations

from dataclasses import fields
from typing import Any

import numpy as np

from .types import CandidateFeatures, DetectionMethod


def empty_candidate_features() -> dict[str, float]:
    """Return a fresh zero-valued feature mapping for an unscored candidate."""

    return {field.name: 0.0 for field in fields(CandidateFeatures)}


def make_candidate(
    quad: np.ndarray,
    method: DetectionMethod,
    detector_diagnostics: dict[str, Any] | None = None,
    *,
    batch_consistency: float = 0.0,
) -> dict[str, Any]:
    candidate = {
        "quad": quad,
        "method": method,
        "detector_diagnostics": detector_diagnostics or {},
    }
    if batch_consistency:
        candidate["batch_consistency"] = batch_consistency
    return candidate
