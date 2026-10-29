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


def extrapolate_corner(
    quad: np.ndarray,
    target_index: int,
    target_ratio: float | None = None,
    mode: str = "auto",
    image_width: float | None = None,
    image_height: float | None = None,
) -> np.ndarray:
    """Extrapolate a single missing, occluded, or truncated corner using 3 known corners."""
    q = np.asarray(quad, dtype=np.float64)
    k = target_index % 4

    # In canonical quad [0=TL, 1=TR, 2=BR, 3=BL]:
    # (0, 1) and (3, 2) are horizontal pairs; (0, 3) and (1, 2) are vertical pairs.
    if k == 0:
        h_idx, v_idx, opp_idx = 1, 3, 2
    elif k == 1:
        h_idx, v_idx, opp_idx = 0, 2, 3
    elif k == 2:
        h_idx, v_idx, opp_idx = 3, 1, 0
    else:  # k == 3
        h_idx, v_idx, opp_idx = 2, 0, 1

    p_h = q[h_idx]
    p_v = q[v_idx]
    p_opp = q[opp_idx]

    affine_point = p_h + p_v - p_opp
    if mode == "affine":
        res = q.copy()
        res[k] = affine_point
        return res

    v_h_opp = p_v - p_opp
    v_v_opp = p_h - p_opp
    l_h_opp = float(np.linalg.norm(v_h_opp))
    l_v_opp = float(np.linalg.norm(v_v_opp))
    if l_h_opp < 1e-6 or l_v_opp < 1e-6:
        res = q.copy()
        res[k] = affine_point
        return res

    u_h_opp = v_h_opp / l_h_opp
    u_v_opp = v_v_opp / l_v_opp

    n_h = np.array([-u_h_opp[1], u_h_opp[0]], dtype=np.float64)
    if float(np.dot(n_h, u_v_opp)) < 0:
        n_h = -n_h

    th = math.atan2(float(np.dot(u_v_opp, u_h_opp)), float(np.dot(u_v_opp, n_h)))
    ray_v = math.cos(-th) * n_h + math.sin(-th) * u_h_opp
    ray_h = u_h_opp

    A = np.column_stack([ray_h, -ray_v])
    det = float(np.linalg.det(A))
    result_point = affine_point.copy()
    if abs(det) > 1e-4:
        rhs = p_v - p_h
        s, t = np.linalg.solve(A, rhs)
        if s > 0.05 * l_h_opp and t > 0.05 * l_v_opp and s < 10.0 * l_h_opp and t < 10.0 * l_v_opp:
            result_point = p_h + s * ray_h

    if image_width is not None and image_height is not None:
        max_outside_x = round(image_width * 0.3)
        max_outside_y = round(image_height * 0.3)
        result_point[0] = max(-max_outside_x, min(image_width + max_outside_x, result_point[0]))
        result_point[1] = max(-max_outside_y, min(image_height + max_outside_y, result_point[1]))

    res = q.copy()
    res[k] = np.round(result_point, 2)
    return res
