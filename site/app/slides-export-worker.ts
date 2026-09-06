/// <reference lib="webworker" />

import { PDFDocument } from "pdf-lib";
import { Zip, ZipPassThrough } from "fflate";
import type { EnhancementMode } from "./enhance";
import type { Quad } from "./detection/types";
import { formatZipSlideEntryName } from "./filename";
import { constrainedImageSize } from "./image-sizing";
import { renderPerspectivePage } from "./lib/perspective-render";
import type { ExportFormat } from "./lib/types";
import {
  outputPageRatioValue,
  pdfPageDimensions,
  type OutputPageRatio,
  sourceFormatRatioValue,
  type SourceFormatSettings,
} from "./ratio";

type Settings = SourceFormatSettings & {
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
const EXPORT_SOURCE_MAX_PIXELS = 8_000_000;

scope.onmessage = async (event) => {
  const data = event.data;
  if (data.type !== "export") return;
  const format: ExportFormat = data.format === "jpg" ? "jpg" : "pdf";
  try {
    if (format === "jpg") {
      await exportJpgArchive(
        data.files as JobFile[],
        data.slides as ExportSlide[],
        data.settings as Settings,
        data.filename || ((data.slides as ExportSlide[])?.length === 1 ? "flattened-slides-001.jpg" : "flattened-slides-images.zip"),
      );
    } else {
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
      error: error instanceof Error ? error.message : "The browser export worker stopped unexpectedly.",
    });
  }
};

async function exportPdf(files: JobFile[], slides: ExportSlide[], settings: Settings, filename: string) {
  const fileById = new Map(files.map((item) => [item.id, item]));
  const pdf = await PDFDocument.create();
  const outputWidth = settings.width;
  const sourceRatio = sourceFormatRatioValue(settings);

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const item = fileById.get(slide.id);
    if (!item) continue;
    const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
    const outputHeight = settings.height ? settings.height : Math.round(outputWidth / ratio);
    scope.postMessage({ type: "export-progress", format: "pdf", current: index + 1, total: slides.length, name: item.name });
    const jpgBytes = await renderWarpedJpeg(
      item.file,
      slide.quad,
      outputWidth,
      outputHeight,
      sourceRatio,
      settings,
    );
    const image = await pdf.embedJpg(jpgBytes);
    const [pageWidth, pageHeight] = pdfPageDimensions(
      settings.outputPageRatio,
      outputWidth,
      outputHeight,
    );
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const pdfBytes = await pdf.save();
  const transfer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  scope.postMessage(
    {
      type: "export-complete",
      format: "pdf",
      buffer: transfer,
      pdf: transfer,
      filename,
      mimeType: "application/pdf",
    },
    [transfer],
  );
}

async function exportJpgArchive(files: JobFile[], slides: ExportSlide[], settings: Settings, filename: string) {
  const fileById = new Map(files.map((item) => [item.id, item]));
  const outputWidth = settings.width;
  const sourceRatio = sourceFormatRatioValue(settings);

  if (slides.length === 1) {
    const slide = slides[0];
    const item = fileById.get(slide.id);
    if (!item) throw new Error("Slide image not found.");
    const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
    const outputHeight = settings.height ? settings.height : Math.round(outputWidth / ratio);
    scope.postMessage({
      type: "export-progress",
      format: "jpg",
      current: 1,
      total: 1,
      name: item.name,
    });
    const jpgBytes = await renderWarpedJpeg(
      item.file,
      slide.quad,
      outputWidth,
      outputHeight,
      sourceRatio,
      settings,
    );
    const transfer = jpgBytes.buffer.slice(jpgBytes.byteOffset, jpgBytes.byteOffset + jpgBytes.byteLength);
    scope.postMessage(
      {
        type: "export-complete",
        format: "jpg",
        buffer: transfer,
        filename,
        mimeType: "image/jpeg",
      },
      [transfer],
    );
    return;
  }

  if (slides.length > 1) {
    const zip = new Zip();
    const chunks: Uint8Array[] = [];
    zip.ondata = (err, chunk) => {
      if (err) throw err;
      if (chunk) chunks.push(chunk);
    };

    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      const item = fileById.get(slide.id);
      if (!item) continue;
      const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
      const outputHeight = settings.height ? settings.height : Math.round(outputWidth / ratio);
      scope.postMessage({
        type: "export-progress",
        format: "jpg",
        current: index + 1,
        total: slides.length,
        name: item.name,
      });
      const jpgBytes = await renderWarpedJpeg(
        item.file,
        slide.quad,
        outputWidth,
        outputHeight,
        sourceRatio,
        settings,
      );
      const entryName = formatZipSlideEntryName(index, slides.length, item.name);
      const entry = new ZipPassThrough(entryName);
      zip.add(entry);
      entry.push(jpgBytes, true);
    }

    zip.end();

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const zipBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      zipBytes.set(chunk, offset);
      offset += chunk.length;
    }
    const transfer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
    scope.postMessage(
      {
        type: "export-complete",
        format: "jpg",
        buffer: transfer,
        filename,
        mimeType: "application/zip",
      },
      [transfer],
    );
  }
}

async function renderWarpedJpeg(
  file: File,
  quad: Quad,
  outWidth: number,
  outHeight: number,
  sourceRatio: number,
  settings: Settings,
) {
  const bitmap = await createImageBitmap(file);
  const sourceSize = constrainedImageSize(
    bitmap.width,
    bitmap.height,
    3000,
    EXPORT_SOURCE_MAX_PIXELS,
  );
  const sourceWidth = sourceSize.width;
  const sourceHeight = sourceSize.height;
  const sourceScaleX = sourceWidth / bitmap.width;
  const sourceScaleY = sourceHeight / bitmap.height;
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
  sourceCanvas.width = 0;
  sourceCanvas.height = 0;
  const scaledQuad = quad.map(([x, y]) => [x * sourceScaleX, y * sourceScaleY]) as Quad;
  const output = renderPerspectivePage(source, scaledQuad, {
    outputWidth: outWidth,
    outputHeight: outHeight,
    sourceRatio,
    fillColor: settings.fillColor,
    enhancement: settings.enhancement,
    interpolation: "bilinear",
  });

  const outputCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("This browser cannot render the corrected slide.");
  // ImageData(data, width, height) wraps the renderer's existing buffer;
  // createImageData + set would briefly duplicate the complete RGBA frame.
  const canvasImage = new ImageData(output.data as ImageDataArray, output.width, output.height);
  outputCtx.putImageData(canvasImage, 0, 0);
  const blob = await outputCanvas.convertToBlob({ type: "image/jpeg", quality: settings.quality });
  outputCanvas.width = 0;
  outputCanvas.height = 0;
  return new Uint8Array(await blob.arrayBuffer());
}
