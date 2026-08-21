"""Image processing, SIPS transcoding, enhancement, and perspective warping."""

from __future__ import annotations

import subprocess
from collections import OrderedDict
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

from .geometry import perspective_coefficients


SUPPORTED = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif"}
DEFAULT_IMAGE_CACHE_PIXELS = 32_000_000


def load_rgb_image(path: Path) -> Image.Image:
    """Load an orientation-corrected RGB image with deterministic file cleanup."""
    with Image.open(path) as opened:
        oriented = ImageOps.exif_transpose(opened)
        rgb: Image.Image | None = None
        try:
            rgb = oriented.convert("RGB")
            return rgb
        finally:
            # ``opened`` is closed by the context manager.  EXIF correction can
            # create a separate in-memory image, which should not outlive this
            # load operation either.
            if oriented is not opened and oriented is not rgb:
                oriented.close()


class DecodedImageCache:
    """Keep a bounded set of decoded RGB images across the CLI processing passes.

    The cache is deliberately source-order stable instead of evicting older
    entries.  ``process`` visits the same sources in the same order during
    detection, optional batch-prior retry, and export; retaining the first
    entries avoids turning a small cache into a sequential-scan thrash loop.
    Images that do not fit the remaining budget are used for the current
    operation and closed when that operation ends.
    """

    def __init__(self, max_pixels: int = DEFAULT_IMAGE_CACHE_PIXELS) -> None:
        if max_pixels < 0:
            raise ValueError("Image cache pixel budget must be non-negative")
        self.max_pixels = int(max_pixels)
        self._images: OrderedDict[Path, Image.Image] = OrderedDict()
        self._cached_pixels = 0

    @property
    def cached_pixels(self) -> int:
        return self._cached_pixels

    def __enter__(self) -> "DecodedImageCache":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def close(self) -> None:
        for image in self._images.values():
            image.close()
        self._images.clear()
        self._cached_pixels = 0

    @contextmanager
    def open(self, path: Path) -> Iterator[Image.Image]:
        """Yield a decoded image, closing it immediately when it is not cached."""
        key = Path(path)
        cached = self._images.get(key)
        if cached is not None:
            yield cached
            return

        image = load_rgb_image(key)
        pixels = image.width * image.height
        can_cache = self.max_pixels > 0 and pixels <= self.max_pixels - self._cached_pixels
        if can_cache:
            self._images[key] = image
            self._cached_pixels += pixels
            yield image
            return

        try:
            yield image
        finally:
            image.close()


def list_images(input_dir: Path) -> list[Path]:
    return sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED],
        key=lambda p: p.name,
    )


def convert_with_sips(src: Path, dst: Path) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "95", str(src), "--out", str(dst)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return dst


def readable_image(src: Path, converted_dir: Path) -> Path:
    if src.suffix.lower() in {".heic", ".heif"}:
        return convert_with_sips(src, converted_dir / f"{src.stem}.jpg")
    return src


def _center_stats_region(arr: np.ndarray, inset: float = 0.1) -> np.ndarray:
    """Return the centered inset box used for enhancement statistics."""
    height, width = arr.shape[:2]
    x0 = int(width * inset)
    y0 = int(height * inset)
    x1 = max(x0 + 1, int(np.ceil(width * (1.0 - inset))))
    y1 = max(y0 + 1, int(np.ceil(height * (1.0 - inset))))
    return arr[y0:y1, x0:x1]


def enhance_slide(image: Image.Image, mode: str = "original") -> Image.Image:
    rgb = image.convert("RGB")
    if mode == "original":
        return rgb

    arr = np.asarray(rgb).astype(np.float32)
    # Neutralize projector color cast with a gentle gray-world correction.
    # Stats use the centered 80% so edge fill / wall content does not skew correction.
    sample = _center_stats_region(arr)
    means = sample.reshape(-1, 3).mean(axis=0)
    target = means.mean()
    arr *= target / np.maximum(means, 1.0)
    arr = np.clip(arr, 0, 255)

    if mode == "bw":
        gray = (arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114).astype(np.float32)
        sample_gray = _center_stats_region(gray)
        low, high = np.percentile(sample_gray, [2, 98])
        span = max(float(high - low), 8.0)
        gray = np.clip((gray - low) / span * 255.0, 0, 255)
        rgb = Image.fromarray(np.stack([gray, gray, gray], axis=-1).astype(np.uint8))
        rgb = ImageEnhance.Contrast(rgb).enhance(1.28)
        return ImageEnhance.Sharpness(rgb).enhance(1.45)

    if mode == "high-contrast":
        luma = arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114
        sample_luma = _center_stats_region(luma)
        low, high = np.percentile(sample_luma, [1.5, 98.5])
        span = max(float(high - low), 8.0)
        mapped = (luma - low) / span * 255.0
        factor = np.where(luma > 1e-3, mapped / np.maximum(luma, 1e-3), 1.0)
        arr = np.clip(arr * factor[..., None], 0, 255)
        rgb = Image.fromarray(arr.astype(np.uint8))
        rgb = ImageEnhance.Contrast(rgb).enhance(1.3)
        rgb = ImageEnhance.Color(rgb).enhance(0.9)
        return ImageEnhance.Sharpness(rgb).enhance(1.5)

    # clean
    rgb = Image.fromarray(arr.astype(np.uint8))
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    return ImageEnhance.Sharpness(rgb).enhance(1.35)


def warp_slide(
    image: Image.Image,
    quad: np.ndarray,
    out_w: int,
    out_h: int,
    fill_color: tuple[int, int, int] = (0, 0, 0),
) -> Image.Image:
    dst = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float64)
    coeffs = perspective_coefficients(quad, dst)
    warped = image.convert("RGB").transform(
        (out_w, out_h),
        Image.Transform.PERSPECTIVE,
        coeffs,
        Image.Resampling.BICUBIC,
        fillcolor=fill_color,
    )
    return warped


def warp_slide_contained(
    image: Image.Image,
    quad: np.ndarray,
    page_w: int,
    page_h: int,
    source_ratio: float,
    fill_color: tuple[int, int, int] = (0, 0, 0),
) -> Image.Image:
    """Correct to the slide ratio, then contain the slide on the output page."""
    page_ratio = page_w / page_h
    if page_ratio > source_ratio:
        content_h = page_h
        content_w = max(1, round(content_h * source_ratio))
    else:
        content_w = page_w
        content_h = max(1, round(content_w / source_ratio))
    corrected = warp_slide(image, quad, content_w, content_h, fill_color=fill_color)
    page = Image.new("RGB", (page_w, page_h), fill_color)
    page.paste(corrected, ((page_w - content_w) // 2, (page_h - content_h) // 2))
    return page
