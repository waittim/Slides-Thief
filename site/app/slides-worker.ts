/// <reference lib="webworker" />

import { PDFDocument } from "pdf-lib";
import { applyEnhancement, type EnhancementMode } from "./enhance";
import { detectQuad } from "./detection/detect";
import type { DetectionSettings, Quad } from "./detection/types";
import {
  outputPageRatioValue,
  sourceSlideRatioValue,
  type OutputPageRatio,
  type SourceSlideRatio,
} from "./ratio";

type Settings = {
  sourceSlideRatio: SourceSlideRatio;
  sourceCustomRatio?: number;
  outputPageRatio: OutputPageRatio;
  width: number;
  height: number | null;
  quality: number;
  enhancement: EnhancementMode;
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
    let bitmap: ImageBitmap | null = null;
    try {
      scope.postMessage({ type: "detect-start", id: item.id });
      bitmap = await createImageBitmap(item.file);
      const detectionSettings: DetectionSettings = {
        maxDetectionWidth: 900,
        sourceRatioHint: sourceSlideRatioValue(settings.sourceSlideRatio, settings.sourceCustomRatio),
        enableBatchPrior: false,
      };
      const imageData = imageDataFromBitmap(bitmap, detectionSettings.maxDetectionWidth);
      const detection = detectQuad(imageData, detectionSettings);
      const scale = bitmap.width / imageData.width;
      const fullQuad = detection.quad.map(([x, y]) => [x * scale, y * scale]) as Quad;
      scope.postMessage({
        type: "detect-result",
        result: {
          id: item.id,
          width: bitmap.width,
          height: bitmap.height,
          quad: fullQuad,
          method: detection.method,
          confidence: detection.confidence,
          needsReview: detection.needsReview,
          reviewReasons: detection.reviewReasons,
          bestScore: detection.bestScore,
          secondBestScore: detection.secondBestScore,
          candidatesEvaluated: detection.candidatesEvaluated,
          diagnostics: detection.diagnostics,
        },
      });
    } catch (error) {
      scope.postMessage({
        type: "slide-error",
        id: item.id,
        error: error instanceof Error ? error.message : "Could not decode this image in the browser.",
      });
    } finally {
      bitmap?.close();
    }
  }
}

async function exportPdf(files: JobFile[], slides: ExportSlide[], settings: Settings, filename: string) {
  const fileById = new Map(files.map((item) => [item.id, item]));
  const pdf = await PDFDocument.create();
  const sourceRatio = sourceSlideRatioValue(settings.sourceSlideRatio, settings.sourceCustomRatio);
  const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
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


async function renderWarpedJpeg(file: File, quad: Quad, outWidth: number, outHeight: number, settings: Settings) {
  const bitmap = await createImageBitmap(file);
  const sourceScale = Math.min(1, 3000 / bitmap.width);
  const sourceWidth = Math.max(1, Math.round(bitmap.width * sourceScale));
  const sourceHeight = Math.max(1, Math.round(bitmap.height * sourceScale));
  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    bitmap.close();
    throw new Error("This browser cannot read canvas pixels.");
  }
  try {
    sourceCtx.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
  } finally {
    bitmap.close();
  }

  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const fill = parseHexColor(settings.fillColor);
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const output = new ImageData(outWidth, outHeight);
  const sourceRatio = sourceSlideRatioValue(settings.sourceSlideRatio, settings.sourceCustomRatio);
  const target = containedRect(outWidth, outHeight, sourceRatio);
  const coeffs = perspectiveCoefficients(scaledQuad, target);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const targetOffset = (y * outWidth + x) * 4;
      if (x < target[0][0] || x >= target[1][0] || y < target[0][1] || y >= target[3][1]) {
        output.data[targetOffset] = fill[0];
        output.data[targetOffset + 1] = fill[1];
        output.data[targetOffset + 2] = fill[2];
        output.data[targetOffset + 3] = 255;
        continue;
      }
      const denom = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / denom;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / denom;
      sampleRgb(source, sx, sy, output.data, targetOffset, fill);
    }
  }

  applyEnhancement(output.data, outWidth, outHeight, settings.enhancement);

  const outputCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("This browser cannot render the corrected slide.");
  outputCtx.putImageData(output, 0, 0);
  const blob = await outputCanvas.convertToBlob({ type: "image/jpeg", quality: settings.quality });
  return new Uint8Array(await blob.arrayBuffer());
}

function containedRect(width: number, height: number, ratio: number): Quad {
  const pageRatio = width / height;
  const contentWidth = pageRatio > ratio ? height * ratio : width;
  const contentHeight = pageRatio > ratio ? height : width / ratio;
  const left = (width - contentWidth) / 2;
  const top = (height - contentHeight) / 2;
  return [
    [left, top],
    [left + contentWidth, top],
    [left + contentWidth, top + contentHeight],
    [left, top + contentHeight],
  ];
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

  target[offset] = bilinear(data[p00], data[p10], data[p01], data[p11], wx, wy);
  target[offset + 1] = bilinear(data[p00 + 1], data[p10 + 1], data[p01 + 1], data[p11 + 1], wx, wy);
  target[offset + 2] = bilinear(data[p00 + 2], data[p10 + 2], data[p01 + 2], data[p11 + 2], wx, wy);
  target[offset + 3] = 255;
}

function bilinear(a: number, b: number, c: number, d: number, wx: number, wy: number) {
  return a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
