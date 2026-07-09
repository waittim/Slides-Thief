"""Local browser workflow for Slides Thief.

The web UI intentionally runs as a small local server so the browser can handle
review interactions while the existing Python image pipeline keeps doing the
heavy lifting.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import secrets
import traceback
from datetime import datetime
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlparse

from PIL import Image, ImageOps

from .cli import SUPPORTED, parse_ratio, process, readable_image


DEFAULT_JOBS_DIR = Path("outputs/web_jobs")


def load_app_html() -> str:
    return files(__package__).joinpath("templates", "app.html").read_text(encoding="utf-8")


def truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def sanitize_filename(filename: str, fallback: str = "upload") -> str:
    name = Path(filename.replace("\\", "/")).name.strip()
    name = re.sub(r"[\x00-\x1f:]", "_", name)
    if not name or name in {".", ".."}:
        name = fallback
    return name


def unique_path(directory: Path, filename: str) -> Path:
    path = directory / filename
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    for idx in range(2, 10000):
        candidate = directory / f"{stem}-{idx}{suffix}"
        if not candidate.exists():
            return candidate
    raise ValueError(f"Could not allocate a unique filename for {filename}")


def parse_multipart(headers: Any, body: bytes) -> tuple[dict[str, str], list[tuple[str, str, bytes]]]:
    content_type = headers.get("Content-Type", "")
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
    )
    fields: dict[str, str] = {}
    files: list[tuple[str, str, bytes]] = []
    if not message.is_multipart():
        return fields, files

    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            files.append((name, filename, payload))
        else:
            charset = part.get_content_charset() or "utf-8"
            fields[name] = payload.decode(charset, errors="replace")
    return fields, files


def settings_from_fields(fields: dict[str, str]) -> dict[str, Any]:
    ratio = (fields.get("ratio") or "16:9").strip()
    parse_ratio(ratio)
    width = max(320, min(8000, int(fields.get("width") or 2400)))
    height_raw = fields.get("height")
    height = max(240, min(8000, int(height_raw))) if height_raw else None
    jpeg_quality = max(50, min(98, int(fields.get("jpeg_quality") or fields.get("jpegQuality") or 92)))
    pdf_name = sanitize_filename(fields.get("pdf_name") or fields.get("pdfName") or "flattened_slides.pdf")
    if not pdf_name.lower().endswith(".pdf"):
        pdf_name = f"{pdf_name}.pdf"
    return {
        "ratio": ratio,
        "width": width,
        "height": height,
        "jpeg_quality": jpeg_quality,
        "grayscale": truthy(fields.get("grayscale")),
        "pdf_name": pdf_name,
    }


def settings_from_json(payload: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("settings") or {}
    fields = {
        "ratio": str(raw.get("ratio") or fallback.get("ratio") or "16:9"),
        "width": str(raw.get("width") or fallback.get("width") or 2400),
        "height": "" if raw.get("height") in {None, ""} else str(raw.get("height")),
        "jpegQuality": str(raw.get("jpegQuality") or fallback.get("jpeg_quality") or 92),
        "grayscale": "1" if raw.get("grayscale", fallback.get("grayscale", False)) else "0",
        "pdfName": str(raw.get("pdfName") or fallback.get("pdf_name") or "flattened_slides.pdf"),
    }
    return settings_from_fields(fields)


def run_pipeline(input_dir: Path, output_dir: Path, work_dir: Path, settings: dict[str, Any], manual: Path | None) -> dict:
    args = argparse.Namespace(
        input=str(input_dir),
        output_dir=str(output_dir),
        work_dir=str(work_dir),
        ratio=settings["ratio"],
        width=settings["width"],
        height=settings["height"],
        pdf_name=settings["pdf_name"],
        manual=str(manual) if manual else None,
        jpeg_quality=settings["jpeg_quality"],
        grayscale=settings["grayscale"],
        clean_converted=False,
    )
    return process(args)


def file_url(job_id: str, stage: str, rel_path: str) -> str:
    rel = rel_path.replace("\\", "/").lstrip("/")
    return f"/files/{quote(job_id)}/{quote(stage)}/{quote(rel, safe='/')}"


def preview_file_url(preview_id: str, rel_path: str) -> str:
    rel = rel_path.replace("\\", "/").lstrip("/")
    return f"/preview-files/{quote(preview_id)}/{quote(rel, safe='/')}"


def relative_to(path: str | Path, root: Path) -> str:
    return str(Path(path).resolve().relative_to(root.resolve())).replace("\\", "/")


def result_response(job_id: str, stage: str, output_dir: Path, result: dict, settings: dict[str, Any]) -> dict:
    slides = []
    review_items = result.get("review_items") or []
    reports = result.get("slides") or []
    for item, report in zip(review_items, reports):
        corrected_rel = relative_to(report["output"], output_dir)
        overlay_name = f"{Path(report['output']).stem}_overlay.jpg"
        slide = {
            "index": report["index"],
            "filename": item["filename"],
            "imageUrl": file_url(job_id, stage, item["image"]),
            "correctedUrl": file_url(job_id, stage, corrected_rel),
            "overlayUrl": file_url(job_id, stage, f"detection_overlays/{overlay_name}"),
            "origWidth": item["origWidth"],
            "origHeight": item["origHeight"],
            "assetWidth": item["assetWidth"],
            "assetHeight": item["assetHeight"],
            "quad": item["quad"],
            "method": item["method"],
            "confidence": item["confidence"],
        }
        slides.append(slide)

    return {
        "jobId": job_id,
        "stage": stage,
        "settings": settings,
        "slides": slides,
        "pdfUrl": file_url(job_id, stage, relative_to(result["output_pdf"], output_dir)),
        "reportUrl": file_url(job_id, stage, relative_to(result["report"], output_dir)),
        "manualReviewUrl": file_url(job_id, stage, relative_to(result["manual_review"], output_dir)),
        "manualReviewDataUrl": file_url(job_id, stage, relative_to(result["manual_review_data"], output_dir)),
        "correctedContactSheetUrl": file_url(job_id, stage, relative_to(result["corrected_contact_sheet"], output_dir)),
        "detectionContactSheetUrl": file_url(job_id, stage, relative_to(result["detection_contact_sheet"], output_dir)),
    }


def new_job_id() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{stamp}-{secrets.token_hex(3)}"


def make_preview(input_path: Path, preview_root: Path) -> dict:
    converted_dir = preview_root / "converted"
    readable = readable_image(input_path, converted_dir)
    image = ImageOps.exif_transpose(Image.open(readable)).convert("RGB")
    preview = image.copy()
    preview.thumbnail((1800, 1400), Image.Resampling.LANCZOS)
    output = preview_root / "preview.jpg"
    output.parent.mkdir(parents=True, exist_ok=True)
    preview.save(output, quality=90, optimize=True)
    return {
        "image": "preview.jpg",
        "origWidth": image.width,
        "origHeight": image.height,
        "assetWidth": preview.width,
        "assetHeight": preview.height,
    }


class SlidesThiefHandler(BaseHTTPRequestHandler):
    server_version = "SlidesThiefWeb/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    @property
    def jobs_dir(self) -> Path:
        return self.server.jobs_dir  # type: ignore[attr-defined]

    def send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_text(self, text: str, content_type: str = "text/html; charset=utf-8") -> None:
        data = text.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json({"error": message}, status)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/", "/index.html"}:
            self.send_text(load_app_html())
            return
        if parsed.path.startswith("/files/"):
            self.serve_file(parsed.path)
            return
        if parsed.path.startswith("/preview-files/"):
            self.serve_preview_file(parsed.path)
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/jobs":
                self.create_job()
                return
            if parsed.path == "/api/previews":
                self.create_preview()
                return
            match = re.fullmatch(r"/api/jobs/([^/]+)/refine", parsed.path)
            if match:
                self.refine_job(unquote(match.group(1)))
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
        except Exception as exc:  # pragma: no cover - useful while running locally
            traceback.print_exc()
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def read_body(self) -> bytes:
        length = self.headers.get("Content-Length")
        if not length:
            raise ValueError("Missing Content-Length")
        return self.rfile.read(int(length))

    def create_job(self) -> None:
        body = self.read_body()
        fields, uploads = parse_multipart(self.headers, body)
        settings = settings_from_fields(fields)
        job_id = new_job_id()
        job_root = (self.jobs_dir / job_id).resolve()
        input_dir = job_root / "input"
        output_dir = job_root / "auto"
        work_dir = job_root / "work"
        input_dir.mkdir(parents=True, exist_ok=True)

        saved = []
        for field_name, filename, payload in uploads:
            if field_name != "files":
                continue
            clean = sanitize_filename(filename, fallback=f"image-{len(saved) + 1}")
            if Path(clean).suffix.lower() not in SUPPORTED:
                continue
            target = unique_path(input_dir, clean)
            target.write_bytes(payload)
            saved.append(target.name)

        if not saved:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "No supported images were uploaded")
            return

        meta = {
            "job_id": job_id,
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "settings": settings,
            "source_files": sorted(saved),
        }
        (job_root / "job.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

        result = run_pipeline(input_dir, output_dir, work_dir, settings, manual=None)
        self.send_json(result_response(job_id, "auto", output_dir, result, settings))

    def create_preview(self) -> None:
        body = self.read_body()
        _, uploads = parse_multipart(self.headers, body)
        upload = next((item for item in uploads if item[0] == "file"), None)
        if not upload:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "No preview file was uploaded")
            return

        _, filename, payload = upload
        clean = sanitize_filename(filename, fallback="preview")
        if Path(clean).suffix.lower() not in SUPPORTED:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Unsupported image type")
            return

        preview_id = new_job_id()
        preview_root = (self.jobs_dir / "_previews" / preview_id).resolve()
        preview_root.mkdir(parents=True, exist_ok=True)
        input_path = unique_path(preview_root, clean)
        input_path.write_bytes(payload)
        preview = make_preview(input_path, preview_root)
        self.send_json(
            {
                "previewId": preview_id,
                "filename": clean,
                "imageUrl": preview_file_url(preview_id, preview["image"]),
                "origWidth": preview["origWidth"],
                "origHeight": preview["origHeight"],
                "assetWidth": preview["assetWidth"],
                "assetHeight": preview["assetHeight"],
            }
        )

    def refine_job(self, job_id: str) -> None:
        if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[a-f0-9]{6}", job_id):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Invalid job id")
            return
        job_root = (self.jobs_dir / job_id).resolve()
        input_dir = job_root / "input"
        meta_path = job_root / "job.json"
        if not input_dir.exists() or not meta_path.exists():
            self.send_error_json(HTTPStatus.NOT_FOUND, "Job not found")
            return

        payload = json.loads(self.read_body().decode("utf-8"))
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        settings = settings_from_json(payload, meta.get("settings") or {})
        manual_quads = payload.get("manualQuads")
        if not isinstance(manual_quads, dict):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "manualQuads must be an object")
            return

        manual_path = job_root / "manual_quads.json"
        manual_path.write_text(json.dumps(manual_quads, indent=2, ensure_ascii=False), encoding="utf-8")
        output_dir = job_root / "refined"
        work_dir = job_root / "work"
        result = run_pipeline(input_dir, output_dir, work_dir, settings, manual=manual_path)
        self.send_json(result_response(job_id, "refined", output_dir, result, settings))

    def serve_file(self, path: str) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) < 4:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        _, job_id, stage, *rel_parts = parts
        if stage not in {"auto", "refined"}:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        root = (self.jobs_dir / job_id / stage).resolve()
        target = (root / Path(*rel_parts)).resolve()
        if root != target and root not in target.parents:
            self.send_error_json(HTTPStatus.FORBIDDEN, "Forbidden")
            return
        if not target.is_file():
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return

        data = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def serve_preview_file(self, path: str) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) < 3:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        _, preview_id, *rel_parts = parts
        if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[a-f0-9]{6}", preview_id):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Invalid preview id")
            return
        root = (self.jobs_dir / "_previews" / preview_id).resolve()
        target = (root / Path(*rel_parts)).resolve()
        if root != target and root not in target.parents:
            self.send_error_json(HTTPStatus.FORBIDDEN, "Forbidden")
            return
        if not target.is_file():
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return

        data = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def serve(host: str, port: int, jobs_dir: Path) -> None:
    jobs_dir = jobs_dir.expanduser().resolve()
    jobs_dir.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((host, port), SlidesThiefHandler)
    server.jobs_dir = jobs_dir  # type: ignore[attr-defined]
    print(f"Slides Thief web UI: http://{host}:{port}")
    print(f"Jobs directory: {jobs_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
    finally:
        server.server_close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the local Slides Thief web UI.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--jobs-dir", default=str(DEFAULT_JOBS_DIR), help="Where uploaded jobs and outputs are stored")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    serve(args.host, args.port, Path(args.jobs_dir))


if __name__ == "__main__":
    main()
