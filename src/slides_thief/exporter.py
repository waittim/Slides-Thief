"""Exporters for PDF slide decks, contact sheets, overlays, and manual review app."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .product_metadata import PRODUCT_METADATA


def scale_quad(
    quad: np.ndarray | list[list[float]],
    source_size: tuple[int, int],
    target_size: tuple[int, int],
) -> list[list[float]]:
    """Scale quadrilateral coordinates between image spaces independently on X and Y."""
    source_width, source_height = source_size
    target_width, target_height = target_size
    if source_width <= 0 or source_height <= 0 or target_width <= 0 or target_height <= 0:
        raise ValueError("Image dimensions must be positive")

    x_scale = target_width / source_width
    y_scale = target_height / source_height
    return [
        [round(float(x) * x_scale, 2), round(float(y) * y_scale, 2)]
        for x, y in quad
    ]


def draw_overlay(image: Image.Image, quad: np.ndarray, output: Path) -> None:
    overlay = image.convert("RGB").copy()
    overlay.thumbnail((1200, 900), Image.Resampling.LANCZOS)
    sx = overlay.width / image.width
    sy = overlay.height / image.height
    scaled = [(float(x * sx), float(y * sy)) for x, y in quad]
    draw = ImageDraw.Draw(overlay)
    draw.line(scaled + [scaled[0]], fill=(255, 64, 64), width=5)
    for i, point in enumerate(scaled, 1):
        x, y = point
        r = 8
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 230, 0), outline=(40, 40, 40), width=2)
        draw.text((x + 10, y - 12), str(i), fill=(255, 230, 0))
    output.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(output, quality=90)


def make_contact_sheet(images: list[Path], output: Path, title: str) -> None:
    if not images:
        return
    cell_w, cell_h = 360, 240
    label_h = 28
    cols = min(4, len(images))
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h) + 36), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), title, fill=(0, 0, 0))
    for idx, path in enumerate(images):
        with Image.open(path) as opened:
            with opened.convert("RGB") as im:
                im.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
                x = (idx % cols) * cell_w
                y = 36 + (idx // cols) * (cell_h + label_h)
                sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2))
                draw.text((x + 8, y + cell_h + 6), path.stem, fill=(0, 0, 0))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def _json_for_html_script(value: object) -> str:
    """Serialize data for an inert JSON script element without ending the element."""
    return (
        json.dumps(value, ensure_ascii=False)
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def make_manual_review_html(items: list[dict], output: Path) -> None:
    payload = _json_for_html_script(items)
    product_name = PRODUCT_METADATA["name"]
    html = f"""<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{product_name} Manual Review</title>
<style>
:root {{
  color-scheme: light;
  --bg: #f5f7f8;
  --panel: #ffffff;
  --text: #1f272c;
  --muted: #66747d;
  --line: #d8e0e5;
  --accent: #e24b3c;
  --handle: #ffd84a;
  --control-bg: #ffffff;
  --control-hover: #aebbc4;
  --primary-bg: #1f272c;
  --primary-text: #ffffff;
  --canvas-bg: #111111;
  --canvas-border: #20272c;
  --toast-text: #ffffff;
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #101416;
  --panel: #181e22;
  --text: #e6edf2;
  --muted: #8b9a1a;
  --muted: #8b9ba5;
  --line: #2b353c;
  --accent: #ff6b5b;
  --handle: #ffe066;
  --control-bg: #222b31;
  --control-hover: #334049;
  --primary-bg: #e6edf2;
  --primary-text: #101416;
  --canvas-bg: #090c0e;
  --canvas-border: #222b31;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}}
header {{
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}}
header h1 {{ margin: 0; font-size: 18px; }}
header p {{ margin: 4px 0 0 0; color: var(--muted); font-size: 13px; }}
.controls {{ display: flex; gap: 8px; align-items: center; }}
.btn {{
  border: 1px solid var(--line);
  background: var(--control-bg);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}}
.btn:hover {{ background: var(--control-hover); }}
.btn:disabled {{ opacity: 0.5; cursor: not-allowed; }}
.btn.primary {{
  background: var(--primary-bg);
  color: var(--primary-text);
  border: none;
}}
.layout {{
  display: grid;
  grid-template-columns: 280px 1fr;
  height: calc(100vh - 65px);
}}
.sidebar {{
  background: var(--panel);
  border-right: 1px solid var(--line);
  overflow-y: auto;
  padding: 12px;
}}
.thumb {{
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
  border: 1px solid transparent;
  width: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  background: transparent;
}}
.thumb:hover {{ background: var(--bg); }}
.thumb:focus-visible {{ outline: 3px solid var(--accent); outline-offset: 2px; }}
.thumb.active {{
  border-color: var(--primary-bg);
  background: var(--bg);
}}
.thumb.flagged {{ border-left: 4px solid var(--accent); }}
.thumb-info {{ flex: 1; min-width: 0; }}
.thumb-title, .thumb-meta {{ display: block; }}
.thumb-title {{
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}}
.thumb-meta {{ font-size: 11px; color: var(--muted); }}
.stage {{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg);
  position: relative;
}}
.canvas-wrap {{
  position: relative;
  background: var(--canvas-bg);
  border: 1px solid var(--canvas-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}}
canvas {{ display: block; touch-action: none; }}
.corner-handles {{
  position: absolute;
  inset: 0;
  pointer-events: none;
}}
.corner-handle {{
  position: absolute;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 2px solid #1f272c;
  border-radius: 50%;
  background: var(--handle);
  color: #1f272c;
  font: 700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.35);
}}
.corner-handle:active {{ cursor: grabbing; }}
.corner-handle:focus-visible {{
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}}
.info-bar {{
  margin-top: 12px;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  gap: 16px;
}}
.toast {{
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--primary-bg);
  color: var(--toast-text);
  padding: 12px 18px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: none;
}}
.visually-hidden {{
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}}
</style>
</head>
<body>
<header>
  <div>
  <h1 data-i18n="title">{product_name} Manual Review</h1>
    <p data-i18n="subtitle">Drag the four yellow corner handles to fix any misaligned slide quad.</p>
  </div>
  <div class="controls">
    <button class="btn" id="prevBtn" data-i18n="prev">Previous</button>
    <button class="btn" id="nextBtn" data-i18n="next">Next</button>
    <button class="btn" id="resetBtn" data-i18n="reset">Reset</button>
    <button class="btn primary" id="exportBtn" data-i18n="export">Export JSON</button>
  </div>
