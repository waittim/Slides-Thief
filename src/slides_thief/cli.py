#!/usr/bin/env python3
"""Batch perspective correction CLI for photographed presentation slides.

This intentionally avoids OpenCV so it can run with the bundled Codex runtime:
Pillow + NumPy + reportlab are enough for this photographed-slide workflow.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from .detection.batch_prior import build_batch_priors, normalize_result
from .detection.detector import contrast_quad, detect_quad
from .exporter import draw_overlay, make_contact_sheet, make_manual_review_html, make_pdf, scale_quad
from .geometry import (
    PAPER_PRESETS,
    RATIO_PRESETS,
    Line,
    fit_line_xy,
    intersect,
    is_paper_ratio,
    order_quad,
    parse_ratio,
    perspective_coefficients,
    robust_fit,
)
from .image_processing import (
    SUPPORTED,
    _center_stats_region,
    convert_with_sips,
    enhance_slide,
    list_images,
    readable_image,
    warp_slide,
    warp_slide_contained,
)
from .report import BatchSummary, ReportSlide, SlideLensReport


def load_manual_quads(path: Path | None) -> dict[str, list[list[float]]]:
    if not path:
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def process(args: argparse.Namespace) -> dict:
    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    work_dir = Path(args.work_dir).expanduser().resolve()
    legacy_ratio = getattr(args, "ratio", None)
    source_ratio_name = getattr(args, "source_ratio", None) or legacy_ratio or "16:9"
    output_ratio_name = getattr(args, "output_ratio", None) or legacy_ratio or "match-slide"
    source_ratio = parse_ratio(source_ratio_name)
    page_ratio = source_ratio if output_ratio_name == "match-slide" else parse_ratio(output_ratio_name)
    out_w = int(args.width)
    out_h = int(round(out_w / page_ratio))
    if args.height:
        out_h = int(args.height)

    converted_dir = work_dir / "converted"
    corrected_dir = output_dir / "corrected_images"
    overlay_dir = output_dir / "detection_overlays"
    review_image_dir = output_dir / "manual_review_images"
    corrected_dir.mkdir(parents=True, exist_ok=True)
    overlay_dir.mkdir(parents=True, exist_ok=True)
    review_image_dir.mkdir(parents=True, exist_ok=True)

    manual_quads = load_manual_quads(Path(args.manual) if args.manual else None)
    sources = list_images(input_dir)
    if not sources:
        raise SystemExit(f"No supported images found in {input_dir}")

    detections: dict[Path, tuple[np.ndarray, dict]] = {}
    preliminary_results = []
    for src in sources:
        readable = readable_image(src, converted_dir)
        image = ImageOps.exif_transpose(Image.open(readable)).convert("RGB")
        manual = manual_quads.get(src.name) or manual_quads.get(src.stem)
        quad, diagnostics = detect_quad(image, source_ratio, manual_quad=manual)
        detections[src] = (quad, diagnostics)
        preliminary_results.append(
            normalize_result(src.name, image.width, image.height, quad, diagnostics)
        )

    batch_priors = build_batch_priors(preliminary_results)
    for src in sources:
        quad, diagnostics = detections[src]
        manual = manual_quads.get(src.name) or manual_quads.get(src.stem)
        if manual or not batch_priors:
            continue
        if not (diagnostics["confidence"] < 0.72 and diagnostics["needs_review"]):
            continue
        readable = readable_image(src, converted_dir)
        image = ImageOps.exif_transpose(Image.open(readable)).convert("RGB")
        detections[src] = detect_quad(
            image,
            source_ratio,
            batch_priors=batch_priors,
            enable_batch_prior=True,
        )

    corrected: list[Path] = []
    report: list[ReportSlide] = []
    review_items: list[dict] = []
    for idx, src in enumerate(sources, 1):
        readable = readable_image(src, converted_dir)
        image = ImageOps.exif_transpose(Image.open(readable)).convert("RGB")
        quad, diagnostics = detections[src]
        review_image = image.copy()
        review_image.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
        review_asset = review_image_dir / f"{idx:03d}_{src.stem}.jpg"
        review_image.save(review_asset, quality=90, optimize=True)
        source_quad = [[round(float(x), 2), round(float(y), 2)] for x, y in quad]
        asset_quad = scale_quad(
            quad,
            source_size=(image.width, image.height),
            target_size=(review_image.width, review_image.height),
        )
        review_items.append(
            {
                "filename": src.name,
                "image": str(review_asset.relative_to(output_dir)),
                "origWidth": image.width,
                "origHeight": image.height,
                "assetWidth": review_image.width,
                "assetHeight": review_image.height,
                "sourceQuad": source_quad,
                "assetQuad": asset_quad,
                "method": diagnostics["method"],
                "confidence": diagnostics["confidence"],
                "needsReview": diagnostics["needs_review"],
                "reviewReasons": diagnostics["review_reasons"],
            }
        )
        fill_color = (255, 255, 255) if is_paper_ratio(output_ratio_name) else (0, 0, 0)
        warped = warp_slide_contained(
            image,
            quad,
            out_w,
            out_h,
            source_ratio=source_ratio,
            fill_color=fill_color,
        )
        enhanced = enhance_slide(warped, mode=resolve_enhancement_mode(args))
        out_image = corrected_dir / f"{idx:03d}_{src.stem}.jpg"
        enhanced.save(out_image, quality=args.jpeg_quality, optimize=True)
        corrected.append(out_image)
        draw_overlay(image, quad, overlay_dir / f"{idx:03d}_{src.stem}_overlay.jpg")
        slide_report: ReportSlide = {
            "index": idx,
            "source": str(src),
            "output": str(out_image),
            "quad": [[round(float(x), 2), round(float(y), 2)] for x, y in quad],
            **diagnostics,
        }
        report.append(slide_report)
        print(f"[{idx:02d}/{len(sources):02d}] {src.name}: {diagnostics['method']} confidence={diagnostics['confidence']}")

    pdf_path = output_dir / args.pdf_name
    corrected_contact_sheet = output_dir / "corrected_contact_sheet.jpg"
    detection_contact_sheet = output_dir / "detection_contact_sheet.jpg"
    manual_review_path = output_dir / "manual_review.html"
    review_data_path = output_dir / "manual_review_data.json"
    make_pdf(corrected, pdf_path, page_w=out_w, page_h=out_h)
    make_contact_sheet(corrected, corrected_contact_sheet, "Corrected slide previews")
    make_contact_sheet(sorted(overlay_dir.glob("*.jpg")), detection_contact_sheet, "Detected quadrilaterals")
    make_manual_review_html(review_items, manual_review_path)

    with review_data_path.open("w", encoding="utf-8") as fh:
        json.dump(review_items, fh, indent=2, ensure_ascii=False)

    report_path = output_dir / "slide_lens_report.json"
    batch_summary: BatchSummary = {
        "preliminary_count": len(preliminary_results),
        "reliable_count": sum(
            result["confidence"] >= 0.78 and result["method"] != "fallback-frame"
            for result in preliminary_results
        ),
        "prior_count": len(batch_priors),
        "priors": [
            {
                **prior,
                "normalized_quad": prior["normalized_quad"].tolist(),
            }
            for prior in batch_priors
        ],
    }
    report_document: SlideLensReport = {
        "input_dir": str(input_dir),
        "output_pdf": str(pdf_path),
        "ratio": output_ratio_name,
        "source_slide_ratio": source_ratio_name,
        "output_page_ratio": output_ratio_name,
        "size": [out_w, out_h],
        "batch_summary": batch_summary,
        "slides": report,
    }
    with report_path.open("w", encoding="utf-8") as fh:
        json.dump(report_document, fh, indent=2, ensure_ascii=False)

    if args.clean_converted:
        shutil.rmtree(converted_dir, ignore_errors=True)

    print(f"PDF: {pdf_path}")
    print(f"Report: {report_path}")
    print(f"Manual review: {manual_review_path}")

    return {
        **report_document,
        "output_dir": str(output_dir),
        "report": str(report_path),
        "manual_review": str(manual_review_path),
        "manual_review_data": str(review_data_path),
        "corrected_contact_sheet": str(corrected_contact_sheet),
        "detection_contact_sheet": str(detection_contact_sheet),
        "review_items": review_items,
    }


def resolve_enhancement_mode(args: argparse.Namespace) -> str:
    if getattr(args, "grayscale", False):
        return "bw"
    mode = getattr(args, "enhancement", "original")
    return mode if mode in {"original", "clean", "high-contrast", "bw"} else "original"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Flatten photographed slides and save them as a PDF.")
    parser.add_argument("input", help="Folder containing source photos")
    parser.add_argument("--output-dir", default="outputs/slide_lens_example", help="Output folder")
    parser.add_argument("--work-dir", default="work/slide_lens_runtime", help="Intermediate folder")
    parser.add_argument(
        "--ratio",
        default=None,
        help="Deprecated compatibility option that sets both source and output ratios",
    )
    parser.add_argument(
        "--source-ratio",
        default=None,
        help="Original slide ratio used for correction, e.g. 16:9, 4:3, or 16:10",
    )
    parser.add_argument(
        "--output-ratio",
        default=None,
        help="PDF page ratio, e.g. match-slide, 16:9, A4-landscape, or letter-portrait",
    )
    parser.add_argument("--width", type=int, default=2200, help="Output image width in pixels")
    parser.add_argument("--height", type=int, default=None, help="Optional output image height in pixels")
    parser.add_argument("--pdf-name", default="flattened_slides.pdf", help="PDF filename")
    parser.add_argument("--manual", default=None, help="Optional JSON mapping filenames to four source points")
    parser.add_argument("--jpeg-quality", type=int, default=92)
    parser.add_argument(
        "--enhancement",
        choices=["original", "clean", "high-contrast", "bw"],
        default="original",
        help="Optional readability enhancement after perspective correction",
    )
    parser.add_argument(
        "--grayscale",
        action="store_true",
        help="Deprecated alias for --enhancement bw",
    )
    parser.add_argument("--clean-converted", action="store_true", help="Remove intermediate converted JPEGs")
    return parser


def main() -> None:
    process(build_parser().parse_args())


if __name__ == "__main__":
    main()


__all__ = [
    "Line",
    "RATIO_PRESETS",
    "PAPER_PRESETS",
    "is_paper_ratio",
    "parse_ratio",
    "fit_line_xy",
    "robust_fit",
    "intersect",
    "order_quad",
    "perspective_coefficients",
    "SUPPORTED",
    "list_images",
    "convert_with_sips",
    "readable_image",
    "_center_stats_region",
    "enhance_slide",
    "warp_slide",
    "warp_slide_contained",
    "draw_overlay",
    "make_contact_sheet",
    "make_manual_review_html",
    "scale_quad",
    "make_pdf",
    "contrast_quad",
    "detect_quad",
    "load_manual_quads",
    "process",
    "resolve_enhancement_mode",
    "build_parser",
    "main",
]
