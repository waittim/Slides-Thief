"""Generate deterministic public-safe synthetic detection fixtures."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent / "fixtures" / "detection" / "synthetic"
SIZE = (320, 240)


def save_fixture(name: str, image: Image.Image) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    image.save(ROOT / f"{name}.png", optimize=True)
    image.save(ROOT / f"{name}.ppm")


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

    save_fixture(name, image)


def make_plain_fixture(
    name: str,
    size: tuple[int, int],
    quad: list[tuple[int, int]],
    background: tuple[int, int, int],
    slide: tuple[int, int, int],
) -> Image.Image:
    image = Image.new("RGB", size, background)
    if quad:
        ImageDraw.Draw(image).polygon(quad, fill=slide)
    save_fixture(name, image)
    return image


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
    make_plain_fixture(
        "hough-rotated",
        (180, 125),
        [(36, 15), (159, 38), (139, 111), (18, 83)],
        (22, 22, 22),
        (225, 225, 225),
    )
    make_plain_fixture(
        "batch-prior-rotated",
        (180, 125),
        [(36, 15), (159, 38), (139, 111), (18, 83)],
        (22, 22, 22),
        (225, 225, 225),
    )
    make_plain_fixture(
        "portrait-slide",
        (180, 320),
        [(36, 28), (155, 18), (160, 294), (22, 304)],
        (35, 45, 58),
        (232, 230, 218),
    )
    make_plain_fixture(
        "fallback-solid",
        (160, 100),
        [],
        (128, 128, 128),
        (128, 128, 128),
    )
    occluded = make_plain_fixture(
        "occluded-slide",
        SIZE,
        [(34, 30), (290, 42), (275, 207), (43, 196)],
        (35, 45, 58),
        (232, 230, 218),
    )
    ImageDraw.Draw(occluded).rectangle((80, 135, 245, 239), fill=(35, 45, 58))
    save_fixture("occluded-slide", occluded)
    make_plain_fixture(
        "out-of-bounds-slide",
        SIZE,
        [(-10, -18), (310, -8), (275, 205), (35, 195)],
        (35, 45, 58),
        (232, 230, 218),
    )


if __name__ == "__main__":
    main()
