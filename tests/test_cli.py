import numpy as np
from PIL import Image

from slides_thief.cli import (
    enhance_slide,
    is_paper_ratio,
    list_images,
    order_quad,
    parse_ratio,
    resolve_enhancement_mode,
    warp_slide,
)


def test_parse_ratio_accepts_colon_and_float_values() -> None:
    assert parse_ratio("16:9") == 16 / 9
    assert parse_ratio("1.25") == 1.25


def test_parse_ratio_accepts_named_paper_aliases() -> None:
    assert abs(parse_ratio("A4") - (297 / 210)) < 1e-5
    assert abs(parse_ratio("A4-portrait") - (210 / 297)) < 1e-5
    assert abs(parse_ratio("Letter") - (11 / 8.5)) < 1e-5
    assert abs(parse_ratio("letter-portrait") - (8.5 / 11)) < 1e-5
    assert abs(parse_ratio("A3") - (297 / 210)) < 1e-5


def test_is_paper_ratio_recognizes_paper_presets() -> None:
    assert is_paper_ratio("A4") is True
    assert is_paper_ratio("a4-landscape") is True
    assert is_paper_ratio("Letter") is True
    assert is_paper_ratio("letter-portrait") is True
    assert is_paper_ratio("16:9") is False
    assert is_paper_ratio("4:3") is False


def test_warp_slide_uses_custom_fill_color() -> None:
    img = Image.new("RGB", (50, 50), (0, 0, 255))
    quad = np.array([[-50, -50], [25, -50], [25, 25], [-50, 25]], dtype=np.float64)
    warped_white = warp_slide(img, quad, 100, 100, fill_color=(255, 255, 255))
    assert warped_white.getpixel((0, 0)) == (255, 255, 255)

    warped_black = warp_slide(img, quad, 100, 100, fill_color=(0, 0, 0))
    assert warped_black.getpixel((0, 0)) == (0, 0, 0)


def test_order_quad_returns_clockwise_from_top_left() -> None:
    points = np.array(
        [
            [300, 220],
            [20, 30],
            [280, 40],
            [30, 210],
        ],
        dtype=np.float64,
    )

    ordered = order_quad(points)

    assert ordered.tolist() == [
        [20.0, 30.0],
        [280.0, 40.0],
        [300.0, 220.0],
        [30.0, 210.0],
    ]


def test_list_images_filters_supported_extensions(tmp_path) -> None:
    (tmp_path / "b.PNG").write_bytes(b"")
    (tmp_path / "a.jpg").write_bytes(b"")
    (tmp_path / "notes.txt").write_text("ignore me", encoding="utf-8")

    assert [path.name for path in list_images(tmp_path)] == ["a.jpg", "b.PNG"]


def test_enhance_slide_original_preserves_pixels() -> None:
    image = Image.fromarray(
        np.full((8, 8, 3), (120, 130, 140), dtype=np.uint8),
        "RGB",
    )
    enhanced = enhance_slide(image, mode="original")
    assert np.array_equal(np.asarray(enhanced), np.asarray(image))


def test_enhance_slide_bw_is_grayscale() -> None:
    image = Image.fromarray(
        np.array([[[200, 40, 40], [40, 200, 40]], [[40, 40, 200], [180, 180, 40]]], dtype=np.uint8),
        "RGB",
    )
    enhanced = np.asarray(enhance_slide(image, mode="bw"))
    assert np.allclose(enhanced[..., 0], enhanced[..., 1])
    assert np.allclose(enhanced[..., 1], enhanced[..., 2])


def test_enhance_slide_stats_ignore_edge_fill() -> None:
    # Center is neutral gray; a saturated red border would skew full-frame gray-world.
    arr = np.full((100, 100, 3), 140, dtype=np.uint8)
    arr[:5, :] = (255, 0, 0)
    arr[-5:, :] = (255, 0, 0)
    arr[:, :5] = (255, 0, 0)
    arr[:, -5:] = (255, 0, 0)
    enhanced = np.asarray(enhance_slide(Image.fromarray(arr, "RGB"), mode="clean"))
    center = enhanced[40:60, 40:60]
    assert abs(float(center[..., 0].mean()) - float(center[..., 1].mean())) < 4
    assert abs(float(center[..., 1].mean()) - float(center[..., 2].mean())) < 4


def test_resolve_enhancement_mode_prefers_grayscale_alias() -> None:
    class Args:
        enhancement = "clean"
        grayscale = True

    assert resolve_enhancement_mode(Args()) == "bw"