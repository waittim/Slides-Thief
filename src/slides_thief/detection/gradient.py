"""Multi-scale opponent-color Sobel gradients shared by CLI detection stages."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image


PYRAMID_SCALES = (1.0, 0.67, 0.45)


@dataclass(frozen=True)
class GradientMap:
    magnitude: np.ndarray
    orientation: np.ndarray
    source_scale: np.ndarray
    threshold: float
    scales: tuple[float, ...] = PYRAMID_SCALES


def build_gradient_pyramid(rgb: np.ndarray) -> GradientMap:
    """Fuse luminance, R-G, and B-(R+G)/2 gradients across three scales."""
    height, width = rgb.shape[:2]
    fused_magnitude = np.zeros((height, width), dtype=np.float64)
    fused_orientation = np.zeros((height, width), dtype=np.float64)
    source_scale = np.zeros((height, width), dtype=np.float32)

    source_image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    for scale in PYRAMID_SCALES:
        scaled_width = max(3, round(width * scale))
        scaled_height = max(3, round(height * scale))
        scaled = np.asarray(
            source_image.resize((scaled_width, scaled_height), Image.Resampling.BILINEAR),
            dtype=np.float64,
        )
        channels = (
            (scaled[..., 0] * 0.299 + scaled[..., 1] * 0.587 + scaled[..., 2] * 0.114) / 255.0,
            (scaled[..., 0] - scaled[..., 1]) / 510.0,
            (scaled[..., 2] - (scaled[..., 0] + scaled[..., 1]) * 0.5) / 510.0,
        )
        magnitude = np.zeros((scaled_height, scaled_width), dtype=np.float64)
        orientation = np.zeros_like(magnitude)
        for channel in channels:
            channel_magnitude, channel_orientation = _sobel(channel)
            replace = channel_magnitude > magnitude
            magnitude[replace] = channel_magnitude[replace]
            orientation[replace] = channel_orientation[replace]

        y_indices = np.clip(
            np.rint((np.arange(height) + 0.5) * scaled_height / height - 0.5).astype(np.int32),
            0,
            scaled_height - 1,
        )
        x_indices = np.clip(
            np.rint((np.arange(width) + 0.5) * scaled_width / width - 0.5).astype(np.int32),
            0,
            scaled_width - 1,
        )
        mapped_magnitude = magnitude[np.ix_(y_indices, x_indices)] * np.sqrt(scale)
        mapped_orientation = orientation[np.ix_(y_indices, x_indices)]
        replace = mapped_magnitude > fused_magnitude
        fused_magnitude[replace] = mapped_magnitude[replace]
        fused_orientation[replace] = mapped_orientation[replace]
        source_scale[replace] = scale

    threshold = max(0.035, float(np.percentile(fused_magnitude, 85)))
    return GradientMap(fused_magnitude, fused_orientation, source_scale, threshold)


def _sobel(channel: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    padded = np.pad(channel, 1, mode="edge")
    top_left = padded[:-2, :-2]
    top = padded[:-2, 1:-1]
    top_right = padded[:-2, 2:]
    left = padded[1:-1, :-2]
    right = padded[1:-1, 2:]
    bottom_left = padded[2:, :-2]
    bottom = padded[2:, 1:-1]
    bottom_right = padded[2:, 2:]
    gx = -top_left + top_right - 2 * left + 2 * right - bottom_left + bottom_right
    gy = -top_left - 2 * top - top_right + bottom_left + 2 * bottom + bottom_right
    magnitude = np.hypot(gx, gy) / (4 * np.sqrt(2))
    return magnitude, np.arctan2(gy, gx)
