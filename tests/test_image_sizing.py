"""Cross-runtime image-size budget tests."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

import slides_thief.detection.detector as detector_module
from slides_thief.detection.image_sizing import constrained_image_size


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "image-sizing.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "case",
    FIXTURE["cases"],
    ids=lambda case: case["name"],
)
def test_constrained_image_size_matches_shared_boundary_fixture(case: dict) -> None:
    result = constrained_image_size(
        case["sourceWidth"],
        case["sourceHeight"],
        FIXTURE["maxWidth"],
        FIXTURE["maxPixels"],
    )

    expected = case["expected"]
    assert result.width == expected["width"]
    assert result.height == expected["height"]
    assert result.pixels == expected["pixels"]
    assert math.isclose(result.scale, expected["scale"], rel_tol=0, abs_tol=1e-15)


def test_constrained_image_size_rejects_invalid_dimensions() -> None:
    with pytest.raises(ValueError, match="positive finite"):
        constrained_image_size(0, 240, 900, 1_200_000)


def test_detector_maps_coordinates_using_actual_detection_width_and_height(monkeypatch) -> None:
    observed: dict[str, tuple[int, ...]] = {}

    def fake_gradient_pyramid(rgb: np.ndarray) -> object:
        observed["shape"] = rgb.shape
        return object()

    monkeypatch.setattr(detector_module, "contrast_quad", lambda _gray, _ratio: None)
    monkeypatch.setattr(detector_module, "build_gradient_pyramid", fake_gradient_pyramid)
    monkeypatch.setattr(detector_module, "hough_quad_candidates", lambda _gradient: [])

    source_size = (91, 1200)
    detection_size = constrained_image_size(*source_size, max_width=91, max_pixels=12_000)
    quad, diagnostics = detector_module.detect_quad(
        Image.new("RGB", source_size, (0, 0, 0)),
        16 / 9,
        max_width=91,
        max_pixels=12_000,
    )

    assert diagnostics["method"] == "fallback-frame"
    assert observed["shape"] == (detection_size.height, detection_size.width, 3)
    margin = np.array(
        [
            [detection_size.width * 0.045, detection_size.height * 0.055],
            [detection_size.width * (1 - 0.045), detection_size.height * 0.055],
            [detection_size.width * (1 - 0.045), detection_size.height * (1 - 0.055)],
            [detection_size.width * 0.045, detection_size.height * (1 - 0.055)],
        ],
        dtype=np.float64,
    )
    expected = margin * np.array(
        [source_size[0] / detection_size.width, source_size[1] / detection_size.height],
        dtype=np.float64,
    )
    np.testing.assert_allclose(quad, expected)
