"""Exporters for PDF slide decks, contact sheets, overlays, and manual review app."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


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
        im = Image.open(path).convert("RGB")
        im.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
        x = (idx % cols) * cell_w
        y = 36 + (idx // cols) * (cell_h + label_h)
        sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2))
        draw.text((x + 8, y + cell_h + 6), path.stem, fill=(0, 0, 0))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def make_manual_review_html(items: list[dict], output: Path) -> None:
    payload = json.dumps(items, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slide Lens Manual Review</title>
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
}}
.thumb:hover {{ background: var(--bg); }}
.thumb.active {{
  border-color: var(--primary-bg);
  background: var(--bg);
}}
.thumb.flagged {{ border-left: 4px solid var(--accent); }}
.thumb-info {{ flex: 1; min-width: 0; }}
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
canvas {{ display: block; }}
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
</style>
</head>
<body>
<header>
  <div>
    <h1 data-i18n="title">Slide Lens Manual Review</h1>
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
    </div>
    <div class="info-bar" id="info"></div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const items = {payload};
const defaultPrefs = {{ theme: "auto", locale: "auto" }};
let prefs = Object.assign({{}}, defaultPrefs);
try {{
  const stored = localStorage.getItem("slides_thief_review_prefs");
  if (stored) prefs = Object.assign({{}}, defaultPrefs, JSON.parse(stored));
}} catch (e) {{}}

const translations = {{
  en: {{
    title: "Slide Lens Manual Review",
    subtitle: "Drag the four yellow corner handles to fix any misaligned slide quad.",
    prev: "Previous",
    next: "Next",
    reset: "Reset",
    export: "Export JSON",
    copied: "Copied manual quads JSON to clipboard and downloaded file!",
    needsReview: "Needs Review",
    ok: "OK",
    confidence: "Confidence",
    method: "Method"
  }},
  zh: {{
    title: "Slide Lens 手动透视校正标注",
    subtitle: "拖动 4 个黄色角点控件，修正检测偏离的幻灯片边缘。",
    prev: "上一张",
    next: "下一张",
    reset: "重置本页",
    export: "导出 JSON 标定",
    copied: "标定结果已复制到剪贴板并自动下载文件！",
    needsReview: "待人工复核",
    ok: "自动通过",
    confidence: "置信度",
    method: "检测算法"
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

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const sidebar = document.getElementById("sidebar");
const info = document.getElementById("info");
const toast = document.getElementById("toast");

function renderSidebar() {{
  sidebar.innerHTML = "";
  items.forEach((item, idx) => {{
    const div = document.createElement("div");
    div.className = "thumb" + (idx === activeIdx ? " active" : "") + (item.needsReview ? " flagged" : "");
    div.onclick = () => loadPage(idx);
    div.innerHTML = `
      <div class="thumb-info">
        <div class="thumb-title">${{item.filename}}</div>
        <div class="thumb-meta">${{item.needsReview ? '⚠️ Flagged' : '✓ Auto'}} | conf: ${{item.confidence}}</div>
      </div>
    `;
    sidebar.appendChild(div);
  }});
}}

function loadPage(idx) {{
  activeIdx = idx;
  const item = items[idx];
  renderSidebar();
  img = new Image();
  img.onload = () => {{
    const maxW = Math.min(window.innerWidth - 340, 1200);
    const maxH = window.innerHeight - 140;
    scale = Math.min(maxW / img.width, maxH / img.height, 1);
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);

    if (item.customQuad) {{
      points = item.customQuad.map(pt => [pt[0] * scale, pt[1] * scale]);
    }} else {{
      points = item.quad.map(pt => [pt[0] * scale, pt[1] * scale]);
    }}
    draw();
  }};
  img.src = item.image;

  const lang = getLocale();
  const t = translations[lang] || translations.en;
  info.innerHTML = `
    <span><strong>${{item.filename}}</strong></span>
    <span>${{t.method}}: ${{item.method}}</span>
    <span>${{t.confidence}}: ${{item.confidence}}</span>
    <span>Status: ${{item.needsReview ? t.needsReview : t.ok}}</span>
  `;
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

  points.forEach((pt, i) => {{
    ctx.fillStyle = "#ffd84a";
    ctx.strokeStyle = "#1f272c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText((i + 1).toString(), pt[0] + 12, pt[1] + 4);
  }});
}}

cv.addEventListener("mousedown", e => {{
  const rect = cv.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  dragIdx = points.findIndex(pt => Math.hypot(pt[0] - x, pt[1] - y) < 16);
}});

cv.addEventListener("mousemove", e => {{
  if (dragIdx < 0) return;
  const rect = cv.getBoundingClientRect();
  points[dragIdx] = [
    Math.max(0, Math.min(cv.width, e.clientX - rect.left)),
    Math.max(0, Math.min(cv.height, e.clientY - rect.top))
  ];
  items[activeIdx].customQuad = points.map(pt => [pt[0] / scale, pt[1] / scale]);
  draw();
}});

window.addEventListener("mouseup", () => dragIdx = -1);

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
    const q = item.customQuad || item.quad;
    out[item.filename] = q.map(pt => [Math.round(pt[0]), Math.round(pt[1])]);
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
