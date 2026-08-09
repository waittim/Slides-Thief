import json
import math
import shutil
import subprocess
import textwrap
from argparse import Namespace
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFilter, ImageOps

from slides_thief.cli import (
    enhance_slide,
    is_paper_ratio,
    list_images,
    order_quad,
    parse_ratio,
    process,
    resolve_enhancement_mode,
    warp_slide,
    warp_slide_contained,
    detect_quad,
)
from slides_thief.detection.batch_prior import build_batch_priors
from slides_thief.detection.gradient import build_gradient_pyramid
from slides_thief.detection.hough_lines import hough_quad_candidates
from slides_thief.detection.refine import refine_quad
from slides_thief.detection.confidence import calculate_confidence, is_ambiguous_candidate
from slides_thief.exporter import make_manual_review_html, scale_quad


def test_parse_ratio_accepts_colon_and_float_values() -> None:
    assert parse_ratio("16:9") == 16 / 9
    assert parse_ratio("1.25") == 1.25


def test_cli_manual_review_round_trips_large_image_coordinates(tmp_path: Path, monkeypatch) -> None:
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    Image.new("RGB", (4000, 3000), (80, 90, 100)).save(input_dir / "slide.jpg")

    source_quad = np.array(
        [[250, 375], [3500, 300], [3600, 2550], [300, 2700]],
        dtype=np.float64,
    )

    def fake_detect_quad(image, source_ratio, manual_quad=None, **kwargs):
        quad = np.asarray(manual_quad, dtype=np.float64) if manual_quad is not None else source_quad
        return quad, {
            "method": "manual" if manual_quad is not None else "test",
            "confidence": 0.9,
            "needs_review": False,
            "review_reasons": [],
        }

    monkeypatch.setattr("slides_thief.cli.detect_quad", fake_detect_quad)
    args = Namespace(
        input=str(input_dir),
        output_dir=str(output_dir),
        work_dir=str(work_dir),
        ratio=None,
        source_ratio="16:9",
        output_ratio="match-slide",
        width=800,
        height=None,
        pdf_name="slides.pdf",
        manual=None,
        jpeg_quality=92,
        enhancement="original",
        grayscale=False,
        clean_converted=False,
    )

    result = process(args)
    item = json.loads((output_dir / "manual_review_data.json").read_text(encoding="utf-8"))[0]

    assert item["origWidth"] == 4000
    assert item["origHeight"] == 3000
    assert item["assetWidth"] == 1600
    assert item["assetHeight"] == 1200
    assert item["sourceQuad"] == source_quad.tolist()
    assert item["assetQuad"] == [[100.0, 150.0], [1400.0, 120.0], [1440.0, 1020.0], [120.0, 1080.0]]
    assert "quad" not in item

    restored_quad = scale_quad(
        item["assetQuad"],
        source_size=(item["assetWidth"], item["assetHeight"]),
        target_size=(item["origWidth"], item["origHeight"]),
    )
    assert restored_quad == item["sourceQuad"]
    assert result["review_items"][0]["sourceQuad"] == item["sourceQuad"]


