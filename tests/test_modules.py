from pathlib import Path

import numpy as np
from PIL import Image

from slides_thief.exporter import make_contact_sheet, make_manual_review_html, make_pdf, scale_quad
from slides_thief.geometry import (
    Line,
    fit_line_xy,
    intersect,
    is_paper_ratio,
    order_quad,
    parse_ratio,
    perspective_coefficients,
)
from slides_thief.image_processing import (
    DecodedImageCache,
    _center_stats_region,
    enhance_slide,
    warp_slide,
    warp_slide_contained,
)


def test_geometry_line_intersections_and_fitting() -> None:
    l1 = Line(1.0, 0.0, -10.0)  # x = 10
    l2 = Line(0.0, 1.0, -20.0)  # y = 20
    pt = intersect(l1, l2)
    assert np.allclose(pt, [10.0, 20.0])

    pts = np.array([[0.0, 0.0], [10.0, 10.0], [20.0, 20.0]])
    fitted = fit_line_xy(pts)
    assert abs(fitted.y_at(5.0) - 5.0) < 1e-5


def test_geometry_ratios_and_quads() -> None:
    assert parse_ratio("16:9") == 16 / 9
    assert is_paper_ratio("A4") is True
    assert is_paper_ratio("16:9") is False

    pts = np.array([[300, 220], [20, 30], [280, 40], [30, 210]], dtype=np.float64)
    ordered = order_quad(pts)
    assert ordered.shape == (4, 2)


def test_geometry_perspective_coefficients() -> None:
    src = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.float64)
    dst = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.float64)
    coeffs = perspective_coefficients(src, dst)
    assert len(coeffs) == 8


def test_scale_quad_scales_x_and_y_independently() -> None:
    assert scale_quad(
        [[1000, 900], [3000, 900], [3000, 2100], [1000, 2100]],
        source_size=(4000, 3000),
        target_size=(1600, 1000),
    ) == [[400.0, 300.0], [1200.0, 300.0], [1200.0, 700.0], [400.0, 700.0]]


def test_image_processing_warping_and_enhancement() -> None:
    arr = np.ones((100, 100, 3), dtype=np.uint8) * 128
    region = _center_stats_region(arr, inset=0.1)
    assert region.shape == (80, 80, 3)

    img = Image.new("RGB", (50, 50), (200, 200, 200))
    enhanced = enhance_slide(img, mode="clean")
    assert enhanced.size == (50, 50)

    quad = np.array([[0, 0], [50, 0], [50, 50], [0, 50]], dtype=np.float64)
    warped = warp_slide(img, quad, 100, 100)
    assert warped.size == (100, 100)

    contained = warp_slide_contained(img, quad, 100, 100, source_ratio=1.0)
    assert contained.size == (100, 100)


def test_exporter_pdf_and_html(tmp_path: Path) -> None:
    img_path = tmp_path / "test.jpg"
    img = Image.new("RGB", (100, 100), (255, 0, 0))
    img.save(img_path)

    pdf_path = tmp_path / "test.pdf"
    make_pdf([img_path], pdf_path, 800, 600)
    assert pdf_path.exists() and pdf_path.stat().st_size > 0

    sheet_path = tmp_path / "sheet.jpg"
    make_contact_sheet([img_path], sheet_path, "Test Sheet")
    assert sheet_path.exists() and sheet_path.stat().st_size > 0

    html_path = tmp_path / "review.html"
    make_manual_review_html([{"filename": "test.jpg", "image": "test.jpg", "quad": [[0, 0], [10, 0], [10, 10], [0, 10]], "confidence": 0.9, "needsReview": False, "method": "test"}], html_path)
    assert html_path.exists() and "Slides Thief Manual Review" in html_path.read_text(encoding="utf-8")


def test_decoded_image_cache_reuses_entries_within_pixel_budget_and_closes_files(
    tmp_path: Path,
    monkeypatch,
) -> None:
    first_path = tmp_path / "first.jpg"
    second_path = tmp_path / "second.jpg"
    Image.new("RGB", (20, 20), (255, 0, 0)).save(first_path)
    Image.new("RGB", (20, 20), (0, 255, 0)).save(second_path)

    original_open = Image.open
    opened = []

    def tracking_open(*args, **kwargs):
        image = original_open(*args, **kwargs)
        opened.append(image)
        return image

    monkeypatch.setattr(Image, "open", tracking_open)
    with DecodedImageCache(max_pixels=20 * 20) as cache:
        with cache.open(first_path):
            pass
        with cache.open(second_path):
            pass
        with cache.open(first_path):
            pass
        assert cache.cached_pixels == 20 * 20

    assert len(opened) == 2
    assert all(getattr(image, "fp", None) is None for image in opened)


def test_contact_sheet_closes_each_source_image(tmp_path: Path, monkeypatch) -> None:
    image_path = tmp_path / "source.jpg"
    Image.new("RGB", (100, 100), (255, 0, 0)).save(image_path)
    output_path = tmp_path / "sheet.jpg"

    original_open = Image.open
    opened = []

    def tracking_open(*args, **kwargs):
        image = original_open(*args, **kwargs)
        opened.append(image)
        return image

    monkeypatch.setattr(Image, "open", tracking_open)
    make_contact_sheet([image_path], output_path, "Test Sheet")

    assert output_path.exists()
    assert len(opened) == 1
    assert getattr(opened[0], "fp", None) is None
