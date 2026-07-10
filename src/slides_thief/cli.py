#!/usr/bin/env python3
"""Batch perspective correction for photographed presentation slides.

This intentionally avoids OpenCV so it can run with the bundled Codex runtime:
Pillow + NumPy + reportlab are enough for this photographed-slide workflow.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


SUPPORTED = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif"}


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


def parse_ratio(value: str) -> float:
    if ":" in value:
        w, h = value.split(":", 1)
        return float(w) / float(h)
    return float(value)


def list_images(input_dir: Path) -> list[Path]:
    return sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED],
        key=lambda p: p.name,
    )


def convert_with_sips(src: Path, dst: Path) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "95", str(src), "--out", str(dst)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return dst


def readable_image(src: Path, converted_dir: Path) -> Path:
    if src.suffix.lower() in {".heic", ".heif"}:
        return convert_with_sips(src, converted_dir / f"{src.stem}.jpg")
    return src


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


def box_blur(gray: np.ndarray, radius: int = 5) -> np.ndarray:
    # Two cumulative-sum passes keep the detector quick without SciPy/OpenCV.
    arr = gray.astype(np.float64)
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (radius, radius)
        padded = np.pad(arr, pad, mode="edge")
        csum = np.cumsum(padded, axis=axis)
        head = np.take(csum, range(2 * radius + 1, csum.shape[axis]), axis=axis)
        tail = np.take(csum, range(0, csum.shape[axis] - 2 * radius - 1), axis=axis)
        arr = (head - tail) / (2 * radius + 1)
    return arr


def sample_nearest(gray: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    xi = np.clip(np.rint(xs).astype(np.int32), 0, w - 1)
    yi = np.clip(np.rint(ys).astype(np.int32), 0, h - 1)
    return gray[yi, xi]


def contrast_score(diff: np.ndarray) -> float:
    if len(diff) == 0:
        return 0.0
    positive = diff[diff > 0]
    if len(positive) < max(8, len(diff) * 0.12):
        return 0.0
    return float(np.percentile(positive, 72) + positive.mean() * 0.35)


def horizontal_edge_candidates(gray: np.ndarray, kind: str, limit: int = 12) -> list[tuple[Line, float]]:
    h, w = gray.shape
    xs = np.linspace(w * 0.16, w * 0.88, 240)
    x_center = w / 2.0
    offset = max(6.0, h * 0.017)
    if kind == "top":
        y_values = np.arange(h * 0.07, h * 0.45, max(2, h // 260))
    else:
        y_values = np.arange(h * 0.42, h * 0.92, max(2, h // 260))

    candidates: list[tuple[Line, float, float, float]] = []
    for slope in np.linspace(-0.22, 0.16, 33):
        for y0 in y_values:
            ys = slope * (xs - x_center) + y0
            valid = (ys > offset + 1) & (ys < h - offset - 1)
            if valid.mean() < 0.85:
                continue
            if kind == "top":
                diff = sample_nearest(gray, xs[valid], ys[valid] + offset) - sample_nearest(
                    gray, xs[valid], ys[valid] - offset
                )
            else:
                diff = sample_nearest(gray, xs[valid], ys[valid] - offset) - sample_nearest(
                    gray, xs[valid], ys[valid] + offset
                )
            score = contrast_score(diff)
            if score > 3.5:
                candidates.append((Line(float(-slope), 1.0, float(slope * x_center - y0)), score, float(y0), float(slope)))

    candidates.sort(key=lambda item: item[1], reverse=True)
    selected: list[tuple[Line, float, float, float]] = []
    for candidate in candidates:
        _, _, y0, slope = candidate
        if all(abs(y0 - kept[2]) > h * 0.035 or abs(slope - kept[3]) > 0.055 for kept in selected):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return [(line, score) for line, score, _, _ in selected]


def best_horizontal_edge(gray: np.ndarray, kind: str) -> tuple[Line, float] | None:
    candidates = horizontal_edge_candidates(gray, kind, limit=1)
    return candidates[0] if candidates else None


def vertical_edge_candidates(gray: np.ndarray, kind: str, limit: int = 12) -> list[tuple[Line, float]]:
    h, w = gray.shape
    ys = np.linspace(h * 0.18, h * 0.84, 220)
    y_center = h / 2.0
    offset = max(6.0, w * 0.012)
    if kind == "left":
        x_values = np.arange(w * 0.01, w * 0.46, max(2, w // 280))
    else:
        x_values = np.arange(w * 0.54, w * 0.99, max(2, w // 280))

    candidates: list[tuple[Line, float, float, float]] = []
    for slope in np.linspace(-0.24, 0.24, 39):
        for x0 in x_values:
            xs = slope * (ys - y_center) + x0
            valid = (xs > offset + 1) & (xs < w - offset - 1)
            if valid.mean() < 0.82:
                continue
            if kind == "left":
                diff = sample_nearest(gray, xs[valid] + offset, ys[valid]) - sample_nearest(
                    gray, xs[valid] - offset, ys[valid]
                )
            else:
                diff = sample_nearest(gray, xs[valid] - offset, ys[valid]) - sample_nearest(
                    gray, xs[valid] + offset, ys[valid]
                )
            score = contrast_score(diff)
            if score > 3.5:
                candidates.append((Line(1.0, float(-slope), float(slope * y_center - x0)), score, float(x0), float(slope)))

    candidates.sort(key=lambda item: item[1], reverse=True)
    selected: list[tuple[Line, float, float, float]] = []
    for candidate in candidates:
        _, _, x0, slope = candidate
        if all(abs(x0 - kept[2]) > w * 0.035 or abs(slope - kept[3]) > 0.065 for kept in selected):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return [(line, score) for line, score, _, _ in selected]


def best_vertical_edge(gray: np.ndarray, kind: str) -> tuple[Line, float] | None:
    candidates = vertical_edge_candidates(gray, kind, limit=1)
    return candidates[0] if candidates else None


def contrast_quad(gray: np.ndarray, ratio: float) -> tuple[np.ndarray, dict] | None:
    h, w = gray.shape
    tops = horizontal_edge_candidates(gray, "top", limit=10)
    bottoms = horizontal_edge_candidates(gray, "bottom", limit=10)
    lefts = vertical_edge_candidates(gray, "left", limit=10)
    rights = vertical_edge_candidates(gray, "right", limit=10)
    if not all([tops, bottoms, lefts, rights]):
        return None

    best: tuple[float, np.ndarray, list[float], float, float] | None = None
    for top, top_score in tops:
        for bottom, bottom_score in bottoms:
            if bottom.y_at(w / 2.0) <= top.y_at(w / 2.0) + h * 0.20:
                continue
            for left, left_score in lefts:
                for right, right_score in rights:
                    if right.x_at(h / 2.0) <= left.x_at(h / 2.0) + w * 0.22:
                        continue
                    quad = order_quad(
                        np.vstack(
                            [
                                intersect(top, left),
                                intersect(top, right),
                                intersect(bottom, right),
                                intersect(bottom, left),
                            ]
                        )
                    )
                    if not np.isfinite(quad).all():
                        continue
                    if np.any(quad[:, 0] < -w * 0.18) or np.any(quad[:, 0] > w * 1.18):
                        continue
                    if np.any(quad[:, 1] < -h * 0.18) or np.any(quad[:, 1] > h * 1.18):
                        continue

                    top_len = float(np.linalg.norm(quad[1] - quad[0]))
                    bottom_len = float(np.linalg.norm(quad[2] - quad[3]))
                    left_len = float(np.linalg.norm(quad[3] - quad[0]))
                    right_len = float(np.linalg.norm(quad[2] - quad[1]))
                    mean_width = (top_len + bottom_len) / 2.0
                    mean_height = (left_len + right_len) / 2.0
                    aspect_est = mean_width / max(1.0, mean_height)
                    area = 0.5 * abs(
                        np.dot(quad[:, 0], np.roll(quad[:, 1], -1))
                        - np.dot(quad[:, 1], np.roll(quad[:, 0], -1))
                    )
                    area_norm = area / (w * h)
                    if area_norm < 0.12 or not (ratio * 0.52 <= aspect_est <= ratio * 1.62):
                        continue
                    aspect_error = abs(math.log(max(0.05, aspect_est / ratio)))
                    edge_score = float(np.mean([top_score, bottom_score, left_score, right_score]))
                    # The outer slide boundary is usually the largest plausible
                    # 16:9 quadrilateral; this keeps inner chart/table lines
                    # from beating a slightly weaker real screen edge.
                    total = edge_score + 82.0 * area_norm - 72.0 * aspect_error
                    if best is None or total > best[0]:
                        best = (total, quad, [top_score, bottom_score, left_score, right_score], aspect_est, area_norm)

    if best is None:
        return None

    _, quad, scores, aspect_est, area_norm = best

    diagnostics = {
        "method": "contrast-lines",
        "confidence": round(float(min(1.0, 0.42 + np.mean(scores) / 65.0 + area_norm * 0.25)), 3),
        "contrast_scores": [round(float(score), 2) for score in scores],
        "aspect_est": round(float(aspect_est), 3),
        "area_norm": round(float(area_norm), 3),
    }
    return quad, diagnostics


def detect_quad(
    image: Image.Image,
    ratio: float,
    max_width: int = 1200,
    manual_quad: list[list[float]] | None = None,
) -> tuple[np.ndarray, dict]:
    if manual_quad:
        return np.asarray(manual_quad, dtype=np.float64), {"method": "manual", "confidence": 1.0}

    orig_w, orig_h = image.size
    scale = min(1.0, max_width / orig_w)
    small = image.convert("RGB")
    if scale < 1:
        small = small.resize((round(orig_w * scale), round(orig_h * scale)), Image.Resampling.LANCZOS)

    rgb_small = np.asarray(small, dtype=np.float64)
    gray_img = ImageOps.grayscale(small).filter(ImageFilter.GaussianBlur(radius=2.0))
    gray = np.asarray(gray_img, dtype=np.float64)
    h, w = gray.shape

    contrast_result = contrast_quad(gray, ratio)
    if contrast_result is not None:
        quad, diagnostics = contrast_result
        quad /= scale
        return quad, diagnostics

    # Projected slides/screens in this set are mostly neutral gray, while the
    # wall, curtains, and audience are either saturated or dark. Segmenting the
    # low-saturation screen body gives a better document boundary than raw
    # brightness, especially when the cyan wall is brighter than the slide.
    p05, p25, p55, p92 = np.percentile(gray, [5, 25, 55, 92])
    rgb_max = rgb_small.max(axis=2)
    rgb_min = rgb_small.min(axis=2)
    sat = np.divide(
        (rgb_max - rgb_min) * 255.0,
        rgb_max,
        out=np.zeros_like(rgb_max),
        where=rgb_max > 1.0,
    )
    threshold = max(24.0, min(p55 - 5.0, p25 + (p92 - p25) * 0.16))
    sat_threshold = float(max(34.0, min(78.0, np.percentile(sat, 48) + 18.0)))
    mask = (gray > threshold) & (sat < sat_threshold)

    # Bring bright white text back into the same component without letting the
    # cyan wall dominate the top edge.
    mask = mask | ((gray > max(115.0, p92 * 0.78)) & (sat < sat_threshold + 18.0))

    density = box_blur(mask.astype(np.float64), radius=max(3, round(w * 0.006)))

    left_pts: list[tuple[float, float]] = []
    right_pts: list[tuple[float, float]] = []
    top_pts: list[tuple[float, float]] = []
    bottom_pts: list[tuple[float, float]] = []

    row_min = max(0, int(h * 0.04))
    row_max = min(h, int(h * 0.96))
    for y in range(row_min, row_max, 2):
        row = density[y]
        active = np.flatnonzero(row > 0.38)
        if len(active) < w * 0.30:
            continue
        x1, x2 = int(active[0]), int(active[-1])
        if x2 - x1 < w * 0.50:
            continue
        # Ignore isolated bright text by requiring a reasonably dense span.
        if row[x1:x2 + 1].mean() < 0.32:
            continue
        left_pts.append((x1, y))
        right_pts.append((x2, y))

    col_min = max(0, int(w * 0.04))
    col_max = min(w, int(w * 0.96))
    for x in range(col_min, col_max, 2):
        col = density[:, x]
        active = np.flatnonzero(col > 0.38)
        if len(active) < h * 0.24:
            continue
        y1, y2 = int(active[0]), int(active[-1])
        if y2 - y1 < h * 0.35:
            continue
        if col[y1:y2 + 1].mean() < 0.30:
            continue
        top_pts.append((x, y1))
        bottom_pts.append((x, y2))

    left = robust_fit(left_pts, "x")
    right = robust_fit(right_pts, "x")
    top = robust_fit(top_pts, "y")
    bottom = robust_fit(bottom_pts, "y")

    method = "mask-lines"
    if not all([left, right, top, bottom]):
        method = "fallback-frame"
        margin_x = w * 0.03
        margin_y = h * 0.04
        left = Line(1.0, 0.0, -margin_x)
        right = Line(1.0, 0.0, -(w - margin_x))
        top = Line(0.0, 1.0, -margin_y)
        bottom = Line(0.0, 1.0, -(h - margin_y))

    quad = order_quad(np.vstack([intersect(top, left), intersect(top, right), intersect(bottom, right), intersect(bottom, left)]))

    if not np.isfinite(quad).all():
        method = "fallback-frame"
        margin_x = w * 0.03
        margin_y = h * 0.04
        quad = np.array(
            [
                [margin_x, margin_y],
                [w - margin_x, margin_y],
                [w - margin_x, h - margin_y],
                [margin_x, h - margin_y],
            ],
            dtype=np.float64,
        )

    # The right and bottom edges are sometimes outside the photo. Re-fit a
    # plausible 16:9 quadrilateral when detection produces a wild aspect ratio.
    top_len = float(np.linalg.norm(quad[1] - quad[0]))
    bottom_len = float(np.linalg.norm(quad[2] - quad[3]))
    left_len = float(np.linalg.norm(quad[3] - quad[0]))
    right_len = float(np.linalg.norm(quad[2] - quad[1]))
    aspect_est = ((top_len + bottom_len) / 2.0) / max(1.0, (left_len + right_len) / 2.0)
    if aspect_est < ratio * 0.70 or aspect_est > ratio * 1.35:
        method = f"{method}+ratio-guard"
        # Keep the strongest top-left evidence and infer the missing extent.
        tl = quad[0]
        tr = quad[1]
        bl = quad[3]
        top_vec = tr - tl
        left_vec = bl - tl
        top_len = max(float(np.linalg.norm(top_vec)), w * 0.65)
        height = top_len / ratio
        if np.linalg.norm(left_vec) < h * 0.25:
            left_vec = np.array([0.0, height])
        left_unit = left_vec / max(1.0, np.linalg.norm(left_vec))
        bl = tl + left_unit * height
        br = bl + top_vec
        quad = order_quad(np.vstack([tl, tr, br, bl]))

    confidence = max(0.0, min(1.0, len(left_pts) / max(1.0, h * 0.25))) * 0.25
    confidence += max(0.0, min(1.0, len(top_pts) / max(1.0, w * 0.25))) * 0.25
    confidence += 0.35 if method.startswith("mask-lines") else 0.12
    confidence += 0.15 if ratio * 0.65 <= aspect_est <= ratio * 1.40 else 0.0

    quad /= scale
    diagnostics = {
        "method": method,
        "threshold": float(threshold),
        "sat_threshold": float(sat_threshold),
        "confidence": round(float(min(1.0, confidence)), 3),
        "points": {
            "left": len(left_pts),
            "right": len(right_pts),
            "top": len(top_pts),
            "bottom": len(bottom_pts),
        },
    }
    return quad, diagnostics


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


def enhance_slide(image: Image.Image, grayscale: bool = False) -> Image.Image:
    rgb = image.convert("RGB")
    arr = np.asarray(rgb).astype(np.float32)
    # Neutralize projector color cast with a gentle gray-world correction.
    means = arr.reshape(-1, 3).mean(axis=0)
    target = means.mean()
    arr *= target / np.maximum(means, 1.0)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    rgb = Image.fromarray(arr, "RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.35)
    if grayscale:
        return ImageOps.grayscale(rgb).convert("RGB")
    return rgb


def warp_slide(image: Image.Image, quad: np.ndarray, out_w: int, out_h: int) -> Image.Image:
    dst = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float64)
    coeffs = perspective_coefficients(quad, dst)
    warped = image.convert("RGB").transform(
        (out_w, out_h),
        Image.Transform.PERSPECTIVE,
        coeffs,
        Image.Resampling.BICUBIC,
    )
    return warped


def draw_overlay(image: Image.Image, quad: np.ndarray, output: Path) -> None:
    overlay = image.convert("RGB").copy()
    overlay.thumbnail((1200, 900), Image.Resampling.LANCZOS)
    sx = overlay.width / image.width
    sy = overlay.height / image.height
    scaled = [(float(x * sx), float(y * sy)) for x, y in quad]
    draw = ImageDraw.Draw(overlay)
    draw.line(scaled + [scaled[0]], fill=(255, 64, 64), width=5)
    for i, point in enumerate(scaled, 1):
        x, y = point
        r = 8
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 230, 0), outline=(40, 40, 40), width=2)
        draw.text((x + 10, y - 12), str(i), fill=(255, 230, 0))
    output.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(output, quality=90)


def make_contact_sheet(images: list[Path], output: Path, title: str) -> None:
    if not images:
        return
    cell_w, cell_h = 360, 240
    label_h = 28
    cols = min(4, len(images))
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h) + 36), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), title, fill=(0, 0, 0))
    for idx, path in enumerate(images):
        im = Image.open(path).convert("RGB")
        im.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
        x = (idx % cols) * cell_w
        y = 36 + (idx // cols) * (cell_h + label_h)
        sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2))
        draw.text((x + 8, y + cell_h + 6), path.stem, fill=(0, 0, 0))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def make_manual_review_html(items: list[dict], output: Path) -> None:
    payload = json.dumps(items, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slide Lens Manual Review</title>
<style>
:root {{
  color-scheme: light;
  --bg: #f5f7f8;
  --panel: #ffffff;
  --text: #1f272c;
  --muted: #66747d;
  --line: #d8e0e5;
  --accent: #e24b3c;
  --handle: #ffd84a;
  --control-bg: #ffffff;
  --control-hover: #aebbc4;
  --primary-bg: #1f272c;
  --primary-text: #ffffff;
  --canvas-bg: #111111;
  --canvas-border: #20272c;
  --toast-text: #ffffff;
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #101416;
  --panel: #171d20;
  --text: #eef4f6;
  --muted: #9daab1;
  --line: #344147;
  --accent: #ff7b68;
  --handle: #ffd84a;
  --control-bg: #1d2529;
  --control-hover: #5b6b73;
  --primary-bg: #eef4f6;
  --primary-text: #101416;
  --canvas-bg: #050607;
  --canvas-border: #344147;
  --toast-text: #101416;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --bg: #101416;
    --panel: #171d20;
    --text: #eef4f6;
    --muted: #9daab1;
    --line: #344147;
    --accent: #ff7b68;
    --handle: #ffd84a;
    --control-bg: #1d2529;
    --control-hover: #5b6b73;
    --primary-bg: #eef4f6;
    --primary-text: #101416;
    --canvas-bg: #050607;
    --canvas-border: #344147;
    --toast-text: #101416;
  }}
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}}
.app {{
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}}
.bar {{
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}}
.spacer {{ flex: 1; }}
button, select {{
  height: 34px;
  border: 1px solid var(--line);
  background: var(--control-bg);
  border-radius: 6px;
  padding: 0 10px;
  color: var(--text);
  font: inherit;
}}
button {{ cursor: pointer; min-width: 38px; }}
button:hover, select:hover {{ border-color: var(--control-hover); }}
button.primary {{ background: var(--primary-bg); color: var(--primary-text); border-color: var(--primary-bg); }}
.status {{
  min-width: 148px;
  color: var(--muted);
  white-space: nowrap;
}}
.stage {{
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 16px;
}}
.canvasWrap {{
  width: min(100%, 1500px);
  max-height: calc(100vh - 88px);
  overflow: auto;
  background: var(--canvas-bg);
  border: 1px solid var(--canvas-border);
}}
canvas {{
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}}
.toast {{
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  background: var(--primary-bg);
  color: var(--toast-text);
  padding: 8px 12px;
  border-radius: 6px;
  opacity: 0;
  transition: opacity .18s ease;
  pointer-events: none;
}}
.toast.show {{ opacity: 1; }}
@media (max-width: 720px) {{
  .bar {{ flex-wrap: wrap; }}
  .status {{ min-width: auto; }}
  .stage {{ padding: 8px; }}
}}
</style>
</head>
<body>
<div class="app">
  <div class="bar">
    <button id="prev" title="Previous page" data-i18n-title="nav.prev">‹</button>
    <button id="next" title="Next page" data-i18n-title="nav.next">›</button>
    <select id="page"></select>
    <span id="status" class="status"></span>
    <span class="spacer"></span>
    <select id="themeMode" title="Theme" data-i18n-title="theme.label">
      <option value="auto" data-i18n="theme.auto">Auto</option>
      <option value="light" data-i18n="theme.light">Light</option>
      <option value="dark" data-i18n="theme.dark">Dark</option>
    </select>
    <select id="localeMode" title="Language" data-i18n-title="language.label">
      <option value="auto" data-i18n="language.auto">Auto</option>
      <option value="zh-CN" data-i18n="language.zh">Chinese</option>
      <option value="en" data-i18n="language.en">English</option>
    </select>
    <button id="reset" title="Reset current page" data-i18n="actions.reset" data-i18n-title="actions.resetTitle">Reset</button>
    <button id="copy" title="Copy JSON" data-i18n="actions.copy" data-i18n-title="actions.copyTitle">Copy JSON</button>
    <button id="download" class="primary" title="Download JSON" data-i18n="actions.download" data-i18n-title="actions.downloadTitle">Download JSON</button>
  </div>
  <main class="stage">
    <div class="canvasWrap">
      <canvas id="canvas"></canvas>
    </div>
  </main>
</div>
<div id="toast" class="toast"></div>
<script>
const items = {payload};
const i18n = {{
  "zh-CN": {{
    "title": "Slides Thief · PPT捕手 手动审核",
    "theme.label": "主题",
    "theme.auto": "自动",
    "theme.light": "亮色",
    "theme.dark": "暗色",
    "language.label": "语言",
    "language.auto": "自动",
    "language.zh": "中文",
    "language.en": "English",
    "nav.prev": "上一页",
    "nav.next": "下一页",
    "actions.reset": "重置",
    "actions.resetTitle": "重置当前页",
    "actions.copy": "复制 JSON",
    "actions.copyTitle": "复制 JSON",
    "actions.download": "下载 JSON",
    "actions.downloadTitle": "下载 JSON",
    "toast.copied": "JSON 已复制"
  }},
  en: {{
    "title": "Slides Thief Manual Review",
    "theme.label": "Theme",
    "theme.auto": "Auto",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "language.label": "Language",
    "language.auto": "Auto",
    "language.zh": "Chinese",
    "language.en": "English",
    "nav.prev": "Previous page",
    "nav.next": "Next page",
    "actions.reset": "Reset",
    "actions.resetTitle": "Reset current page",
    "actions.copy": "Copy JSON",
    "actions.copyTitle": "Copy JSON",
    "actions.download": "Download JSON",
    "actions.downloadTitle": "Download JSON",
    "toast.copied": "JSON copied"
  }}
}};
const prefStorageKey = "slideLensManualPrefs";
const storageKey = "slideLensManualQuads:" + location.pathname;
function readPrefs() {{
  try {{
    const saved = JSON.parse(localStorage.getItem(prefStorageKey) || "null");
    if (saved && typeof saved === "object") return saved;
  }} catch (_) {{}}
  return {{}};
}}
function savePrefs() {{
  localStorage.setItem(prefStorageKey, JSON.stringify(prefs));
}}
function normalizeChoice(value, choices, fallback) {{
  return choices.includes(value) ? value : fallback;
}}
const prefs = readPrefs();
prefs.theme = normalizeChoice(prefs.theme || "auto", ["auto", "light", "dark"], "auto");
prefs.locale = normalizeChoice(prefs.locale || "auto", ["auto", "zh-CN", "en"], "auto");
let locale = "en";
function resolveLocale() {{
  if (prefs.locale !== "auto") return prefs.locale;
  const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  return languages.some(language => String(language).toLowerCase().startsWith("zh")) ? "zh-CN" : "en";
}}
function t(key) {{
  const dictionary = i18n[locale] || i18n.en;
  return dictionary[key] || i18n.en[key] || key;
}}
function applyTheme() {{
  document.documentElement.dataset.theme = prefs.theme;
  themeMode.value = prefs.theme;
}}
function applyLocale() {{
  locale = resolveLocale();
  document.documentElement.lang = locale;
  document.title = t("title");
  localeMode.value = prefs.locale;
  document.querySelectorAll("[data-i18n]").forEach(element => {{
    element.textContent = t(element.dataset.i18n);
  }});
  document.querySelectorAll("[data-i18n-title]").forEach(element => {{
    element.title = t(element.dataset.i18nTitle);
  }});
}}
const initial = Object.fromEntries(items.map(item => [item.filename, item.quad.map(p => [...p])]));
let state = loadState();
let index = 0;
let img = new Image();
let dragging = -1;
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const page = document.getElementById("page");
const status = document.getElementById("status");
const toast = document.getElementById("toast");
const themeMode = document.getElementById("themeMode");
const localeMode = document.getElementById("localeMode");
applyTheme();
applyLocale();

for (const [i, item] of items.entries()) {{
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${{String(i + 1).padStart(2, "0")}}  ${{item.filename}}`;
  page.appendChild(opt);
}}

function loadState() {{
  try {{
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") return saved;
  }} catch (_) {{}}
  return JSON.parse(JSON.stringify(initial));
}}

function saveState() {{
  localStorage.setItem(storageKey, JSON.stringify(state));
}}

function showToast(message) {{
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1200);
}}

function current() {{
  return items[index];
}}

function toCanvasPoint(point) {{
  const item = current();
  return [point[0] / item.origWidth * item.assetWidth, point[1] / item.origHeight * item.assetHeight];
}}

function toOriginalPoint(x, y) {{
  const item = current();
  return [x / item.assetWidth * item.origWidth, y / item.assetHeight * item.origHeight];
}}

function draw() {{
  if (!img.complete) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const pts = state[current().filename].map(toCanvasPoint);
  ctx.lineWidth = Math.max(3, canvas.width / 420);
  ctx.strokeStyle = "rgba(226, 75, 60, .96)";
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.stroke();
  pts.forEach(([x, y], i) => {{
    const r = Math.max(9, canvas.width / 150);
    ctx.fillStyle = "rgba(255, 216, 74, .96)";
    ctx.strokeStyle = "rgba(22, 24, 26, .9)";
    ctx.lineWidth = Math.max(2, canvas.width / 700);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1b1f22";
    ctx.font = `${{Math.max(13, canvas.width / 80)}}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y + 1);
  }});
}}

function loadPage(nextIndex) {{
  index = Math.max(0, Math.min(items.length - 1, nextIndex));
  const item = current();
  page.value = String(index);
  status.textContent = `${{index + 1}} / ${{items.length}} · ${{item.method}} · ${{item.confidence}}`;
  img = new Image();
  img.onload = () => {{
    canvas.width = item.assetWidth;
    canvas.height = item.assetHeight;
    draw();
  }};
  img.src = item.image;
}}

function eventPoint(event) {{
  const rect = canvas.getBoundingClientRect();
  return [
    (event.clientX - rect.left) / rect.width * canvas.width,
    (event.clientY - rect.top) / rect.height * canvas.height
  ];
}}

canvas.addEventListener("pointerdown", event => {{
  const [x, y] = eventPoint(event);
  const pts = state[current().filename].map(toCanvasPoint);
  let best = -1;
  let bestDist = Infinity;
  pts.forEach(([px, py], i) => {{
    const dist = Math.hypot(px - x, py - y);
    if (dist < bestDist) {{
      bestDist = dist;
      best = i;
    }}
  }});
  if (bestDist <= Math.max(24, canvas.width / 55)) {{
    dragging = best;
    canvas.setPointerCapture(event.pointerId);
  }}
}});

canvas.addEventListener("pointermove", event => {{
  if (dragging < 0) return;
  const [x, y] = eventPoint(event);
  state[current().filename][dragging] = toOriginalPoint(x, y).map(v => Math.round(v * 100) / 100);
  saveState();
  draw();
}});

canvas.addEventListener("pointerup", event => {{
  dragging = -1;
  try {{ canvas.releasePointerCapture(event.pointerId); }} catch (_) {{}}
}});

document.getElementById("prev").onclick = () => loadPage(index - 1);
document.getElementById("next").onclick = () => loadPage(index + 1);
page.onchange = () => loadPage(Number(page.value));
themeMode.onchange = event => {{
  prefs.theme = normalizeChoice(event.target.value, ["auto", "light", "dark"], "auto");
  savePrefs();
  applyTheme();
}};
localeMode.onchange = event => {{
  prefs.locale = normalizeChoice(event.target.value, ["auto", "zh-CN", "en"], "auto");
  savePrefs();
  applyLocale();
}};
document.getElementById("reset").onclick = () => {{
  state[current().filename] = initial[current().filename].map(p => [...p]);
  saveState();
  draw();
}};
document.getElementById("copy").onclick = async () => {{
  const text = JSON.stringify(state, null, 2);
  await navigator.clipboard.writeText(text);
  showToast(t("toast.copied"));
}};
document.getElementById("download").onclick = () => {{
  const blob = new Blob([JSON.stringify(state, null, 2)], {{ type: "application/json" }});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manual_quads.json";
  a.click();
  URL.revokeObjectURL(url);
}};
window.addEventListener("keydown", event => {{
  if (event.key === "ArrowLeft") loadPage(index - 1);
  if (event.key === "ArrowRight") loadPage(index + 1);
}});
window.addEventListener("languagechange", () => {{
  if (prefs.locale === "auto") applyLocale();
}});
loadPage(0);
</script>
</body>
</html>
"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")


def make_pdf(images: list[Path], output: Path, page_w: int, page_h: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=(page_w, page_h))
    for image_path in images:
        c.drawImage(ImageReader(str(image_path)), 0, 0, width=page_w, height=page_h)
        c.showPage()
    c.save()


def load_manual_quads(path: Path | None) -> dict[str, list[list[float]]]:
    if not path:
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def process(args: argparse.Namespace) -> dict:
    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    work_dir = Path(args.work_dir).expanduser().resolve()
    ratio = parse_ratio(args.ratio)
    out_w = int(args.width)
    out_h = int(round(out_w / ratio))
    if args.height:
        out_h = int(args.height)

    converted_dir = work_dir / "converted"
    corrected_dir = output_dir / "corrected_images"
    overlay_dir = output_dir / "detection_overlays"
    review_image_dir = output_dir / "manual_review_images"
    corrected_dir.mkdir(parents=True, exist_ok=True)
    overlay_dir.mkdir(parents=True, exist_ok=True)
    review_image_dir.mkdir(parents=True, exist_ok=True)

    manual_quads = load_manual_quads(Path(args.manual) if args.manual else None)
    sources = list_images(input_dir)
    if not sources:
        raise SystemExit(f"No supported images found in {input_dir}")

    corrected: list[Path] = []
    report: list[dict] = []
    review_items: list[dict] = []
    for idx, src in enumerate(sources, 1):
        readable = readable_image(src, converted_dir)
        image = ImageOps.exif_transpose(Image.open(readable)).convert("RGB")
        manual = manual_quads.get(src.name) or manual_quads.get(src.stem)
        quad, diagnostics = detect_quad(image, ratio, manual_quad=manual)
        review_image = image.copy()
        review_image.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
        review_asset = review_image_dir / f"{idx:03d}_{src.stem}.jpg"
        review_image.save(review_asset, quality=90, optimize=True)
        review_items.append(
            {
                "filename": src.name,
                "image": str(review_asset.relative_to(output_dir)),
                "origWidth": image.width,
                "origHeight": image.height,
                "assetWidth": review_image.width,
                "assetHeight": review_image.height,
                "quad": [[round(float(x), 2), round(float(y), 2)] for x, y in quad],
                "method": diagnostics["method"],
                "confidence": diagnostics["confidence"],
            }
        )
        warped = warp_slide(image, quad, out_w, out_h)
        enhanced = enhance_slide(warped, grayscale=args.grayscale)
        out_image = corrected_dir / f"{idx:03d}_{src.stem}.jpg"
        enhanced.save(out_image, quality=args.jpeg_quality, optimize=True)
        corrected.append(out_image)
        draw_overlay(image, quad, overlay_dir / f"{idx:03d}_{src.stem}_overlay.jpg")
        report.append(
            {
                "index": idx,
                "source": str(src),
                "output": str(out_image),
                "quad": [[round(float(x), 2), round(float(y), 2)] for x, y in quad],
                **diagnostics,
            }
        )
        print(f"[{idx:02d}/{len(sources):02d}] {src.name}: {diagnostics['method']} confidence={diagnostics['confidence']}")

    pdf_path = output_dir / args.pdf_name
    corrected_contact_sheet = output_dir / "corrected_contact_sheet.jpg"
    detection_contact_sheet = output_dir / "detection_contact_sheet.jpg"
    manual_review_path = output_dir / "manual_review.html"
    review_data_path = output_dir / "manual_review_data.json"
    make_pdf(corrected, pdf_path, page_w=out_w, page_h=out_h)
    make_contact_sheet(corrected, corrected_contact_sheet, "Corrected slide previews")
    make_contact_sheet(sorted(overlay_dir.glob("*.jpg")), detection_contact_sheet, "Detected quadrilaterals")
    make_manual_review_html(review_items, manual_review_path)

    with review_data_path.open("w", encoding="utf-8") as fh:
        json.dump(review_items, fh, indent=2, ensure_ascii=False)

    report_path = output_dir / "slide_lens_report.json"
    report_document = {
        "input_dir": str(input_dir),
        "output_pdf": str(pdf_path),
        "ratio": args.ratio,
        "size": [out_w, out_h],
        "slides": report,
    }
    with report_path.open("w", encoding="utf-8") as fh:
        json.dump(report_document, fh, indent=2, ensure_ascii=False)

    if args.clean_converted:
        shutil.rmtree(converted_dir, ignore_errors=True)

    print(f"PDF: {pdf_path}")
    print(f"Report: {report_path}")
    print(f"Manual review: {manual_review_path}")

    return {
        **report_document,
        "output_dir": str(output_dir),
        "report": str(report_path),
        "manual_review": str(manual_review_path),
        "manual_review_data": str(review_data_path),
        "corrected_contact_sheet": str(corrected_contact_sheet),
        "detection_contact_sheet": str(detection_contact_sheet),
        "review_items": review_items,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Flatten photographed slides and save them as a PDF.")
    parser.add_argument("input", help="Folder containing source photos")
    parser.add_argument("--output-dir", default="outputs/slide_lens_example", help="Output folder")
    parser.add_argument("--work-dir", default="work/slide_lens_runtime", help="Intermediate folder")
    parser.add_argument("--ratio", default="16:9", help="Output slide ratio, e.g. 16:9 or 4:3")
    parser.add_argument("--width", type=int, default=2200, help="Output image width in pixels")
    parser.add_argument("--height", type=int, default=None, help="Optional output image height in pixels")
    parser.add_argument("--pdf-name", default="flattened_slides.pdf", help="PDF filename")
    parser.add_argument("--manual", default=None, help="Optional JSON mapping filenames to four source points")
    parser.add_argument("--jpeg-quality", type=int, default=92)
    parser.add_argument("--grayscale", action="store_true", help="Convert output slides to grayscale")
    parser.add_argument("--clean-converted", action="store_true", help="Remove intermediate converted JPEGs")
    return parser


def main() -> None:
    process(build_parser().parse_args())


if __name__ == "__main__":
    main()
