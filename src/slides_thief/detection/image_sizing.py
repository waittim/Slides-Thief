"""Image-size budgets used before running memory-intensive detection stages."""

from __future__ import annotations

import math
from dataclasses import dataclass

DETECTION_MAX_SIDE = 4_096


@dataclass(frozen=True)
class ConstrainedImageSize:
    width: int
    height: int
    scale: float
    pixels: int


def constrained_image_size(
    source_width: float,
    source_height: float,
    max_width: float,
    max_pixels: float,
    max_side: float = DETECTION_MAX_SIDE,
) -> ConstrainedImageSize:
    """Return a proportional image size within width, side, and pixel budgets.

    The floor operation intentionally matches the browser implementation. The
    actual integer dimensions are returned so callers can map coordinates back
    using independent X/Y scales after rounding. The final pixel check handles
    the case where a very narrow source dimension was rounded up to one pixel.
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
    side_scale = (
        max_side / max(source_width, source_height)
        if max_side > 0
        else 1.0
    )
    scale = min(1.0, width_scale, pixel_scale, side_scale)
    width = max(1, math.floor(source_width * scale))
    height = max(1, math.floor(source_height * scale))

    pixel_budget = max(1, math.floor(max_pixels)) if max_pixels > 0 else None
    while pixel_budget is not None and width * height > pixel_budget:
        if height >= width and height > 1:
            height = max(1, min(height - 1, pixel_budget // width))
        elif width > 1:
            width = max(1, min(width - 1, pixel_budget // height))
        else:
            break

    return ConstrainedImageSize(
        width=width,
        height=height,
        scale=scale,
        pixels=width * height,
    )
