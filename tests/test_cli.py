import numpy as np
from PIL import Image, ImageDraw

from slides_thief.cli import (
    enhance_slide,
    is_paper_ratio,
    list_images,
    order_quad,
    parse_ratio,
    resolve_enhancement_mode,
    warp_slide,
    warp_slide_contained,
    detect_quad,
)
from slides_thief.detection.gradient import build_gradient_pyramid
from slides_thief.detection.hough_lines import hough_quad_candidates


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


def test_fallback_detection_is_always_marked_for_review() -> None:
    image = Image.new("RGB", (160, 100), (0, 0, 0))
    _, diagnostics = detect_quad(image, 16 / 9)

    assert diagnostics["method"].startswith("fallback-frame")
    assert diagnostics["confidence"] == 0
    assert diagnostics["needs_review"] is True
    assert diagnostics["review_reasons"] == ["fallback_used"]


def test_contained_warp_preserves_source_ratio_on_paper_page() -> None:
    image = Image.new("RGB", (160, 90), (20, 40, 220))
    quad = np.array([[0, 0], [159, 0], [159, 89], [0, 89]], dtype=np.float64)
    page = warp_slide_contained(
        image,
        quad,
        page_w=297,
        page_h=210,
        source_ratio=16 / 9,
        fill_color=(255, 255, 255),
    )

    assert page.getpixel((148, 0)) == (255, 255, 255)
    assert page.getpixel((148, 105))[2] > 180


def test_dark_slide_uses_reverse_polarity_without_fallback() -> None:
    arr = np.full((100, 160, 3), 230, dtype=np.uint8)
    arr[12:88, 15:145] = 20
    image = Image.fromarray(arr, "RGB")

    _, diagnostics = detect_quad(image, 16 / 9)

    assert diagnostics["method"] != "fallback-frame"
    assert "inside-darker" in diagnostics["diagnostics"]["selected_polarity"]
    assert diagnostics["candidates_evaluated"] >= 1


def test_hybrid_detector_reports_ranked_candidate_fields() -> None:
    arr = np.full((100, 160, 3), 20, dtype=np.uint8)
    arr[12:88, 15:145] = 230
    image = Image.fromarray(arr, "RGB")

    _, diagnostics = detect_quad(image, 16 / 9)

    assert diagnostics["method"] in {"contrast-lines", "mask-lines", "hough-lines"}
    assert diagnostics["best_score"] > 0
    assert "second_best_score" in diagnostics
    assert diagnostics["diagnostics"]["candidate_count_before_validation"] >= 2


def test_orientation_guided_hough_recovers_rotated_perspective_quad() -> None:
    expected = np.array([[36, 15], [159, 38], [139, 111], [18, 83]], dtype=np.float64)
    image = Image.new("RGB", (180, 125), (22, 22, 22))
    ImageDraw.Draw(image).polygon([tuple(point) for point in expected], fill=(225, 225, 225))
    gradient = build_gradient_pyramid(np.asarray(image))

    candidates = hough_quad_candidates(gradient)

    assert candidates
    corner_error = min(np.linalg.norm(candidate["quad"] - expected, axis=1).mean() for candidate in candidates)
    assert corner_error < 5.0
    assert candidates[0]["detector_diagnostics"]["family_angle_degrees"] >= 35


def test_gradient_pyramid_retains_scale_diagnostics() -> None:
    arr = np.full((80, 120, 3), 20, dtype=np.uint8)
    arr[15:65, 20:100] = (220, 80, 40)

    gradient = build_gradient_pyramid(arr)

    assert gradient.magnitude.shape == (80, 120)
    assert gradient.threshold >= 0.035
    observed_scales = {round(float(value), 2) for value in np.unique(gradient.source_scale)}
    assert observed_scales.issubset({0.0, 0.45, 0.67, 1.0})
