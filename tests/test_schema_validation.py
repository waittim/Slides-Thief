from argparse import Namespace
import json
from pathlib import Path

import jsonschema
import numpy as np
from PIL import Image

from slides_thief.cli import process

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT_DIR / "schemas"


def load_schema(filename: str) -> dict:
    schema_path = SCHEMAS_DIR / filename
    with schema_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def test_slide_lens_report_schema_validates_process_report(tmp_path: Path, monkeypatch) -> None:
    schema = load_schema("slide-lens-report.schema.json")
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    for index in range(1, 4):
        Image.new("RGB", (160, 100), (100 + index, 100, 100)).save(input_dir / f"slide-{index}.jpg")

    source_quad = np.array(
        [[12, 10], [148, 10], [148, 90], [12, 90]],
        dtype=np.float64,
    )

    def fake_detect_quad(image, source_ratio, **kwargs):
        return source_quad.copy(), {
            "method": "contrast-lines",
            "confidence": 0.9,
            "needs_review": False,
            "review_reasons": [],
            "best_score": 0.8,
            "second_best_score": None,
            "candidates_evaluated": 1,
            "diagnostics": {},
        }

    monkeypatch.setattr("slides_thief.cli.detect_quad", fake_detect_quad)
    result = process(
        Namespace(
            input=str(input_dir),
            output_dir=str(output_dir),
            work_dir=str(work_dir),
            ratio=None,
            source_ratio="16:9",
            output_ratio="match-slide",
            width=320,
            height=None,
            pdf_name="slides.pdf",
            manual=None,
            jpeg_quality=92,
            enhancement="original",
            grayscale=False,
            clean_converted=False,
        )
    )

    report = json.loads(Path(result["report"]).read_text(encoding="utf-8"))
    jsonschema.validate(instance=report, schema=schema)

    assert report["batch_summary"]["preliminary_count"] == 3
    assert report["batch_summary"]["reliable_count"] == 3
    assert report["batch_summary"]["prior_count"] == 1
    assert report["batch_summary"]["priors"][0]["member_count"] == 3


def test_manual_quads_schema_validates_sample_manual_quads() -> None:
    schema = load_schema("manual-quads.schema.json")
    sample_manual_quads = {
        "slide_001.jpg": [[10.5, 12.0], [1910.0, 15.5], [1905.0, 1075.0], [12.0, 1068.0]]
    }
    jsonschema.validate(instance=sample_manual_quads, schema=schema)
