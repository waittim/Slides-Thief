"""Generate deterministic public-safe synthetic detection fixtures."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent / "fixtures" / "detection" / "synthetic"
SIZE = (320, 240)


def make_fixture(
    name: str,
    quad: list[tuple[int, int]],
    background: tuple[int, int, int],
    slide: tuple[int, int, int],
    accent: tuple[int, int, int],
) -> None:
    image = Image.new("RGB", SIZE, background)
    draw = ImageDraw.Draw(image)
    draw.polygon(quad, fill=slide)

    mask = Image.new("1", SIZE)
    ImageDraw.Draw(mask).polygon(quad, fill=1)
    content = Image.new("RGB", SIZE, slide)
    content_draw = ImageDraw.Draw(content)
    for index, width in enumerate((150, 205, 178, 118)):
        y = 74 + index * 24
        content_draw.rounded_rectangle((72, y, 72 + width, y + 7), radius=3, fill=accent)
    content_draw.rectangle((198, 132, 258, 177), outline=accent, width=3)
    image.paste(content, mask=mask)

    ROOT.mkdir(parents=True, exist_ok=True)
    image.save(ROOT / f"{name}.png", optimize=True)
    image.save(ROOT / f"{name}.ppm")


def main() -> None:
    make_fixture(
        "light-slide-dark-wall",
        [(36, 35), (286, 48), (270, 201), (45, 190)],
        (30, 42, 56),
        (236, 234, 222),
        (66, 91, 116),
    )
    make_fixture(
        "dark-slide-light-wall",
        [(38, 30), (282, 24), (296, 210), (25, 202)],
        (224, 218, 203),
        (34, 42, 54),
        (193, 202, 211),
    )
    make_fixture(
        "neutral-slide-color-wall",
        [(52, 44), (276, 33), (288, 198), (40, 210)],
        (48, 134, 142),
        (191, 190, 181),
        (59, 68, 76),
    )


if __name__ == "__main__":
    main()
