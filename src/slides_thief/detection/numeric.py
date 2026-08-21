"""Canonical numeric helpers used by the detector."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np


def average(values: Sequence[float] | np.ndarray) -> float:
    array = np.asarray(values)
    return float(array.mean()) if array.size else 0.0


def percentile(values: Sequence[float] | np.ndarray, fraction: float) -> float:
    """Return the lower-ranked percentile used by the browser implementation."""

    array = np.sort(np.asarray(values).reshape(-1))
    if not array.size:
        return 0.0
    index = min(array.size - 1, max(0, int(np.floor((array.size - 1) * fraction))))
    return float(array[index])


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