def test_manual_review_html_exports_dragged_asset_quad_in_source_space(tmp_path: Path) -> None:
    if shutil.which("node") is None:
        pytest.skip("Node.js is required to execute the generated review page")

    html_path = tmp_path / "manual_review.html"
    make_manual_review_html(
        [
            {
                "filename": "slide.jpg",
                "image": "manual_review_images/slide.jpg",
                "origWidth": 4000,
                "origHeight": 3000,
                "assetWidth": 1600,
                "assetHeight": 1200,
                "sourceQuad": [[250, 375], [3500, 300], [3600, 2550], [300, 2700]],
                "assetQuad": [[100, 150], [1400, 120], [1440, 1020], [120, 1080]],
                "confidence": 0.9,
                "needsReview": True,
                "method": "test",
                "reviewReasons": [],
            }
        ],
        html_path,
    )

    harness = textwrap.dedent(
        r"""
        const fs = require("fs");
        const vm = require("vm");

        const html = fs.readFileSync(process.argv[1], "utf8");
        const script = html.match(/<script>\n([\s\S]*)\n<\/script>/)[1];
        let exported = null;
        const context2d = new Proxy({}, { get: () => () => {} });

        class Element {
          constructor(id) {
            this.id = id;
            this.listeners = {};
            this.style = {};
            this.innerHTML = "";
          }
          addEventListener(name, callback) { this.listeners[name] = callback; }
          getBoundingClientRect() { return { left: 0, top: 0 }; }
          getContext() { return context2d; }
          appendChild() {}
          click() { if (this.onclick) this.onclick(); }
        }

        const elements = new Map(
          ["cv", "sidebar", "info", "toast", "prevBtn", "nextBtn", "resetBtn", "exportBtn"]
            .map((id) => [id, new Element(id)])
        );
        const document = {
          getElementById(id) { return elements.get(id); },
          querySelectorAll() { return []; },
          createElement() { return new Element("created"); }
        };
        const window = {
          innerWidth: 1600,
          innerHeight: 1300,
          listeners: {},
          addEventListener(name, callback) { this.listeners[name] = callback; }
        };
        class FakeImage {
          constructor() { this.width = 1600; this.height = 1200; this.onload = null; }
          set src(value) { if (this.onload) this.onload(); }
        }
        class FakeBlob {
          constructor(parts) { this.parts = parts; }
        }

        const navigator = {
          language: "en",
          clipboard: { writeText(value) { exported = value; } }
        };
        vm.runInNewContext(script, {
          document,
          window,
          navigator,
          Image: FakeImage,
          Blob: FakeBlob,
          URL: { createObjectURL() { return "blob:review"; } },
          localStorage: { getItem() { return null; } },
          setTimeout() {},
          Math,
          JSON,
          Object,
          Array
        });

        const canvas = elements.get("cv");
        canvas.listeners.mousedown({ clientX: 75, clientY: 112.5 });
        canvas.listeners.mousemove({ clientX: 150, clientY: 150 });
        window.listeners.mouseup();
        elements.get("exportBtn").onclick();
        process.stdout.write(exported);
        """
    )
    completed = subprocess.run(
        ["node", "-e", harness, str(html_path)],
        check=True,
        capture_output=True,
        text=True,
    )

    assert json.loads(completed.stdout) == {
        "slide.jpg": [[500, 500], [3500, 300], [3600, 2550], [300, 2700]]
    }


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
    )
    enhanced = enhance_slide(image, mode="original")
    assert np.array_equal(np.asarray(enhanced), np.asarray(image))


