import json
from pathlib import Path
import jsonschema

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT_DIR / "schemas"


def load_schema(filename: str) -> dict:
    schema_path = SCHEMAS_DIR / filename
    with schema_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def test_slide_lens_report_schema_validates_sample_report() -> None:
    schema = load_schema("slide-lens-report.schema.json")
    sample_report = {
        "input_dir": "/path/to/input",
        "output_pdf": "/path/to/output.pdf",
        "ratio": "16:9",
        "source_slide_ratio": "16:9",
        "output_page_ratio": "16:9",
        "size": [1920, 1080],
        "slides": [
            {
                "index": 1,
                "source": "/path/to/input/001.jpg",
                "output": "/path/to/output/001.jpg",
                "quad": [[10, 10], [1910, 10], [1910, 1070], [10, 1070]],
                "method": "contrast-lines",
                "confidence": 0.95,
                "needs_review": False,
            }
        ],
    }
    jsonschema.validate(instance=sample_report, schema=schema)


def test_manual_quads_schema_validates_sample_manual_quads() -> None:
    schema = load_schema("manual-quads.schema.json")
    sample_manual_quads = {
        "slide_001.jpg": [[10.5, 12.0], [1910.0, 15.5], [1905.0, 1075.0], [12.0, 1068.0]]
    }
    jsonschema.validate(instance=sample_manual_quads, schema=schema)
