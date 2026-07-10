/// <reference lib="webworker" />

import { PDFDocument } from "pdf-lib";

type RatioValue = "16:9" | "4:3";
type Quad = [[number, number], [number, number], [number, number], [number, number]];

type Settings = {
  ratio: RatioValue;
  width: number;
  height: number | null;
  quality: number;
  grayscale: boolean;
  fillColor: string;
};

type JobFile = {
  id: string;
  name: string;
  file: File;
};

type ExportSlide = {
  id: string;
  name: string;
  quad: Quad;
};

type Line = {
  a: number;
  b: number;
  c: number;
};

type DetectDiagnostics = {
  method: string;
  confidence: number;
};

const scope = self as DedicatedWorkerGlobalScope;

scope.onmessage = async (event) => {
  const data = event.data;
  try {
    if (data.type === "detect") {
      await detectFiles(data.files as JobFile[], data.settings as Settings);
      return;
    }
    if (data.type === "export") {
      await exportPdf(
        data.files as JobFile[],
        data.slides as ExportSlide[],
        data.settings as Settings,
        data.filename || "flattened-slides.pdf",
      );
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "The browser processing worker stopped unexpectedly.",
    });
  }
};

async function detectFiles(files: JobFile[], settings: Settings) {
  for (const item of files) {
    try {
      scope.postMessage({ type: "detect-start", id: item.id });
      const bitmap = await createImageBitmap(item.file);
      const imageData = imageDataFromBitmap(bitmap, 900);
      const [quad, diagnostics] = detectQuad(imageData, parseRatio(settings.ratio));
      const scale = bitmap.width / imageData.width;
      const fullQuad = quad.map(([x, y]) => [x * scale, y * scale]) as Quad;
      scope.postMessage({
        type: "detect-result",
        result: {
          id: item.id,
          width: bitmap.width,
          height: bitmap.height,
          quad: fullQuad,
          method: diagnostics.method,
          confidence: diagnostics.confidence,
        },
      });
      bitmap.close();
    } catch (error) {
      scope.postMessage({
        type: "slide-error",
        id: item.id,
        error: error instanceof Error ? error.message : "Could not decode this image in the browser.",
      });
    }
  }
}

async function exportPdf(files: JobFile[], slides: ExportSlide[], settings: Settings, filename: string) {
  const fileById = new Map(files.map((item) => [item.id, item]));
  const pdf = await PDFDocument.create();
  const ratio = parseRatio(settings.ratio);
  const outputWidth = settings.width;
  const outputHeight = settings.height ? settings.height : Math.round(outputWidth / ratio);

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const item = fileById.get(slide.id);
    if (!item) continue;
    scope.postMessage({ type: "export-progress", current: index + 1, total: slides.length, name: item.name });
    const jpgBytes = await renderWarpedJpeg(item.file, slide.quad, outputWidth, outputHeight, settings);
    const image = await pdf.embedJpg(jpgBytes);
    const page = pdf.addPage([outputWidth, outputHeight]);
    page.drawImage(image, { x: 0, y: 0, width: outputWidth, height: outputHeight });
  }

  const pdfBytes = await pdf.save();
  const transfer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  scope.postMessage({ type: "export-complete", pdf: transfer, filename }, [transfer]);
}

