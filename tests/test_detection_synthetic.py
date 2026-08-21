"""Deterministic P1 acceptance cases for difficult slide boundaries."""

from __future__ import annotations

import math

import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFilter

from slides_thief.cli import detect_quad
from slides_thief.detection.confidence import AUTO_REVIEW_CONFIDENCE
from slides_thief.detection.geometry import quad_iou

SIZE = (320, 240)
EXPECTED_QUAD = np.array(
    [[34, 30], [290, 42], [275, 207], [43, 196]],
    dtype=np.float64,
)


def _base_scene(quad: np.ndarray = EXPECTED_QUAD) -> Image.Image:
    image = Image.new("RGB", SIZE, (35, 45, 58))
    ImageDraw.Draw(image).polygon(
        [tuple(point) for point in quad.astype(int)],
        fill=(232, 230, 218),
    )
    return image


def _internal_grid_scene() -> Image.Image:
    image = _base_scene()
    draw = ImageDraw.Draw(image)
    for x in range(75, 270, 30):
        draw.line((x, 60, x, 180), fill=(25, 25, 25), width=4)
    for y in range(70, 190, 24):
        draw.line((65, y, 270, y), fill=(25, 25, 25), width=4)
    return image


def _blurred_noisy_scene() -> Image.Image:
    image = _base_scene().filter(ImageFilter.GaussianBlur(2))
    pixels = np.asarray(image).astype(np.int16)
    noise = np.random.default_rng(20260728).normal(0, 5, pixels.shape)
    return Image.fromarray(np.clip(pixels + noise, 0, 255).astype(np.uint8))


@pytest.mark.parametrize(
    "scene",
    [_internal_grid_scene, _blurred_noisy_scene],
    ids=["strong-internal-grid", "blur-and-sensor-noise"],
)
def test_supported_difficult_boundaries_remain_accurate(scene) -> None:
    predicted, diagnostics = detect_quad(scene(), 16 / 9)
    mean_corner_error = float(
        np.linalg.norm(predicted - EXPECTED_QUAD, axis=1).mean()
        / math.hypot(*SIZE)
    )

    assert diagnostics["method"] != "fallback-frame"
    assert quad_iou(predicted, EXPECTED_QUAD) >= 0.9
    assert mean_corner_error < 0.02


@pytest.mark.parametrize(
    "scene",
    [
        lambda: _base_scene(
            np.array([[-10, -18], [310, -8], [275, 205], [35, 195]], dtype=np.float64)
        ),
        lambda: _occluded_scene(),
    ],
    ids=["top-edge-out-of-frame", "large-foreground-occlusion"],
)
def test_insufficient_boundaries_are_never_silent_successes(scene) -> None:
    _, diagnostics = detect_quad(scene(), 16 / 9)

    assert diagnostics["needs_review"] is True
    assert (
        diagnostics["confidence"] < AUTO_REVIEW_CONFIDENCE
        or diagnostics["method"] == "fallback-frame"
    )


def _occluded_scene() -> Image.Image:
    image = _base_scene()
    ImageDraw.Draw(image).rectangle((80, 135, 245, 239), fill=(35, 45, 58))
    return image