</header>
<div class="layout">
  <div class="sidebar" id="sidebar"></div>
  <div class="stage">
    <div class="canvas-wrap" id="wrap">
      <canvas id="cv"></canvas>
      <div class="corner-handles" id="handles" aria-label="Slide corner controls"></div>
    </div>
    <div class="info-bar" id="info"></div>
    <p class="visually-hidden" id="cornerKeyboardHelp" data-i18n="cornerHelp">Focus a corner control and use the arrow keys to move it by one pixel. Hold Shift to move by ten pixels.</p>
  </div>
</div>
<div class="toast" id="toast"></div>
<div class="visually-hidden" id="status" aria-live="polite" aria-atomic="true"></div>

<script id="review-data" type="application/json">{payload}</script>
<script>
const items = JSON.parse(document.getElementById("review-data").textContent);
const defaultPrefs = {{ theme: "auto", locale: "auto" }};
let prefs = Object.assign({{}}, defaultPrefs);
try {{
  const stored = localStorage.getItem("slides_thief_review_prefs");
  if (stored) prefs = Object.assign({{}}, defaultPrefs, JSON.parse(stored));
}} catch (e) {{}}

const translations = {{
  en: {{
    title: "{product_name} Manual Review",
    subtitle: "Drag the four yellow corner handles to fix any misaligned slide quad.",
    prev: "Previous",
    next: "Next",
    reset: "Reset",
    export: "Export JSON",
    copied: "Copied manual quads JSON to clipboard and downloaded file!",
    needsReview: "Needs Review",
    ok: "OK",
    confidence: "Confidence",
    method: "Method",
    status: "Status",
    corner: "Corner",
    cornerHelp: "Focus a corner control and use the arrow keys to move it by one pixel. Hold Shift to move by ten pixels.",
    moved: "moved",
    slide: "Slide",
    of: "of"
  }},
  zh: {{
    title: "{product_name} 手动透视校正标注",
    subtitle: "拖动 4 个黄色角点控件，修正检测偏离的幻灯片边缘。",
    prev: "上一张",
    next: "下一张",
    reset: "重置本页",
    export: "导出 JSON 标定",
    copied: "标定结果已复制到剪贴板并自动下载文件！",
    needsReview: "待人工复核",
    ok: "自动通过",
    confidence: "置信度",
    method: "检测算法",
    status: "状态",
    corner: "角点",
    cornerHelp: "聚焦角点控件后使用方向键移动 1 像素；按住 Shift 可移动 10 像素。",
    moved: "已移动",
    slide: "第",
    of: "张，共"
  }}
}};

function getLocale() {{
  if (prefs.locale && prefs.locale !== "auto") return prefs.locale;
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("zh") ? "zh" : "en";
}}

function applyLocale() {{
  const lang = getLocale();
  const t = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach(el => {{
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  }});
}}

applyLocale();

let activeIdx = 0;
let points = [];
let img = new Image();
let scale = 1;
let dragIdx = -1;