function imageDataFromBitmap(bitmap: ImageBitmap, maxWidth: number) {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot process canvas image data.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function parseRatio(value: RatioValue) {
  const [w, h] = value.split(":").map(Number);
  return w / h;
}

function detectQuad(imageData: ImageData, ratio: number): [Quad, DetectDiagnostics] {
  const gray = grayscale(imageData);
  const contrast = contrastQuad(gray, imageData.width, imageData.height, ratio);
  if (contrast) return contrast;

  const marginX = imageData.width * 0.045;
  const marginY = imageData.height * 0.055;
  return [
    [
      [
        [marginX, marginY],
        [imageData.width - marginX, marginY],
        [imageData.width - marginX, imageData.height - marginY],
        [marginX, imageData.height - marginY],
      ],
      { method: "fallback-frame", confidence: 0.18 },
    ] as [Quad, DetectDiagnostics],
  ][0];
}

function grayscale(imageData: ImageData) {
  const data = imageData.data;
  const gray = new Float64Array(imageData.width * imageData.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    gray[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return boxBlur(gray, imageData.width, imageData.height, 2);
}

function boxBlur(values: Float64Array, width: number, height: number, radius: number) {
  let source = values;
  let target = new Float64Array(values.length);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) sum += source[y * width + clamp(x, 0, width - 1)];
    for (let x = 0; x < width; x += 1) {
      target[y * width + x] = sum / (radius * 2 + 1);
      sum -= source[y * width + clamp(x - radius, 0, width - 1)];
      sum += source[y * width + clamp(x + radius + 1, 0, width - 1)];
    }
  }

  source = target;
  target = new Float64Array(values.length);
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) sum += source[clamp(y, 0, height - 1) * width + x];
    for (let y = 0; y < height; y += 1) {
      target[y * width + x] = sum / (radius * 2 + 1);
      sum -= source[clamp(y - radius, 0, height - 1) * width + x];
      sum += source[clamp(y + radius + 1, 0, height - 1) * width + x];
    }
  }
  return target;
}

function contrastQuad(
  gray: Float64Array,
  width: number,
  height: number,
  ratio: number,
): [Quad, DetectDiagnostics] | null {
  const tops = horizontalEdgeCandidates(gray, width, height, "top", 8);
  const bottoms = horizontalEdgeCandidates(gray, width, height, "bottom", 8);
  const lefts = verticalEdgeCandidates(gray, width, height, "left", 8);
  const rights = verticalEdgeCandidates(gray, width, height, "right", 8);
  if (!tops.length || !bottoms.length || !lefts.length || !rights.length) return null;

  let best: { score: number; quad: Quad; scores: number[]; aspect: number; area: number } | null = null;

  for (const [top, topScore] of tops) {
    for (const [bottom, bottomScore] of bottoms) {
      if (yAt(bottom, width / 2) <= yAt(top, width / 2) + height * 0.18) continue;
      for (const [left, leftScore] of lefts) {
        for (const [right, rightScore] of rights) {
          if (xAt(right, height / 2) <= xAt(left, height / 2) + width * 0.2) continue;
          const quad = orderQuad([
            intersect(top, left),
            intersect(top, right),
            intersect(bottom, right),
            intersect(bottom, left),
          ]);
          if (!quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) continue;
          if (quad.some(([x, y]) => x < -width * 0.18 || x > width * 1.18 || y < -height * 0.18 || y > height * 1.18)) {
            continue;
          }

          const topLength = distance(quad[1], quad[0]);
          const bottomLength = distance(quad[2], quad[3]);
          const leftLength = distance(quad[3], quad[0]);
          const rightLength = distance(quad[2], quad[1]);
          const aspect = ((topLength + bottomLength) / 2) / Math.max(1, (leftLength + rightLength) / 2);
          const area = polygonArea(quad) / (width * height);
          if (area < 0.12 || aspect < ratio * 0.52 || aspect > ratio * 1.62) continue;

          const aspectError = Math.abs(Math.log(Math.max(0.05, aspect / ratio)));
          const edgeScore = (topScore + bottomScore + leftScore + rightScore) / 4;
          const score = edgeScore + 82 * area - 72 * aspectError;
          if (!best || score > best.score) {
            best = { score, quad, scores: [topScore, bottomScore, leftScore, rightScore], aspect, area };
          }
        }
      }
    }
  }

  if (!best) return null;
  const confidence = Math.min(1, 0.42 + average(best.scores) / 70 + best.area * 0.25);
  return [best.quad, { method: "contrast-lines", confidence: round(confidence, 3) }];
}

