import numpy as np

from slides_thief.cli import list_images, order_quad, parse_ratio


def test_parse_ratio_accepts_colon_and_float_values() -> None:
    assert parse_ratio("16:9") == 16 / 9
    assert parse_ratio("1.25") == 1.25


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