function assetQuadForItem(item) {{
  if (item.assetQuad) return item.assetQuad;

  // Compatibility with review data generated before sourceQuad/assetQuad
  // were explicit. Legacy `quad` values are source-image coordinates.
  const sourceQuad = item.sourceQuad || item.quad;
  const sourceWidth = item.origWidth || item.assetWidth || img.width;
  const sourceHeight = item.origHeight || item.assetHeight || img.height;
  const assetWidth = item.assetWidth || img.width;
  const assetHeight = item.assetHeight || img.height;
  return sourceQuad.map(([x, y]) => [
    x * assetWidth / sourceWidth,
    y * assetHeight / sourceHeight
  ]);
}}

function sourceQuadForItem(item, assetQuad) {{
  const sourceWidth = item.origWidth || item.assetWidth || img.width;
  const sourceHeight = item.origHeight || item.assetHeight || img.height;
  const assetWidth = item.assetWidth || img.width;
  const assetHeight = item.assetHeight || img.height;
  return assetQuad.map(([x, y]) => [
    x * sourceWidth / assetWidth,
    y * sourceHeight / assetHeight
  ]);
}}

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const sidebar = document.getElementById("sidebar");
const info = document.getElementById("info");
const toast = document.getElementById("toast");
const handles = document.getElementById("handles");
const status = document.getElementById("status");
let handleElements = [];
let dragPointerId = null;

function renderSidebar() {{
  sidebar.textContent = "";
  items.forEach((item, idx) => {{
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb" + (idx === activeIdx ? " active" : "") + (item.needsReview ? " flagged" : "");
    button.setAttribute("aria-current", idx === activeIdx ? "true" : "false");
    button.setAttribute("aria-label", `${{item.filename}}, ${{idx + 1}}`);
    button.addEventListener("click", () => loadPage(idx));

    const thumbInfo = document.createElement("span");
    thumbInfo.className = "thumb-info";
    const title = document.createElement("span");
    title.className = "thumb-title";
    title.textContent = item.filename;
    const meta = document.createElement("span");
    meta.className = "thumb-meta";
    meta.textContent = `${{item.needsReview ? "⚠️ Flagged" : "✓ Auto"}} | conf: ${{item.confidence}}`;
    thumbInfo.append(title, meta);
    button.appendChild(thumbInfo);
    sidebar.appendChild(button);
  }});
}}

function announce(message) {{
  status.textContent = "";
  window.requestAnimationFrame(() => {{ status.textContent = message; }});
}}

function updateControls() {{
  document.getElementById("prevBtn").disabled = activeIdx <= 0;
  document.getElementById("nextBtn").disabled = activeIdx >= items.length - 1;
}}

function updateHandlePositions() {{
  handleElements.forEach((handle, idx) => {{
    const point = points[idx];
    handle.style.left = `${{point[0]}}px`;
    handle.style.top = `${{point[1]}}px`;
  }});
}}

function setCustomQuad() {{
  items[activeIdx].customQuad = points.map(pt => [pt[0] / scale, pt[1] / scale]);
}}

function announceCornerPosition(index) {{
  const lang = getLocale();
  const t = translations[lang] || translations.en;
  announce(`${{t.corner}} ${{index + 1}} ${{t.moved}}: (${{Math.round(points[index][0] / scale)}}, ${{Math.round(points[index][1] / scale)}})`);
}}

function createCornerHandles() {{
  handles.textContent = "";
  const lang = getLocale();
  const t = translations[lang] || translations.en;
  handleElements = points.map((_, idx) => {{
    const button = document.createElement("button");
    button.type = "button";
    button.className = "corner-handle";
    button.textContent = String(idx + 1);
    button.setAttribute("aria-label", `${{t.corner}} ${{idx + 1}}`);
    button.setAttribute("aria-describedby", "cornerKeyboardHelp");
    button.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight");
    button.addEventListener("pointerdown", event => beginDrag(idx, event));
    button.addEventListener("keydown", event => moveCornerWithKeyboard(idx, event));
    handles.appendChild(button);
    return button;
  }});
  updateHandlePositions();
}}

