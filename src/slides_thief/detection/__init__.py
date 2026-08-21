"""Shared detection contracts and detector implementations.

Detector functions are imported lazily so geometry utilities can load the
detector configuration without creating a package-level import cycle.
"""

from .types import CandidateFeatures, DetectionResult, QuadCandidate

__all__ = ["CandidateFeatures", "DetectionResult", "QuadCandidate", "contrast_quad", "detect_quad"]


def __getattr__(name: str):
    if name in {"contrast_quad", "detect_quad"}:
        from .detector import contrast_quad, detect_quad

        return {"contrast_quad": contrast_quad, "detect_quad": detect_quad}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
