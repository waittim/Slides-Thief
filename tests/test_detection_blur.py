"""Regression tests for the detector's separable box blur."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from slides_thief.detection.detector import box_blur

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "detection" / "box-blur.json"


@pytest.mark.parametrize("shape", [(100, 160), (1, 1), (2, 3), (3, 1)])
def test_box_blur_preserves_input_shape(shape: tuple[int, int]) -> None:
    image = np.arange(np.prod(shape), dtype=np.float64).reshape(shape)

    blurred = box_blur(image, radius=1)

    assert blurred.shape == image.shape


@pytest.mark.parametrize("radius", [0, 1, 3])
def test_box_blur_keeps_constant_images_constant(radius: int) -> None:
    image = np.full((3, 2), 7.5, dtype=np.float64)

    blurred = box_blur(image, radius=radius)

    assert np.array_equal(blurred, image)


def test_box_blur_uses_edge_replication_and_matches_shared_fixture() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    image = np.asarray(fixture["input"], dtype=np.float64).reshape(fixture["height"], fixture["width"])

    blurred = box_blur(image, radius=fixture["radius"])

    np.testing.assert_allclose(blurred.ravel(), fixture["expected"], rtol=0, atol=1e-12)
