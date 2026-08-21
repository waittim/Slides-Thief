"""Geometry and mathematical utilities for slide perspective correction."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .detection.config import DETECTION_CONFIG
from .product_metadata import PAPER_PRESETS, RATIO_PRESETS

_MASK_CONFIG = DETECTION_CONFIG["maskLines"]


@dataclass
class Line:
    """Line represented as a*x + b*y + c = 0."""

    a: float
    b: float
    c: float

    def y_at(self, x: float) -> float:
        if abs(self.b) < 1e-9:
            return float("nan")
        return -(self.a * x + self.c) / self.b

    def x_at(self, y: float) -> float:
        if abs(self.a) < 1e-9:
            return float("nan")
        return -(self.b * y + self.c) / self.a


def is_paper_ratio(value: str) -> bool:
    return value.strip().lower() in PAPER_PRESETS


def parse_ratio(value: str) -> float:
    key = value.strip().lower()
    if key in RATIO_PRESETS:
        return RATIO_PRESETS[key]
    if ":" in value:
        w, h = value.split(":", 1)
        return float(w) / float(h)
    return float(value)


def fit_line_xy(points: np.ndarray) -> Line:
    """Least-squares line fit for Nx2 points."""
    if len(points) < 2:
        raise ValueError("Need at least two points to fit a line")
    mean = points.mean(axis=0)
    centered = points - mean
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    direction = vt[0]
    normal = np.array([-direction[1], direction[0]], dtype=np.float64)
    c = -float(np.dot(normal, mean))
    return Line(float(normal[0]), float(normal[1]), c)


def robust_fit(points: list[tuple[float, float]], prefer: str) -> Line | None:
    if len(points) < int(_MASK_CONFIG["fitMinimumPoints"]):
        return None
    arr = np.asarray(points, dtype=np.float64)
    if prefer == "x":
        values = arr[:, 0]
    else:
        values = arr[:, 1]

    lo, hi = np.percentile(
        values,
        [
            float(_MASK_CONFIG["fitLowQuantile"]) * 100,
            float(_MASK_CONFIG["fitHighQuantile"]) * 100,
        ],
    )
    trimmed = arr[(values >= lo) & (values <= hi)]
    if len(trimmed) < int(_MASK_CONFIG["fitMinimumWorkingPoints"]):
        trimmed = arr

    line = fit_line_xy(trimmed)
    for _ in range(int(_MASK_CONFIG["fitIterations"])):
        dist = np.abs(line.a * arr[:, 0] + line.b * arr[:, 1] + line.c) / math.hypot(line.a, line.b)
        cutoff = max(
            float(_MASK_CONFIG["fitOutlierFloor"]),
            float(np.percentile(dist, float(_MASK_CONFIG["fitOutlierQuantile"]) * 100))
            * float(_MASK_CONFIG["fitOutlierScale"]),
        )
        keep = arr[dist <= cutoff]
        if len(keep) < int(_MASK_CONFIG["fitMinimumWorkingPoints"]):
            break
        line = fit_line_xy(keep)
    return line


def intersect(l1: Line, l2: Line) -> np.ndarray:
    den = l1.a * l2.b - l2.a * l1.b
    if abs(den) < 1e-9:
        return np.array([float("nan"), float("nan")])
    x = (l1.b * l2.c - l2.b * l1.c) / den
    y = (l1.c * l2.a - l2.c * l1.a) / den
    return np.array([x, y], dtype=np.float64)


def order_quad(quad: np.ndarray) -> np.ndarray:
    pts = np.asarray(quad, dtype=np.float64)
    s = pts.sum(axis=1)
    diff = pts[:, 0] - pts[:, 1]
    return np.array(
        [
            pts[np.argmin(s)],
            pts[np.argmax(diff)],
            pts[np.argmax(s)],
            pts[np.argmin(diff)],
        ],
        dtype=np.float64,
    )


def perspective_coefficients(src: np.ndarray, dst: np.ndarray) -> list[float]:
    matrix = []
    vector = []
    for (x, y), (u, v) in zip(dst, src):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        vector.append(u)
        vector.append(v)
    coeffs = np.linalg.solve(np.asarray(matrix, dtype=np.float64), np.asarray(vector, dtype=np.float64))
    return coeffs.tolist()