def test_enhance_slide_bw_is_grayscale() -> None:
    image = Image.fromarray(
        np.array([[[200, 40, 40], [40, 200, 40]], [[40, 40, 200], [180, 180, 40]]], dtype=np.uint8),
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
    enhanced = np.asarray(enhance_slide(Image.fromarray(arr), mode="clean"))
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
    image = Image.fromarray(arr)

    _, diagnostics = detect_quad(image, 16 / 9)

    assert diagnostics["method"] != "fallback-frame"
    assert "inside-darker" in diagnostics["diagnostics"]["selected_polarity"]
    assert diagnostics["candidates_evaluated"] >= 1


def test_hybrid_detector_reports_ranked_candidate_fields() -> None:
    arr = np.full((100, 160, 3), 20, dtype=np.uint8)
    arr[12:88, 15:145] = 230
    image = Image.fromarray(arr)

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


def test_local_edge_refinement_improves_nearby_initial_quad() -> None:
    expected = np.array([[36, 15], [159, 38], [139, 111], [18, 83]], dtype=np.float64)
    image = Image.new("RGB", (180, 125), (22, 22, 22))
    ImageDraw.Draw(image).polygon([tuple(point) for point in expected], fill=(225, 225, 225))
    gradient = build_gradient_pyramid(np.asarray(image))
    gray = np.asarray(
        ImageOps.grayscale(image).filter(ImageFilter.GaussianBlur(radius=2.0)),
        dtype=np.float64,
    )
    center = expected.mean(axis=0)
    initial = center + (expected - center) * 0.98

    result = refine_quad(initial, gray, gradient)

    assert result is not None
    refined, diagnostics = result
    assert np.linalg.norm(refined - expected, axis=1).mean() < np.linalg.norm(initial - expected, axis=1).mean()
    assert diagnostics["maximum_corner_movement"] < math.hypot(180, 125) * 0.04


def test_cross_detector_agreement_increases_calibrated_confidence() -> None:
    features = {
        "edge_support": 0.9,
        "edge_continuity": 0.85,
        "geometry_validity": 1.0,
    }
    best = {
        "quad": np.array([[10, 10], [90, 10], [90, 60], [10, 60]], dtype=np.float64),
        "method": "contrast-lines",
        "score": 0.82,
        "score_diagnostics": {
            "features": features,
            "edge_evidence": [
                {"support_ratio": 0.88, "longest_run_ratio": 0.82}
                for _ in range(4)
            ],
        },
    }
    second = {
        **best,
        "quad": np.array([[18, 18], [82, 18], [82, 52], [18, 52]], dtype=np.float64),
        "score": 0.77,
    }
    agreeing = {
        **best,
        "method": "mask-lines",
        "quad": np.array([[10.2, 10], [90.2, 10], [90.2, 60], [10.2, 60]], dtype=np.float64),
    }

    with_agreement = calculate_confidence(best, second, [best, second, agreeing], 100, 70)
    without_agreement = calculate_confidence(best, second, [best, second], 100, 70)

    assert with_agreement["agreeing_methods"] == ["contrast-lines", "mask-lines"]
    assert with_agreement["confidence"] > without_agreement["confidence"]
    assert with_agreement["minimum_edge_support"] == 0.88
    assert is_ambiguous_candidate(0.5, with_agreement) is False
    assert is_ambiguous_candidate(0.5, without_agreement) is True


def test_batch_priors_require_three_consistent_high_confidence_results() -> None:
    normalized_quad = np.array(
        [[0.08, 0.12], [0.92, 0.1], [0.9, 0.88], [0.1, 0.9]],
        dtype=np.float64,
    )

    def result(image_id: str, confidence: float, delta: float = 0.0) -> dict:
        quad = normalized_quad.copy()
        quad[:, 0] += delta
        return {
            "image_id": image_id,
            "width": 160,
            "height": 100,
            "normalized_quad": quad,
            "confidence": confidence,
            "method": "contrast-lines",
            "needs_review": False,
        }

    assert build_batch_priors([result("a", 0.9), result("b", 0.88)]) == []
    priors = build_batch_priors(
        [
            result("a", 0.9),
            result("b", 0.88, 0.004),
            result("c", 0.84, -0.003),
            result("low", 0.6, 0.2),
        ]
    )

    assert len(priors) == 1
    assert priors[0]["member_count"] == 3
    assert priors[0]["rms_deviation"] < 0.01
    assert priors[0]["consistency"] > 0.8


def test_batch_prior_cannot_replace_missing_image_evidence() -> None:
    image = Image.new("RGB", (160, 100), (30, 30, 30))
    prior = {
        "id": "camera-position-cluster-1",
        "orientation": "landscape",
        "normalized_quad": np.array(
            [[0.08, 0.12], [0.92, 0.1], [0.9, 0.88], [0.1, 0.9]],
            dtype=np.float64,
        ),
        "member_count": 3,
        "rms_deviation": 0.004,
        "consistency": 0.9,
    }

    _, diagnostics = detect_quad(
        image,
        16 / 9,
        batch_priors=[prior],
        enable_batch_prior=True,
    )

    assert diagnostics["method"] == "fallback-frame"
    assert diagnostics["needs_review"] is True


def test_batch_prior_can_win_when_current_image_supports_its_edges() -> None:
    image = Image.new("RGB", (320, 200), (35, 35, 35))
    source_quad = np.array(
        [[28, 28], [294, 22], [286, 176], [34, 181]],
        dtype=np.float64,
    )
    ImageDraw.Draw(image).polygon(
        [tuple(point) for point in source_quad.astype(int)],
        fill=(235, 235, 235),
    )
    prior = {
        "id": "camera-position-cluster-1",
        "orientation": "landscape",
        "normalized_quad": source_quad / np.array([320, 200], dtype=np.float64),
        "member_count": 4,
        "rms_deviation": 0.003,
        "consistency": 0.91,
    }

    _, diagnostics = detect_quad(
        image,
        16 / 9,
        batch_priors=[prior],
        enable_batch_prior=True,
    )

    assert diagnostics["method"] == "batch-prior"
    assert diagnostics["confidence"] >= 0.78
    assert diagnostics["needs_review"] is False
