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
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlparse

from PIL import Image, ImageOps

from .cli import SUPPORTED, parse_ratio, process, readable_image


DEFAULT_JOBS_DIR = Path("outputs/web_jobs")


APP_HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slides Thief</title>
<style>
:root {
  color-scheme: light;
  --bg: #f6f8fa;
  --panel: #ffffff;
  --panel-strong: #edf3f5;
  --text: #172026;
  --muted: #64717a;
  --line: #d8e1e7;
  --accent: #c84535;
  --accent-2: #0f766e;
  --warn: #b7791f;
  --handle: #ffd84a;
  --shadow: 0 10px 28px rgba(21, 32, 38, .08);
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}
button, input, select {
  font: inherit;
  color: inherit;
}
button {
  height: 34px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 6px;
  padding: 0 11px;
  cursor: pointer;
}
button:hover { border-color: #aebbc4; }
button:disabled { cursor: not-allowed; opacity: .55; }
button.primary {
  background: var(--text);
  border-color: var(--text);
  color: #fff;
}
button.green {
  background: var(--accent-2);
  border-color: var(--accent-2);
  color: #fff;
}
button.icon {
  width: 36px;
  padding: 0;
  font-size: 18px;
}
select, input[type="number"], input[type="text"] {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  padding: 0 9px;
  min-width: 0;
}
label {
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
label > span { white-space: nowrap; }
a { color: var(--accent-2); text-decoration: none; }
a:hover { text-decoration: underline; }
.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}
.topbar {
  min-height: 58px;
  display: grid;
  grid-template-columns: minmax(150px, 230px) 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .92);
  position: sticky;
  top: 0;
  z-index: 20;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--text);
  color: #fff;
  font-weight: 750;
}
.brandText {
  font-weight: 760;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.settings {
  display: grid;
  grid-template-columns: 100px 96px 96px 92px 116px 1fr;
  gap: 8px;
  align-items: end;
}
.checks {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  color: var(--text);
  font-size: 13px;
}
.checks input { width: 16px; height: 16px; }
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}
.shell {
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 280px;
}
.sidebar, .inspector {
  min-height: 0;
  background: var(--panel);
  border-right: 1px solid var(--line);
  display: grid;
  grid-template-rows: auto 1fr;
}
.inspector {
  border-right: 0;
  border-left: 1px solid var(--line);
}
.sectionHead {
  min-height: 50px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line);
}
.sectionHead h2 {
  margin: 0;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 760;
}
.sectionHead .count {
  color: var(--muted);
  margin-left: auto;
  white-space: nowrap;
}
.fileInput {
  width: 1px;
  height: 1px;
  opacity: 0;
  position: absolute;
  pointer-events: none;
}
.dropzone {
  margin: 12px;
  min-height: 112px;
  border: 1px dashed #aebbc4;
  border-radius: 8px;
  display: grid;
  place-items: center;
  text-align: center;
  background: #fbfcfd;
  color: var(--muted);
  padding: 12px;
}
.dropzone.active {
  border-color: var(--accent-2);
  background: #edf8f6;
  color: var(--accent-2);
}
.dropzone strong {
  color: var(--text);
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}
.files, .slides {
  overflow: auto;
  padding: 0 8px 12px;
}
.fileRow, .slideRow {
  width: 100%;
  min-height: 44px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  padding: 6px 8px;
  text-align: left;
}
.fileRow { cursor: pointer; }
.fileRow:hover, .fileRow.active, .slideRow:hover, .slideRow.active {
  border-color: var(--line);
  background: var(--panel-strong);
}
.idx {
  width: 26px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #eef2f5;
  color: var(--muted);
  font-size: 12px;
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  color: var(--muted);
  font-size: 12px;
}
.badge {
  min-width: 42px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #eef2f5;
  color: var(--muted);
  font-size: 12px;
}
.badge.low {
  color: #8a4c06;
  background: #fff3d6;
}
.workspace {
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr;
}
.reviewBar {
  min-height: 50px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.reviewBar .title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}
