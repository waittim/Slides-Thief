"""Geometry and mathematical utilities for slide perspective correction."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


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


RATIO_PRESETS: dict[str, float] = {
    "16:9": 16 / 9,
    "4:3": 4 / 3,
    "a4": 297 / 210,
    "a4-landscape": 297 / 210,
    "a3": 297 / 210,
    "a3-landscape": 297 / 210,
    "a5": 297 / 210,
    "a4-portrait": 210 / 297,
    "a3-portrait": 210 / 297,
    "a5-portrait": 210 / 297,
    "letter": 11 / 8.5,
    "letter-landscape": 11 / 8.5,
    "letter-portrait": 8.5 / 11,
}

PAPER_PRESETS: set[str] = {
    "a4",
    "a4-landscape",
    "a3",
    "a3-landscape",
    "a5",
    "a4-portrait",
    "a3-portrait",
    "a5-portrait",
    "letter",
    "letter-landscape",
    "letter-portrait",
}


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
    if len(points) < 16:
        return None
    arr = np.asarray(points, dtype=np.float64)
    if prefer == "x":
        values = arr[:, 0]
    else:
        values = arr[:, 1]

    lo, hi = np.percentile(values, [8, 92])
    trimmed = arr[(values >= lo) & (values <= hi)]
    if len(trimmed) < 12:
        trimmed = arr

    line = fit_line_xy(trimmed)
    for _ in range(3):
        dist = np.abs(line.a * arr[:, 0] + line.b * arr[:, 1] + line.c) / math.hypot(line.a, line.b)
        cutoff = max(3.0, float(np.percentile(dist, 70)) * 1.8)
        keep = arr[dist <= cutoff]
        if len(keep) < 12:
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
