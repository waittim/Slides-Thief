"""Shared detection contracts and detector implementations."""

from .detector import contrast_quad, detect_quad
from .types import CandidateFeatures, DetectionResult, QuadCandidate

__all__ = ["CandidateFeatures", "DetectionResult", "QuadCandidate", "contrast_quad", "detect_quad"]