function horizontalEdgeCandidates(
  gray: Float64Array,
  width: number,
  height: number,
  kind: "top" | "bottom",
  limit: number,
) {
  const xs = linspace(width * 0.16, width * 0.88, 180);
  const xCenter = width / 2;
  const offset = Math.max(5, height * 0.017);
  const start = kind === "top" ? height * 0.07 : height * 0.42;
  const end = kind === "top" ? height * 0.45 : height * 0.92;
  const step = Math.max(2, Math.floor(height / 220));
  const candidates: Array<[Line, number, number, number]> = [];

  for (const slope of linspace(-0.22, 0.16, 29)) {
    for (let y0 = start; y0 < end; y0 += step) {
      const diffs: number[] = [];
      for (const x of xs) {
        const y = slope * (x - xCenter) + y0;
        if (y <= offset + 1 || y >= height - offset - 1) continue;
        const inner = kind === "top" ? sample(gray, width, height, x, y + offset) : sample(gray, width, height, x, y - offset);
        const outer = kind === "top" ? sample(gray, width, height, x, y - offset) : sample(gray, width, height, x, y + offset);
        diffs.push(inner - outer);
      }
      if (diffs.length < xs.length * 0.82) continue;
      const score = contrastScore(diffs);
      if (score > 3.5) candidates.push([{ a: -slope, b: 1, c: slope * xCenter - y0 }, score, y0, slope]);
    }
  }
  return pickDistinct(candidates, limit, height, "horizontal");
}

function verticalEdgeCandidates(
  gray: Float64Array,
  width: number,
  height: number,
  kind: "left" | "right",
  limit: number,
) {
  const ys = linspace(height * 0.18, height * 0.84, 170);
  const yCenter = height / 2;
  const offset = Math.max(5, width * 0.012);
  const start = kind === "left" ? width * 0.01 : width * 0.54;
  const end = kind === "left" ? width * 0.46 : width * 0.99;
  const step = Math.max(2, Math.floor(width / 240));
  const candidates: Array<[Line, number, number, number]> = [];

  for (const slope of linspace(-0.24, 0.24, 31)) {
    for (let x0 = start; x0 < end; x0 += step) {
      const diffs: number[] = [];
      for (const y of ys) {
        const x = slope * (y - yCenter) + x0;
        if (x <= offset + 1 || x >= width - offset - 1) continue;
        const inner = kind === "left" ? sample(gray, width, height, x + offset, y) : sample(gray, width, height, x - offset, y);
        const outer = kind === "left" ? sample(gray, width, height, x - offset, y) : sample(gray, width, height, x + offset, y);
        diffs.push(inner - outer);
      }
      if (diffs.length < ys.length * 0.8) continue;
      const score = contrastScore(diffs);
      if (score > 3.5) candidates.push([{ a: 1, b: -slope, c: slope * yCenter - x0 }, score, x0, slope]);
    }
  }
  return pickDistinct(candidates, limit, width, "vertical");
}

function pickDistinct(candidates: Array<[Line, number, number, number]>, limit: number, span: number, axis: "horizontal" | "vertical") {
  candidates.sort((a, b) => b[1] - a[1]);
  const selected: Array<[Line, number, number, number]> = [];
  const slopeGap = axis === "horizontal" ? 0.055 : 0.065;
  for (const candidate of candidates) {
    const [, , position, slope] = candidate;
    if (selected.every((kept) => Math.abs(position - kept[2]) > span * 0.035 || Math.abs(slope - kept[3]) > slopeGap)) {
      selected.push(candidate);
    }
    if (selected.length >= limit) break;
  }
  return selected.map(([line, score]) => [line, score] as [Line, number]);
}

function contrastScore(diffs: number[]) {
  const positive = diffs.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length < Math.max(8, diffs.length * 0.12)) return 0;
  return percentileSorted(positive, 0.72) + average(positive) * 0.35;
}

