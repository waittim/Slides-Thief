"""Image-size budgets used before running memory-intensive detection stages."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class ConstrainedImageSize:
    width: int
    height: int
    scale: float
    pixels: int


def constrained_image_size(
    source_width: int | float,
    source_height: int | float,
    max_width: int | float,
    max_pixels: int | float,
) -> ConstrainedImageSize:
    """Return a proportional image size within width and pixel budgets.

    The floor operation intentionally matches the browser implementation. The
    actual integer dimensions are returned so callers can map coordinates back
    using independent X/Y scales after rounding.
    """
    if (
        not math.isfinite(float(source_width))
        or not math.isfinite(float(source_height))
        or source_width <= 0
        or source_height <= 0
    ):
        raise ValueError("Image dimensions must be positive finite numbers.")

    width_scale = max_width / source_width if max_width > 0 else 1.0
    pixel_scale = (
        math.sqrt(max_pixels / (source_width * source_height))
        if max_pixels > 0
        else 1.0
    )
    scale = min(1.0, width_scale, pixel_scale)
    width = max(1, math.floor(source_width * scale))
    height = max(1, math.floor(source_height * scale))
    return ConstrainedImageSize(
        width=width,
        height=height,
        scale=scale,
        pixels=width * height,
    )
