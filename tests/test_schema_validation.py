import json
from argparse import Namespace
from copy import deepcopy
from importlib import resources
from pathlib import Path

import jsonschema
import numpy as np
import pytest
from PIL import Image

from slides_thief.cli import process
from slides_thief.contracts import (
    ContractValidationError,
    load_manual_quads,
    validate_manual_quad_for_image,
    validate_slide_lens_report,
)

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


def test_manual_quads_schema_rejects_empty_entry_keys() -> None:
    schema = load_schema("manual-quads.schema.json")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(
            instance={"": [[10, 12], [190, 12], [190, 108], [10, 108]]},
            schema=schema,
        )


def test_cli_manual_quads_loader_reports_file_and_corner_for_bad_shape(tmp_path: Path) -> None:
    manual_path = tmp_path / "manual-quads.json"
    manual_path.write_text(
        json.dumps({"slide.jpg": [[10, 20], [100, 20], [100, 80]]}),
        encoding="utf-8",
    )

    with pytest.raises(ContractValidationError, match=r"manual-quads\.json entry 'slide\.jpg'.*4 corner"):
        load_manual_quads(manual_path)


def test_cli_manual_quads_loader_rejects_non_finite_coordinates(tmp_path: Path) -> None:
    manual_path = tmp_path / "manual-quads.json"
    manual_path.write_text('{"slide.jpg": [[NaN, 20], [100, 20], [100, 80], [10, 80]]}', encoding="utf-8")

    with pytest.raises(ContractValidationError, match=r"manual-quads\.json.*non-finite"):
        load_manual_quads(manual_path)


def test_cli_manual_quad_validation_reports_bounds_and_order() -> None:
    with pytest.raises(ContractValidationError, match="outside image bounds"):
        validate_manual_quad_for_image(
            [[-1, 10], [90, 10], [90, 90], [10, 90]],
            filename="slide.jpg",
            image_size=(100, 100),
        )

    with pytest.raises(ContractValidationError, match="top-left, top-right"):
        validate_manual_quad_for_image(
            [[90, 90], [10, 90], [10, 10], [90, 10]],
            filename="slide.jpg",
            image_size=(100, 100),
        )


def test_process_rejects_bad_manual_quad_before_detection(tmp_path: Path, monkeypatch) -> None:
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    Image.new("RGB", (100, 100), (80, 80, 80)).save(input_dir / "slide.jpg")
    manual_path = tmp_path / "manual.json"
    manual_path.write_text(
        json.dumps({"slide.jpg": [[-1, 10], [90, 10], [90, 90], [10, 90]]}),
        encoding="utf-8",
    )

    def should_not_detect(*args, **kwargs):
        raise AssertionError("invalid manual input reached the detector")

    monkeypatch.setattr("slides_thief.cli.detect_quad", should_not_detect)
    with pytest.raises(ContractValidationError, match="outside image bounds"):
        process(
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
                manual=str(manual_path),
                jpeg_quality=92,
                enhancement="original",
                grayscale=False,
                clean_converted=False,
            )
        )


def test_runtime_report_validator_rejects_invalid_confidence() -> None:
    report = {
        "input_dir": "input",
        "output_pdf": "output.pdf",
        "ratio": "16:9",
        "source_slide_ratio": "16:9",
        "output_page_ratio": "match-slide",
        "size": [100, 56],
        "batch_summary": {
            "preliminary_count": 0,
            "reliable_count": 0,
            "prior_count": 0,
            "priors": [],
        },
        "slides": [
            {
                "index": 1,
                "source": "slide.jpg",
                "output": "slide-out.jpg",
                "quad": [[0, 0], [100, 0], [100, 56], [0, 56]],
                "method": "manual",
                "confidence": 1.5,
            }
        ],
    }

    with pytest.raises(ContractValidationError, match="confidence"):
        validate_slide_lens_report(report)


def test_packaged_schemas_match_public_schemas() -> None:
    for filename in ("manual-quads.schema.json", "slide-lens-report.schema.json"):
        packaged = json.loads(
            resources.files("slides_thief.schemas").joinpath(filename).read_text(encoding="utf-8")
        )
        assert packaged == load_schema(filename)


def test_runtime_report_validator_uses_all_public_schema_constraints() -> None:
    report = {
        "input_dir": "input",
        "output_pdf": "output.pdf",
        "ratio": "16:9",
        "source_slide_ratio": "16:9",
        "output_page_ratio": "match-slide",
        "size": [100, 56],
        "batch_summary": {
            "preliminary_count": 3,
            "reliable_count": 3,
            "prior_count": 1,
            "priors": [
                {
                    "id": "landscape-1",
                    "orientation": "landscape",
                    "normalized_quad": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
                    "member_count": 3,
                    "rms_deviation": 0.01,
                    "consistency": 0.9,
                }
            ],
        },
        "slides": [],
    }
    validate_slide_lens_report(report)

    invalid_reports = []

    member_count = deepcopy(report)
    member_count["batch_summary"]["priors"][0]["member_count"] = 1
    invalid_reports.append(("member_count", member_count))

    top_level_extra = deepcopy(report)
    top_level_extra["unexpected"] = True
    invalid_reports.append(("top-level additional property", top_level_extra))

    summary_extra = deepcopy(report)
    summary_extra["batch_summary"]["unexpected"] = True
    invalid_reports.append(("batch summary additional property", summary_extra))

    prior_extra = deepcopy(report)
    prior_extra["batch_summary"]["priors"][0]["unexpected"] = True
    invalid_reports.append(("batch prior additional property", prior_extra))

    feature_type = deepcopy(report)
    feature_type["slides"] = [
        {
            "index": 1,
            "source": "slide.jpg",
            "output": "slide-out.jpg",
            "quad": [[0, 0], [100, 0], [100, 56], [0, 56]],
            "method": "manual",
            "confidence": 1,
            "features": {"edge_strength": "not-a-number"},
        }
    ]
    invalid_reports.append(("known feature type", feature_type))

    for label, candidate in invalid_reports:
        with pytest.raises(ContractValidationError):
            validate_slide_lens_report(candidate)
        try:
            jsonschema.validate(instance=candidate, schema=load_schema("slide-lens-report.schema.json"))
        except jsonschema.ValidationError:
            continue
        raise AssertionError(f"public schema accepted invalid {label}")