.stage {
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  overflow: auto;
  background:
    linear-gradient(45deg, rgba(23, 32, 38, .04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(23, 32, 38, .04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(23, 32, 38, .04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(23, 32, 38, .04) 75%);
  background-size: 28px 28px;
  background-position: 0 0, 0 14px, 14px -14px, -14px 0;
}
.canvasShell {
  min-width: 100%;
  width: max-content;
  display: grid;
  place-items: center;
}
canvas {
  display: block;
  background: transparent;
  border: 0;
  cursor: crosshair;
}
canvas[hidden] {
  display: none;
}
.zoomControls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.zoomValue {
  min-width: 48px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}
.empty {
  width: min(560px, 90%);
  min-height: 220px;
  display: grid;
  place-items: center;
  color: var(--muted);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, .74);
  padding: 22px;
}
.inspectorBody {
  overflow: auto;
  padding: 12px;
  display: grid;
  align-content: start;
  gap: 14px;
}
.metric {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.metric .key { color: var(--muted); }
.metric .value {
  min-width: 0;
  overflow-wrap: anywhere;
}
.links {
  display: grid;
  gap: 8px;
}
.links a {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  padding: 7px 9px;
}
.cornerTable {
  display: grid;
  gap: 6px;
}
.cornerRow {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 30px;
}
.dot {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--handle);
  border: 1px solid #2a3034;
  font-size: 12px;
  font-weight: 760;
}
.statusLine {
  color: var(--muted);
  min-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  min-height: 36px;
  display: grid;
  place-items: center;
  background: var(--text);
  color: #fff;
  border-radius: 7px;
  padding: 8px 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .16s ease;
  z-index: 50;
}
.toast.show { opacity: 1; }
@media (max-width: 1100px) {
  .topbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .settings {
    grid-template-columns: repeat(3, minmax(90px, 1fr));
  }
  .actions { justify-content: flex-start; flex-wrap: wrap; }
  .shell {
    grid-template-columns: 250px minmax(0, 1fr);
  }
  .inspector {
    grid-column: 1 / -1;
    min-height: 230px;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
@media (max-width: 760px) {
  .shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    min-height: 240px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .settings {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
  .reviewBar { flex-wrap: wrap; }
  .stage { padding: 8px; }
}
</style>
</head>
<body>
<div class="app">
  <header class="topbar">
    <div class="brand">
      <div class="mark">ST</div>
      <div class="brandText">Slides Thief</div>
    </div>
    <div class="settings">
      <label><span>比例</span><select id="ratio"><option value="16:9">16:9</option><option value="4:3">4:3</option></select></label>
      <label><span>宽度</span><input id="width" type="number" min="800" max="6000" value="2400"></label>
      <label><span>高度</span><input id="height" type="number" min="600" max="6000" placeholder="自动"></label>
      <label><span>质量</span><input id="quality" type="number" min="60" max="98" value="92"></label>
      <label><span>PDF 文件</span><input id="pdfName" type="text" value="flattened_slides.pdf"></label>
      <label class="checks"><input id="grayscale" type="checkbox"><span>灰度</span></label>
    </div>
    <div class="actions">
      <button id="choose">选择图片</button>
      <button id="runAuto" class="primary" disabled>自动识别</button>
      <button id="runRefine" class="green" disabled>生成 PDF</button>
      <span id="status" class="statusLine">待上传</span>
    </div>
  </header>

  <main class="shell">
    <aside class="sidebar">
      <div class="sectionHead">
        <h2>图片</h2>
        <span id="fileCount" class="count">0</span>
      </div>
      <div>
        <input id="fileInput" class="fileInput" type="file" accept="image/*,.heic,.heif,.tif,.tiff" multiple>
        <div id="dropzone" class="dropzone">
          <div><strong>拖拽图片</strong><span>文件名排序</span></div>
        </div>
        <div id="files" class="files"></div>
      </div>
    </aside>

    <section class="workspace">
      <div class="reviewBar">
        <button id="prev" class="icon" disabled title="上一页">‹</button>
        <button id="next" class="icon" disabled title="下一页">›</button>
        <div id="slideTitle" class="title">未选择页面</div>
        <div class="zoomControls">
          <button id="zoomOut" class="icon" disabled title="缩小">−</button>
          <span id="zoomValue" class="zoomValue">100%</span>
          <button id="zoomIn" class="icon" disabled title="放大">+</button>
          <button id="zoomFit" disabled title="适合窗口">适合</button>
        </div>
        <button id="resetSlide" disabled>重置本页</button>
        <button id="downloadJson" disabled>导出角点</button>
      </div>
      <div id="stage" class="stage">
        <div class="canvasShell">
          <canvas id="canvas" hidden></canvas>
          <div id="empty" class="empty">上传图片后点击自动识别按钮</div>
        </div>
      </div>
    </section>

    <aside class="inspector">
      <div class="sectionHead">
        <h2>输出</h2>
        <span id="slideCount" class="count">0</span>
      </div>
      <div class="inspectorBody">
        <div id="metrics"></div>
        <div id="cornerTable" class="cornerTable"></div>
        <div id="links" class="links"></div>
      </div>
    </aside>
  </main>
</div>
<div id="toast" class="toast"></div>

<script>
const $ = id => document.getElementById(id);
const els = {
  ratio: $("ratio"),
  width: $("width"),
  height: $("height"),
  quality: $("quality"),
  pdfName: $("pdfName"),
  grayscale: $("grayscale"),
  choose: $("choose"),
  fileInput: $("fileInput"),
  dropzone: $("dropzone"),
  files: $("files"),
  fileCount: $("fileCount"),
  runAuto: $("runAuto"),
  runRefine: $("runRefine"),
  status: $("status"),
  prev: $("prev"),
  next: $("next"),
  zoomOut: $("zoomOut"),
  zoomIn: $("zoomIn"),
  zoomFit: $("zoomFit"),
  zoomValue: $("zoomValue"),
  resetSlide: $("resetSlide"),
  downloadJson: $("downloadJson"),
  slideTitle: $("slideTitle"),
  slideCount: $("slideCount"),
  metrics: $("metrics"),
  cornerTable: $("cornerTable"),
  links: $("links"),
  stage: $("stage"),
  canvas: $("canvas"),
  empty: $("empty"),
  toast: $("toast")
};
const ctx = els.canvas.getContext("2d");
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const emptyMessage = "上传图片后点击自动识别按钮";
const app = {
  files: [],
  previews: new Map(),
  preview: null,
  previewIndex: -1,
  jobId: null,
  activeRun: null,
  finalRun: null,
  quads: {},
  index: 0,
  image: new Image(),
  viewport: null,
  zoom: 1,
  zoomMode: "fit",
  dragging: -1
};

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function settingsPayload() {
  return {
    ratio: els.ratio.value,
    width: Number(els.width.value || 2400),
    height: els.height.value ? Number(els.height.value) : null,
    jpegQuality: Number(els.quality.value || 92),
    grayscale: els.grayscale.checked,
    pdfName: els.pdfName.value || "flattened_slides.pdf"
  };
}

function setStatus(text) {
  els.status.textContent = text;
}

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 1300);
}

function setBusy(busy) {
  els.runAuto.disabled = busy || app.files.length === 0;
  els.runRefine.disabled = busy || !app.activeRun;
  els.choose.disabled = busy;
}

function handleFiles(fileList) {
  const supported = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif"];
  app.files = Array.from(fileList)
    .filter(file => supported.some(ext => file.name.toLowerCase().endsWith(ext)))
    .sort((a, b) => collator.compare(a.name, b.name));
  app.previews = new Map();
  app.preview = null;
  app.previewIndex = -1;
  app.activeRun = null;
  app.finalRun = null;
  app.jobId = null;
  app.quads = {};
  app.index = 0;
  app.viewport = null;
  renderFiles();
  renderLinks();
  els.metrics.replaceChildren();
  els.cornerTable.replaceChildren();
  els.slideCount.textContent = "0";
  els.slideTitle.textContent = "未选择页面";
  els.prev.disabled = true;
  els.next.disabled = true;
  els.resetSlide.disabled = true;
  els.downloadJson.disabled = true;
  els.canvas.hidden = true;
  els.empty.hidden = false;
  els.empty.textContent = emptyMessage;
  updateZoomControls();
  setBusy(false);
  if (app.files.length) setStatus(`${app.files.length} 张`);
}

function renderFiles() {
  els.fileCount.textContent = String(app.files.length);
  els.files.replaceChildren();
  app.files.forEach((file, i) => {
    const row = document.createElement("button");
    row.className = "fileRow" + (i === app.previewIndex ? " active" : "");
    row.onclick = () => loadPreview(i);
    const idx = document.createElement("div");
    idx.className = "idx";
    idx.textContent = String(i + 1).padStart(2, "0");
    const main = document.createElement("div");
    main.className = "name";
    main.textContent = file.name;
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = formatBytes(file.size);
    row.append(idx, main, sub);
    els.files.appendChild(row);
  });
}

function previewKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function previewForFile(file) {
  const key = previewKey(file);
  if (app.previews.has(key)) return app.previews.get(key);
  const form = new FormData();
  form.append("file", file, file.name);
  const data = await fetchJson("/api/previews", { method: "POST", body: form });
  app.previews.set(key, data);
  return data;
}

async function loadPreview(index) {
  if (app.activeRun || !app.files.length) return;
  app.previewIndex = Math.max(0, Math.min(app.files.length - 1, index));
  const file = app.files[app.previewIndex];
  renderFiles();
  els.slideTitle.textContent = `${String(app.previewIndex + 1).padStart(2, "0")}  ${file.name}`;
  els.prev.disabled = app.previewIndex === 0;
  els.next.disabled = app.previewIndex >= app.files.length - 1;
  els.resetSlide.disabled = true;
  els.downloadJson.disabled = true;
  els.canvas.hidden = true;
  els.empty.hidden = false;
  els.empty.textContent = "正在生成预览";
  setStatus("预览中");

  try {
    const data = await previewForFile(file);
    if (app.activeRun || app.files[app.previewIndex] !== file) return;
    app.preview = data;
    app.image = new Image();
    app.image.onload = () => {
      els.canvas.hidden = false;
      els.empty.hidden = true;
      configureCanvas(data);
      if (app.zoomMode === "fit") {
        fitCanvas();
      } else {
        applyCanvasZoom();
        draw();
        scheduleFocusImage();
      }
    };
    app.image.onerror = () => {
      els.canvas.hidden = true;
      els.empty.hidden = false;
      els.empty.textContent = "无法预览这张图片";
      updateZoomControls();
      toast("无法预览这张图片");
    };
    app.image.src = data.imageUrl;
    renderPreviewInfo(data);
    setStatus(`${app.files.length} 张`);
  } catch (err) {
    els.empty.textContent = "无法生成预览";
    setStatus(`${app.files.length} 张`);
    toast(err.message);
  }
}

function renderPreviewInfo(preview) {
  const rows = [
    ["文件", preview.filename],
    ["状态", "待自动识别"],
    ["尺寸", `${preview.origWidth} × ${preview.origHeight}`]
  ];
  const wrap = document.createElement("div");
  rows.forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "metric";
    const k = document.createElement("div");
    k.className = "key";
    k.textContent = key;
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    row.append(k, v);
    wrap.appendChild(row);
  });
  els.metrics.replaceChildren(wrap);
  els.cornerTable.replaceChildren();
  els.links.replaceChildren();
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}

async function runAuto() {
  if (!app.files.length) return;
  setBusy(true);
  setStatus("识别中");
  const settings = settingsPayload();
  const form = new FormData();
  for (const file of app.files) form.append("files", file, file.name);
  form.append("ratio", settings.ratio);
  form.append("width", String(settings.width));
  if (settings.height) form.append("height", String(settings.height));
  form.append("jpeg_quality", String(settings.jpegQuality));
  form.append("grayscale", settings.grayscale ? "1" : "0");
  form.append("pdf_name", settings.pdfName);
  try {
    const data = await fetchJson("/api/jobs", { method: "POST", body: form });
    setRun(data);
    setStatus("可审核");
    toast("自动识别完成");
  } catch (err) {
    setStatus("失败");
    toast(err.message);
  } finally {
    setBusy(false);
  }
}

async function runRefine() {
  if (!app.activeRun || !app.jobId) return;
  setBusy(true);
  setStatus("生成中");
  try {
    const data = await fetchJson(`/api/jobs/${encodeURIComponent(app.jobId)}/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: settingsPayload(),
        manualQuads: app.quads
      })
    });
    app.finalRun = data;
    setRun(data, { keepIndex: true });
    setStatus("已生成");
    toast("PDF 已更新");
  } catch (err) {
    setStatus("失败");
    toast(err.message);
  } finally {
    setBusy(false);
  }
}

function setRun(data, options = {}) {
  app.jobId = data.jobId;
  app.activeRun = data;
  app.preview = null;
  app.previewIndex = -1;
  app.quads = Object.fromEntries(data.slides.map(slide => [
    slide.filename,
    slide.quad.map(point => [...point])
  ]));
  app.index = options.keepIndex ? Math.min(app.index, data.slides.length - 1) : 0;
  renderSlideList();
  renderLinks();
  loadSlide(app.index);
  els.runRefine.disabled = false;
  els.downloadJson.disabled = false;
  els.resetSlide.disabled = false;
}

function renderSlideList() {
  els.files.replaceChildren();
  const slides = app.activeRun ? app.activeRun.slides : [];
  els.fileCount.textContent = String(slides.length);
  els.slideCount.textContent = String(slides.length);
  slides.forEach((slide, i) => {
    const row = document.createElement("button");
    row.className = "slideRow" + (i === app.index ? " active" : "");
    row.onclick = () => loadSlide(i);
    const idx = document.createElement("div");
    idx.className = "idx";
    idx.textContent = String(i + 1).padStart(2, "0");
    const main = document.createElement("div");
    main.className = "name";
    main.textContent = slide.filename;
    const badge = document.createElement("div");
    badge.className = "badge" + (slide.confidence < 0.65 ? " low" : "");
    badge.textContent = Number(slide.confidence).toFixed(2);
    row.append(idx, main, badge);
    els.files.appendChild(row);
  });
}

function currentSlide() {
  return app.activeRun && app.activeRun.slides[app.index];
}

function currentImageItem() {
  return currentSlide() || app.preview;
}

function loadSlide(index) {
  if (!app.activeRun || !app.activeRun.slides.length) return;
  app.index = Math.max(0, Math.min(app.activeRun.slides.length - 1, index));
  const slide = currentSlide();
  renderSlideList();
  els.slideTitle.textContent = `${String(app.index + 1).padStart(2, "0")}  ${slide.filename}`;
  els.prev.disabled = app.index === 0;
  els.next.disabled = app.index >= app.activeRun.slides.length - 1;
  app.image = new Image();
  app.image.onload = () => {
    els.canvas.hidden = false;
    els.empty.hidden = true;
    configureCanvas(slide);
    if (app.zoomMode === "fit") {
      fitCanvas();
    } else {
      applyCanvasZoom();
      draw();
      scheduleFocusImage();
    }
  };
  app.image.src = slide.imageUrl;
  renderMetrics();
  renderCorners();
}

function configureCanvas(slide) {
  const padX = Math.max(140, Math.round(slide.assetWidth * 0.25));
  const padY = Math.max(140, Math.round(slide.assetHeight * 0.25));
  app.viewport = {
    padX,
    padY,
    imageWidth: slide.assetWidth,
    imageHeight: slide.assetHeight,
    totalWidth: slide.assetWidth + padX * 2,
    totalHeight: slide.assetHeight + padY * 2
  };
}

function updateZoomControls() {
  const enabled = Boolean(currentImageItem()) && !els.canvas.hidden;
  els.zoomOut.disabled = !enabled;
  els.zoomIn.disabled = !enabled;
  els.zoomFit.disabled = !enabled;
  els.zoomValue.textContent = enabled ? `${Math.round(app.zoom * 100)}%` : "100%";
}

function applyCanvasZoom() {
  const view = app.viewport;
  if (!view) return;
  const width = Math.max(1, Math.round(view.totalWidth * app.zoom));
  const height = Math.max(1, Math.round(view.totalHeight * app.zoom));
  els.canvas.width = width;
  els.canvas.height = height;
  els.canvas.style.width = `${width}px`;
  els.canvas.style.height = `${height}px`;
  updateZoomControls();
}

function setCanvasZoom(zoom) {
  app.zoomMode = "manual";
  app.zoom = Math.max(0.12, Math.min(3, zoom));
  applyCanvasZoom();
  draw();
  scheduleFocusImage();
}

function fitCanvas() {
  const view = app.viewport;
  if (!currentImageItem() || !view) return;
  app.zoomMode = "fit";
  const availableW = Math.max(220, els.stage.clientWidth - 36);
  const availableH = Math.max(180, els.stage.clientHeight - 36);
  app.zoom = Math.max(0.12, Math.min(1, availableW / view.imageWidth, availableH / view.imageHeight));
  applyCanvasZoom();
  draw();
  scheduleFocusImage();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function focusImage() {
  const view = app.viewport;
  if (!view || els.canvas.hidden) return;
  const imageX = view.padX * app.zoom;
  const imageY = view.padY * app.zoom;
  const imageW = view.imageWidth * app.zoom;
  const imageH = view.imageHeight * app.zoom;
  const marginX = imageW < els.stage.clientWidth ? (els.stage.clientWidth - imageW) / 2 : 18;
  const marginY = imageH < els.stage.clientHeight ? (els.stage.clientHeight - imageH) / 2 : 18;
  const maxLeft = Math.max(0, els.stage.scrollWidth - els.stage.clientWidth);
  const maxTop = Math.max(0, els.stage.scrollHeight - els.stage.clientHeight);
  els.stage.scrollLeft = clamp(imageX - marginX, 0, maxLeft);
  els.stage.scrollTop = clamp(imageY - marginY, 0, maxTop);
}

function scheduleFocusImage() {
  requestAnimationFrame(focusImage);
}

function toCanvasPoint(slide, point) {
  const view = app.viewport;
  return [
    (view.padX + point[0] / slide.origWidth * view.imageWidth) * app.zoom,
    (view.padY + point[1] / slide.origHeight * view.imageHeight) * app.zoom
  ];
}

function toOriginalPoint(slide, x, y) {
  const view = app.viewport;
  return [
    Math.round((x / app.zoom - view.padX) / view.imageWidth * slide.origWidth * 100) / 100,
    Math.round((y / app.zoom - view.padY) / view.imageHeight * slide.origHeight * 100) / 100
  ];
}

function draw() {
  const slide = currentSlide();
  const item = currentImageItem();
  const view = app.viewport;
  if (!item || !view || !app.image.complete) return;
  const imageX = view.padX * app.zoom;
  const imageY = view.padY * app.zoom;
  const imageW = view.imageWidth * app.zoom;
  const imageH = view.imageHeight * app.zoom;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(app.image, imageX, imageY, imageW, imageH);
  ctx.strokeStyle = "rgba(255, 255, 255, .36)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(imageX, imageY, imageW, imageH);
  if (!slide) return;
  const pts = app.quads[slide.filename].map(point => toCanvasPoint(slide, point));
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(200, 69, 53, .98)";
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.stroke();
  pts.forEach(([x, y], i) => {
    const r = 9;
    ctx.fillStyle = "rgba(255, 216, 74, .98)";
    ctx.strokeStyle = "rgba(23, 32, 38, .9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#172026";
    ctx.font = "700 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y + 1);
  });
}

function eventPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return [
    (event.clientX - rect.left) / rect.width * els.canvas.width,
    (event.clientY - rect.top) / rect.height * els.canvas.height
  ];
}

function nearestHandle(x, y) {
  const slide = currentSlide();
  const pts = app.quads[slide.filename].map(point => toCanvasPoint(slide, point));
  const threshold = 28;
  let best = -1;
  let bestDist = Infinity;
  pts.forEach(([px, py], i) => {
    const dist = Math.hypot(px - x, py - y);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return bestDist <= threshold ? best : -1;
}

function renderMetrics() {
  const slide = currentSlide();
  if (!slide) {
    els.metrics.replaceChildren();
    return;
  }
  const rows = [
    ["文件", slide.filename],
    ["方法", slide.method],
    ["置信度", Number(slide.confidence).toFixed(3)],
    ["尺寸", `${slide.origWidth} × ${slide.origHeight}`]
  ];
  const wrap = document.createElement("div");
  rows.forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "metric";
    const k = document.createElement("div");
    k.className = "key";
    k.textContent = key;
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    row.append(k, v);
    wrap.appendChild(row);
  });
  els.metrics.replaceChildren(wrap);
}

function renderCorners() {
  const slide = currentSlide();
  els.cornerTable.replaceChildren();
  if (!slide) return;
  app.quads[slide.filename].forEach((point, i) => {
    const row = document.createElement("div");
    row.className = "cornerRow";
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.textContent = String(i + 1);
    const value = document.createElement("div");
    value.className = "sub";
    value.textContent = `${point[0].toFixed(2)}, ${point[1].toFixed(2)}`;
    row.append(dot, value);
    els.cornerTable.appendChild(row);
  });
}

function renderLinks() {
  els.links.replaceChildren();
  const run = app.finalRun || app.activeRun;
  if (!run) return;
  const items = [
    ["PDF", run.pdfUrl],
    ["拉正总览", run.correctedContactSheetUrl],
    ["识别总览", run.detectionContactSheetUrl],
    ["报告", run.reportUrl]
  ];
  for (const [label, url] of items) {
    if (!url) continue;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("span");
    right.textContent = "打开";
    right.className = "sub";
    link.append(left, right);
    els.links.appendChild(link);
  }
}

function resetCurrent() {
  const slide = currentSlide();
  if (!slide) return;
  app.quads[slide.filename] = slide.quad.map(point => [...point]);
  draw();
  renderCorners();
}

function downloadManualJson() {
  if (!app.activeRun) return;
  const blob = new Blob([JSON.stringify(app.quads, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manual_quads.json";
  a.click();
  URL.revokeObjectURL(url);
}

els.choose.onclick = () => els.fileInput.click();
els.fileInput.onchange = event => handleFiles(event.target.files);
els.runAuto.onclick = runAuto;
els.runRefine.onclick = runRefine;
els.prev.onclick = () => app.activeRun ? loadSlide(app.index - 1) : loadPreview(app.previewIndex - 1);
els.next.onclick = () => app.activeRun ? loadSlide(app.index + 1) : loadPreview(app.previewIndex + 1);
els.zoomOut.onclick = () => setCanvasZoom(app.zoom / 1.25);
els.zoomIn.onclick = () => setCanvasZoom(app.zoom * 1.25);
els.zoomFit.onclick = fitCanvas;
els.resetSlide.onclick = resetCurrent;
els.downloadJson.onclick = downloadManualJson;

for (const name of ["dragenter", "dragover"]) {
  els.dropzone.addEventListener(name, event => {
    event.preventDefault();
    els.dropzone.classList.add("active");
  });
}
for (const name of ["dragleave", "drop"]) {
  els.dropzone.addEventListener(name, event => {
    event.preventDefault();
    els.dropzone.classList.remove("active");
  });
}
els.dropzone.addEventListener("drop", event => handleFiles(event.dataTransfer.files));
els.dropzone.addEventListener("click", () => els.fileInput.click());

els.canvas.addEventListener("pointerdown", event => {
  if (!currentSlide()) return;
  const [x, y] = eventPoint(event);
  app.dragging = nearestHandle(x, y);
  if (app.dragging >= 0) els.canvas.setPointerCapture(event.pointerId);
});
els.canvas.addEventListener("pointermove", event => {
  const slide = currentSlide();
  if (!slide || app.dragging < 0) return;
  const [x, y] = eventPoint(event);
  app.quads[slide.filename][app.dragging] = toOriginalPoint(slide, x, y);
  draw();
  renderCorners();
});
els.canvas.addEventListener("pointerup", event => {
  app.dragging = -1;
  try { els.canvas.releasePointerCapture(event.pointerId); } catch (_) {}
});
window.addEventListener("keydown", event => {
  if (app.activeRun) {
    if (event.key === "ArrowLeft") loadSlide(app.index - 1);
    if (event.key === "ArrowRight") loadSlide(app.index + 1);
    return;
  }
  if (app.preview) {
    if (event.key === "ArrowLeft") loadPreview(app.previewIndex - 1);
    if (event.key === "ArrowRight") loadPreview(app.previewIndex + 1);
  }
});
window.addEventListener("resize", () => {
  if (app.zoomMode === "fit" && currentImageItem()) fitCanvas();
});
</script>
</body>
</html>
"""


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
            self.send_text(APP_HTML)
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