function loadPage(idx) {{
  activeIdx = idx;
  const item = items[idx];
  renderSidebar();
  updateControls();
  handles.textContent = "";
  handleElements = [];
  img = new Image();
  img.onload = () => {{
    const maxW = Math.min(window.innerWidth - 340, 1200);
    const maxH = window.innerHeight - 140;
    scale = Math.min(maxW / img.width, maxH / img.height, 1);
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);

    const assetQuad = item.customQuad || assetQuadForItem(item);
    points = assetQuad.map(pt => [pt[0] * scale, pt[1] * scale]);
    createCornerHandles();
    draw();
  }};
  img.src = item.image;

  const lang = getLocale();
  const t = translations[lang] || translations.en;
  info.textContent = "";
  const filename = document.createElement("span");
  const filenameStrong = document.createElement("strong");
  filenameStrong.textContent = item.filename;
  filename.appendChild(filenameStrong);
  const method = document.createElement("span");
  method.textContent = `${{t.method}}: ${{item.method}}`;
  const confidence = document.createElement("span");
  confidence.textContent = `${{t.confidence}}: ${{item.confidence}}`;
  const itemStatus = document.createElement("span");
  itemStatus.textContent = `${{t.status}}: ${{item.needsReview ? t.needsReview : t.ok}}`;
  info.append(filename, method, confidence, itemStatus);
  announce(`${{t.slide}} ${{idx + 1}} ${{t.of}} ${{items.length}}: ${{item.filename}}`);
}}

function draw() {{
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);

  ctx.strokeStyle = "#e24b3c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "rgba(226, 75, 60, 0.15)";
  ctx.fill();
}}

function canvasPointFromEvent(event) {{
  const rect = cv.getBoundingClientRect();
  const xScale = cv.width / rect.width || 1;
  const yScale = cv.height / rect.height || 1;
  return [
    (event.clientX - rect.left) * xScale,
    (event.clientY - rect.top) * yScale
  ];
}}

function setPointFromEvent(index, event) {{
  const [x, y] = canvasPointFromEvent(event);
  points[index] = [
    Math.max(0, Math.min(cv.width, x)),
    Math.max(0, Math.min(cv.height, y))
  ];
  setCustomQuad();
  updateHandlePositions();
  draw();
}}

function beginDrag(index, event) {{
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  dragIdx = index;
  dragPointerId = event.pointerId;
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  setPointFromEvent(index, event);
}}

function updateDrag(event) {{
  if (dragIdx < 0 || dragPointerId !== event.pointerId) return;
  setPointFromEvent(dragIdx, event);
}}

function endDrag(event) {{
  if (dragPointerId === null || dragPointerId !== event.pointerId) return;
  if (event.currentTarget.releasePointerCapture) event.currentTarget.releasePointerCapture(event.pointerId);
  announceCornerPosition(dragIdx);
  dragIdx = -1;
  dragPointerId = null;
}}

function moveCornerWithKeyboard(index, event) {{
  const deltas = {{
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  }};
  const delta = deltas[event.key];
  if (!delta) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  points[index] = [
    Math.max(0, Math.min(cv.width, points[index][0] + delta[0] * step)),
    Math.max(0, Math.min(cv.height, points[index][1] + delta[1] * step))
  ];
  setCustomQuad();
  updateHandlePositions();
  draw();
  announceCornerPosition(index);
}}

cv.addEventListener("pointerdown", event => {{
  const [x, y] = canvasPointFromEvent(event);
  const index = points.findIndex(pt => Math.hypot(pt[0] - x, pt[1] - y) < 24);
  if (index >= 0) beginDrag(index, event);
}});
cv.addEventListener("pointermove", updateDrag);

window.addEventListener("pointermove", updateDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);

document.getElementById("prevBtn").onclick = () => {{
  if (activeIdx > 0) loadPage(activeIdx - 1);
}};

document.getElementById("nextBtn").onclick = () => {{
  if (activeIdx < items.length - 1) loadPage(activeIdx + 1);
}};

document.getElementById("resetBtn").onclick = () => {{
  delete items[activeIdx].customQuad;
  loadPage(activeIdx);
}};

document.getElementById("exportBtn").onclick = () => {{
  const out = {{}};
  items.forEach(item => {{
    const assetQuad = item.customQuad || assetQuadForItem(item);
    const sourceQuad = sourceQuadForItem(item, assetQuad);
    out[item.filename] = sourceQuad.map(pt => [Math.round(pt[0]), Math.round(pt[1])]);
  }});
  const jsonStr = JSON.stringify(out, null, 2);
  navigator.clipboard.writeText(jsonStr);

  const blob = new Blob([jsonStr], {{ type: "application/json" }});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "manual_quads.json";
  a.click();

  const lang = getLocale();
  const t = translations[lang] || translations.en;
  toast.textContent = t.copied;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 3000);
}};

window.addEventListener("languagechange", () => {{
  if (prefs.locale === "auto") applyLocale();
}});
loadPage(0);
</script>
</body>
</html>
"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")


def make_pdf(images: list[Path], output: Path, page_w: int, page_h: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=(page_w, page_h))
    for image_path in images:
        c.drawImage(ImageReader(str(image_path)), 0, 0, width=page_w, height=page_h)
        c.showPage()
    c.save()