async function renderWarpedJpeg(file: File, quad: Quad, outWidth: number, outHeight: number, settings: Settings) {
  const bitmap = await createImageBitmap(file);
  const sourceScale = Math.min(1, 3000 / bitmap.width);
  const sourceWidth = Math.max(1, Math.round(bitmap.width * sourceScale));
  const sourceHeight = Math.max(1, Math.round(bitmap.height * sourceScale));
  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("This browser cannot read canvas pixels.");
  sourceCtx.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
  bitmap.close();

  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const fill = parseHexColor(settings.fillColor);
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const output = new ImageData(outWidth, outHeight);
  const coeffs = perspectiveCoefficients(scaledQuad, [
    [0, 0],
    [outWidth, 0],
    [outWidth, outHeight],
    [0, outHeight],
  ] as Quad);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const denom = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / denom;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / denom;
      sampleRgb(source, sx, sy, output.data, (y * outWidth + x) * 4, settings.grayscale, fill);
    }
  }

  const outputCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("This browser cannot render the corrected slide.");
  outputCtx.putImageData(output, 0, 0);
  const blob = await outputCanvas.convertToBlob({ type: "image/jpeg", quality: settings.quality });
  return new Uint8Array(await blob.arrayBuffer());
}

function perspectiveCoefficients(src: Quad, dst: Quad) {
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = dst[i];
    const [u, v] = src[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(u, v);
  }
  return solveLinearSystem(matrix, vector);
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col] || 1e-12;
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function parseHexColor(value: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function sampleRgb(
  source: ImageData,
  x: number,
  y: number,
  target: Uint8ClampedArray,
  offset: number,
  grayscaleOutput: boolean,
  fill: [number, number, number],
) {
  const width = source.width;
  const height = source.height;
  if (x < 0 || x >= width || y < 0 || y >= height) {
    target[offset] = fill[0];
    target[offset + 1] = fill[1];
    target[offset + 2] = fill[2];
    target[offset + 3] = 255;
    return;
  }
  const sx = clamp(x, 0, width - 1);
  const sy = clamp(y, 0, height - 1);
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const wx = sx - x0;
  const wy = sy - y0;
  const data = source.data;
  const p00 = (y0 * width + x0) * 4;
  const p10 = (y0 * width + x1) * 4;
  const p01 = (y1 * width + x0) * 4;
  const p11 = (y1 * width + x1) * 4;

  let r = bilinear(data[p00], data[p10], data[p01], data[p11], wx, wy);
  let g = bilinear(data[p00 + 1], data[p10 + 1], data[p01 + 1], data[p11 + 1], wx, wy);
  let b = bilinear(data[p00 + 2], data[p10 + 2], data[p01 + 2], data[p11 + 2], wx, wy);

  if (grayscaleOutput) {
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray;
    g = gray;
    b = gray;
  }

  target[offset] = r;
  target[offset + 1] = g;
  target[offset + 2] = b;
  target[offset + 3] = 255;
}

function bilinear(a: number, b: number, c: number, d: number, wx: number, wy: number) {
  return a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
}

function sample(gray: Float64Array, width: number, height: number, x: number, y: number) {
  const xi = clamp(Math.round(x), 0, width - 1);
  const yi = clamp(Math.round(y), 0, height - 1);
  return gray[yi * width + xi];
}

function yAt(line: Line, x: number) {
  return Math.abs(line.b) < 1e-9 ? Number.NaN : -(line.a * x + line.c) / line.b;
}

function xAt(line: Line, y: number) {
  return Math.abs(line.a) < 1e-9 ? Number.NaN : -(line.b * y + line.c) / line.a;
}

function intersect(l1: Line, l2: Line): [number, number] {
  const denominator = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(denominator) < 1e-9) return [Number.NaN, Number.NaN];
  return [
    (l1.b * l2.c - l2.b * l1.c) / denominator,
    (l1.c * l2.a - l2.c * l1.a) / denominator,
  ];
}

function orderQuad(points: Array<[number, number]>): Quad {
  const bySum = [...points].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const byDiff = [...points].sort((a, b) => a[0] - a[1] - (b[0] - b[1]));
  return [bySum[0], byDiff[3], bySum[3], byDiff[0]] as Quad;
}

function polygonArea(points: Quad) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current[0] * next[1] - current[1] * next[0];
  }
  return Math.abs(area) * 0.5;
}

function distance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function linspace(start: number, end: number, count: number) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function percentileSorted(values: number[], fraction: number) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)))];
}

function average(values: ArrayLike<number>) {
  if (!values.length) return 0;
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  return total / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
