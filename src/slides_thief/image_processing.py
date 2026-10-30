"""Image processing, SIPS transcoding, enhancement, and perspective warping."""

from __future__ import annotations

import subprocess
from collections import OrderedDict
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from .geometry import perspective_coefficients
from .product_metadata import PRODUCT_METADATA

SUPPORTED = {
    extension
    for item in PRODUCT_METADATA["input_formats"]
    if item["cli"]
    for extension in item["extensions"]
}
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

    def __enter__(self):
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
        capture_output=True,
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
    synthetic_mask = (arr >= 254.0).all(axis=-1)
    # Neutralize projector color cast with a gentle gray-world correction.
    # Stats use the centered 80% so edge fill / wall content does not skew correction.
    sample = _center_stats_region(arr)
    means = sample.reshape(-1, 3).mean(axis=0)
    target = means.mean()
    arr *= target / np.maximum(means, 1.0)
    arr[synthetic_mask] = 255.0
    arr = np.clip(arr, 0, 255)

    if mode == "bw":
        gray = (arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114).astype(np.float32)
        h, w = gray.shape
        block_size = max(16, min(w, h) // 64)
        grid_h = int(np.ceil(h / block_size))
        grid_w = int(np.ceil(w / block_size))
        pad_h = grid_h * block_size - h
        pad_w = grid_w * block_size - w
        padded = np.pad(gray, ((0, pad_h), (0, pad_w)), mode="edge")

        blocks = padded.reshape(grid_h, block_size, grid_w, block_size).swapaxes(1, 2)
        non_syn_mask = blocks < 254.5
        non_syn_counts = np.sum(non_syn_mask, axis=(2, 3))
        total_counts = block_size * block_size
        is_synthetic = non_syn_counts < (total_counts * 0.2)

        bg_grid = np.zeros((grid_h, grid_w), dtype=np.float32)
        for r_idx in range(grid_h):
            for c_idx in range(grid_w):
                b_pixels = blocks[r_idx, c_idx][non_syn_mask[r_idx, c_idx]]
                if len(b_pixels) > 0:
                    bg_grid[r_idx, c_idx] = np.percentile(b_pixels, 88)
                else:
                    bg_grid[r_idx, c_idx] = 255.0
        for r_idx in range(grid_h):
            last_valid = None
            for c_idx in range(grid_w):
                if not is_synthetic[r_idx, c_idx]:
                    last_valid = bg_grid[r_idx, c_idx]
                elif last_valid is not None:
                    bg_grid[r_idx, c_idx] = last_valid
            last_valid = None
            for c_idx in range(grid_w - 1, -1, -1):
                if not is_synthetic[r_idx, c_idx]:
                    last_valid = bg_grid[r_idx, c_idx]
                elif last_valid is not None:
                    bg_grid[r_idx, c_idx] = last_valid

        for c_idx in range(grid_w):
            last_valid = None
            for r_idx in range(grid_h):
                if not is_synthetic[r_idx, c_idx]:
                    last_valid = bg_grid[r_idx, c_idx]
                elif last_valid is not None:
                    bg_grid[r_idx, c_idx] = last_valid
            last_valid = None
            for r_idx in range(grid_h - 1, -1, -1):
                if not is_synthetic[r_idx, c_idx]:
                    last_valid = bg_grid[r_idx, c_idx]
                elif last_valid is not None:
                    bg_grid[r_idx, c_idx] = last_valid

        bg_img = Image.fromarray(np.clip(bg_grid, 0, 255).astype(np.uint8)).resize(
            (w, h), Image.Resampling.BICUBIC
        )
        bg = np.maximum(np.asarray(bg_img, dtype=np.float32), 1.0)

        r = gray / bg
        knee = 0.86
        gamma = 2.05
        mapped = np.where(gray >= 254.5, 255.0, np.where(r >= knee, 1.0, (r / knee) ** gamma) * 255.0)
        normalized_gray = np.clip(mapped, 0, 255).astype(np.uint8)

        rgb = Image.fromarray(np.stack([normalized_gray, normalized_gray, normalized_gray], axis=-1))
        if min(w, h) >= 3:
            return rgb.filter(ImageFilter.UnsharpMask(radius=0.8, percent=45, threshold=2))
        return rgb

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


def compute_safety_inset_quad(quad: np.ndarray, factor: float = 0.007) -> np.ndarray:
    """Apply a subtle safety inset towards the quadrilateral centroid.

    Shifting the sampling rays 0.5% - 0.8% inward prevents sampling outer desk surfaces,
    shadows, and background bleed without cutting into document or presentation margins.
    """
    if factor <= 0:
        return np.asarray(quad, dtype=np.float64)
    q = np.asarray(quad, dtype=np.float64)
    center = q.mean(axis=0)
    scale = 1.0 - factor
    return center + (q - center) * scale


def clean_dark_perimeter(image: Image.Image, depth: int = 4) -> Image.Image:
    """Suppress residual dark perimeter lines and corner overshoots via directional inpainting."""
    w, h = image.size
    if w < 64 or h < 64 or depth < 1:
        return image
    arr = np.array(image.convert("RGB")).copy()
    gray = arr.mean(axis=2)

    x0 = int(w * 0.1)
    y0 = int(h * 0.1)
    x1 = max(x0 + 1, int(w * 0.9))
    y1 = max(y0 + 1, int(h * 0.9))
    interior = gray[y0:y1, x0:x1]
    if interior.size == 0:
        return image

    p80 = float(np.percentile(interior, 80))
    if p80 < 50:
        return image  # dark background slide

    dark_threshold = p80 * 0.85
    max_scan = min(max(depth, int(min(w, h) * 0.08)), 96)

    # 1. Corner anchor inpainting for acute overshoots where orthogonal rays stay outside paper
    def find_corner_ref(start_x: int, start_y: int, step_x: int, step_y: int) -> np.ndarray | None:
        for step in range(0, max_scan, 2):
            cx = start_x + step * step_x
            cy = start_y + step * step_y
            if 0 <= cx < w and 0 <= cy < h and gray[cy, cx] >= dark_threshold:
                return arr[cy, cx]
        return None

    tl_ref = find_corner_ref(max_scan, max_scan, 1, 1)
    tr_ref = find_corner_ref(w - 1 - max_scan, max_scan, -1, 1)
    bl_ref = find_corner_ref(max_scan, h - 1 - max_scan, 1, -1)
    br_ref = find_corner_ref(w - 1 - max_scan, h - 1 - max_scan, -1, -1)

    if tl_ref is not None:
        for y in range(max_scan):
            for x in range(max_scan):
                if gray[y, x] < dark_threshold:
                    arr[y, x] = tl_ref
                    gray[y, x] = dark_threshold

    if tr_ref is not None:
        for y in range(max_scan):
            for x in range(w - 1, w - 1 - max_scan, -1):
                if gray[y, x] < dark_threshold:
                    arr[y, x] = tr_ref
                    gray[y, x] = dark_threshold

    if bl_ref is not None:
        for y in range(h - 1, h - 1 - max_scan, -1):
            for x in range(max_scan):
                if gray[y, x] < dark_threshold:
                    arr[y, x] = bl_ref
                    gray[y, x] = dark_threshold

    if br_ref is not None:
        for y in range(h - 1, h - 1 - max_scan, -1):
            for x in range(w - 1, w - 1 - max_scan, -1):
                if gray[y, x] < dark_threshold:
                    arr[y, x] = br_ref
                    gray[y, x] = dark_threshold

    # 2. Top edge (downward ray search)
    for x in range(w):
        ref_slice = gray[max_scan : min(h, max_scan + 25) : 2, x]
        max_ref = float(np.max(ref_slice)) if len(ref_slice) > 0 else 0.0
        col_threshold = max(dark_threshold, max_ref * 0.88)
        for y in range(max_scan):
            if gray[y, x] < col_threshold:
                clean_y = None
                for sy in range(y + 1, min(h, max_scan + 1)):
                    if gray[sy, x] >= col_threshold:
                        clean_y = sy
                        break
                if clean_y is not None:
                    arr[y, x] = arr[clean_y, x]
                    gray[y, x] = gray[clean_y, x]

    # 2. Bottom edge (upward ray search)
    for x in range(w):
        ref_slice = gray[max(0, h - 1 - max_scan - 24) : h - max_scan : 2, x]
        max_ref = float(np.max(ref_slice)) if len(ref_slice) > 0 else 0.0
        col_threshold = max(dark_threshold, max_ref * 0.88)
        for y in range(h - 1, max(-1, h - 1 - max_scan), -1):
            if gray[y, x] < col_threshold:
                clean_y = None
                for sy in range(y - 1, max(-1, h - 1 - max_scan - 1), -1):
                    if gray[sy, x] >= col_threshold:
                        clean_y = sy
                        break
                if clean_y is not None:
                    arr[y, x] = arr[clean_y, x]
                    gray[y, x] = gray[clean_y, x]

    # 3. Left edge (rightward ray search)
    for y in range(h):
        ref_slice = gray[y, max_scan : min(w, max_scan + 25) : 2]
        max_ref = float(np.max(ref_slice)) if len(ref_slice) > 0 else 0.0
        row_threshold = max(dark_threshold, max_ref * 0.88)
        for x in range(max_scan):
            if gray[y, x] < row_threshold:
                clean_x = None
                for sx in range(x + 1, min(w, max_scan + 1)):
                    if gray[y, sx] >= row_threshold:
                        clean_x = sx
                        break
                if clean_x is not None:
                    arr[y, x] = arr[y, clean_x]
                    gray[y, x] = gray[y, clean_x]

    # 4. Right edge (leftward ray search)
    for y in range(h):
        ref_slice = gray[y, max(0, w - 1 - max_scan - 24) : w - max_scan : 2]
        max_ref = float(np.max(ref_slice)) if len(ref_slice) > 0 else 0.0
        row_threshold = max(dark_threshold, max_ref * 0.88)
        for x in range(w - 1, max(-1, w - 1 - max_scan), -1):
            if gray[y, x] < row_threshold:
                clean_x = None
                for sx in range(x - 1, max(-1, w - 1 - max_scan - 1), -1):
                    if gray[y, sx] >= row_threshold:
                        clean_x = sx
                        break
                if clean_x is not None:
                    arr[y, x] = arr[y, clean_x]
                    gray[y, x] = gray[y, clean_x]

    # 5. Clean outermost 1-pixel boundary to prevent residual subpixel border lines
    rim_threshold = p80 * 0.95
    if h > 2:
        for x in range(w):
            if gray[0, x] < rim_threshold and gray[1, x] >= dark_threshold:
                arr[0, x] = arr[1, x]
                gray[0, x] = gray[1, x]
            if gray[h - 1, x] < rim_threshold and gray[h - 2, x] >= dark_threshold:
                arr[h - 1, x] = arr[h - 2, x]
                gray[h - 1, x] = gray[h - 2, x]
    if w > 2:
        for y in range(h):
            if gray[y, 0] < rim_threshold and gray[y, 1] >= dark_threshold:
                arr[y, 0] = arr[y, 1]
                gray[y, 0] = gray[y, 1]
            if gray[y, w - 1] < rim_threshold and gray[y, w - 2] >= dark_threshold:
                arr[y, w - 1] = arr[y, w - 2]
                gray[y, w - 1] = gray[y, w - 2]

    return Image.fromarray(arr)


def warp_slide(
    image: Image.Image,
    quad: np.ndarray,
    out_w: int,
    out_h: int,
    fill_color: tuple[int, int, int] = (0, 0, 0),
    safety_inset: float | None = None,
    suppress_dark_borders: bool | None = None,
) -> Image.Image:
    is_realistic = out_w >= 64 and out_h >= 64
    inset = safety_inset if safety_inset is not None else (0.007 if is_realistic else 0.0)
    effective_quad = compute_safety_inset_quad(quad, inset) if inset > 0 else np.asarray(quad, dtype=np.float64)

    dst = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float64)
    coeffs = perspective_coefficients(effective_quad, dst)
    warped = image.convert("RGB").transform(
        (out_w, out_h),
        Image.Transform.PERSPECTIVE,
        coeffs,
        Image.Resampling.BICUBIC,
        fillcolor=fill_color,
    )

    should_clean = suppress_dark_borders if suppress_dark_borders is not None else is_realistic
    if should_clean:
        warped = clean_dark_perimeter(warped)

    return warped


def warp_slide_contained(
    image: Image.Image,
    quad: np.ndarray,
    page_w: int,
    page_h: int,
    source_ratio: float,
    fill_color: tuple[int, int, int] = (0, 0, 0),
    safety_inset: float | None = None,
    suppress_dark_borders: bool | None = None,
) -> Image.Image:
    """Correct to the slide ratio, then contain the slide on the output page."""
    page_ratio = page_w / page_h
    if page_ratio > source_ratio:
        content_h = page_h
        content_w = max(1, round(content_h * source_ratio))
    else:
        content_w = page_w
        content_h = max(1, round(content_w / source_ratio))
    corrected = warp_slide(
        image,
        quad,
        content_w,
        content_h,
        fill_color=fill_color,
        safety_inset=safety_inset,
        suppress_dark_borders=suppress_dark_borders,
    )
    page = Image.new("RGB", (page_w, page_h), fill_color)
    page.paste(corrected, ((page_w - content_w) // 2, (page_h - content_h) // 2))
    return page
