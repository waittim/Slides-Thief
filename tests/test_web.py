from pathlib import Path

from slides_thief.web import load_app_html, sanitize_filename, settings_from_json, unique_path


def test_load_app_html_reads_packaged_template() -> None:
    html = load_app_html()

    assert "<title>Slides Thief · PPT捕手</title>" in html
    assert "runAuto" in html


def test_sanitize_filename_strips_path_parts_and_control_chars() -> None:
    assert sanitize_filename("../bad:name\x00.jpg") == "bad_name_.jpg"
    assert sanitize_filename("", fallback="upload.jpg") == "upload.jpg"


def test_unique_path_allocates_next_available_name(tmp_path: Path) -> None:
    (tmp_path / "slide.jpg").write_bytes(b"")
    (tmp_path / "slide-2.jpg").write_bytes(b"")

    assert unique_path(tmp_path, "slide.jpg") == tmp_path / "slide-3.jpg"


def test_settings_from_json_normalizes_fallbacks_and_pdf_name() -> None:
    settings = settings_from_json(
        {"settings": {"ratio": "4:3", "width": 1600, "pdfName": "deck"}},
        {"jpeg_quality": 88, "grayscale": True},
    )

    assert settings == {
        "ratio": "4:3",
        "width": 1600,
        "height": None,
        "jpeg_quality": 88,
        "grayscale": True,
        "pdf_name": "deck.pdf",
    }
