"""Stable data contracts shared by the CLI detector and benchmark tooling."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

DetectionMethod = Literal[
    "contrast-lines",
    "mask-lines",
    "hough-lines",
    "batch-prior",
    "fallback-frame",
]
EdgePolarity = Literal["inside-brighter", "inside-darker", "mixed"]
ReviewReason = Literal[
    "fallback_used",
    "low_confidence",
    "ambiguous_candidates",
    "weak_edge_support",
    "candidate_out_of_bounds",
    "batch_inconsistency",
]


@dataclass
class CandidateFeatures:
    edge_strength: float = 0.0
    edge_support: float = 0.0
    edge_continuity: float = 0.0
    gradient_alignment: float = 0.0
    inside_outside_difference: float = 0.0
    region_consistency: float = 0.0
    normalized_area: float = 0.0
    geometry_validity: float = 0.0
    aspect_prior: float = 0.0
    batch_consistency: float = 0.0


@dataclass
class QuadCandidate:
    quad: list[list[float]]
    method: DetectionMethod
    polarity: list[EdgePolarity] = field(default_factory=list)
    features: CandidateFeatures = field(default_factory=CandidateFeatures)
    raw_score: float = 0.0
    warnings: list[str] = field(default_factory=list)
    diagnostics: dict[str, Any] = field(default_factory=dict)


@dataclass
class DetectionResult:
    quad: list[list[float]]
    method: DetectionMethod
    confidence: float
    needs_review: bool
    review_reasons: list[ReviewReason]
    best_score: float
    second_best_score: float | None
    candidates_evaluated: int
    diagnostics: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)
