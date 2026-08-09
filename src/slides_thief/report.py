"""Typed boundary for the JSON report written by the CLI."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


ReportPoint = list[float]
ReportQuad = list[ReportPoint]


class BatchPrior(TypedDict):
    id: str
    orientation: Literal["landscape", "portrait"]
    normalized_quad: ReportQuad
    member_count: int
    rms_deviation: float
    consistency: float


class BatchSummary(TypedDict):
    preliminary_count: int
    reliable_count: int
    prior_count: int
    priors: list[BatchPrior]


class _RequiredReportSlide(TypedDict):
    index: int
    source: str
    output: str
    quad: ReportQuad
    method: str
    confidence: float
    needs_review: bool
    review_reasons: list[str]
    best_score: float
    second_best_score: float | None
    candidates_evaluated: int
    diagnostics: dict[str, Any]


class ReportSlide(_RequiredReportSlide, total=False):
    # Manual and fallback detections do not expose score features.
    features: dict[str, float]


class SlideLensReport(TypedDict):
    input_dir: str
    output_pdf: str
    ratio: str
    source_slide_ratio: str
    output_page_ratio: str
    size: list[int]
    batch_summary: BatchSummary
    slides: list[ReportSlide]
