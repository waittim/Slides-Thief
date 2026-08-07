/// <reference lib="webworker" />

import { buildBatchPriors, normalizeResult } from "./detection/batch-prior";
import { detectQuad } from "./detection/detect";
import type { DetectionResult, DetectionSettings, Quad } from "./detection/types";
import { constrainedImageSize } from "./image-sizing";
import {
  sourceFormatRatioValue,
  type SourceFormat,
} from "./ratio";

type Settings = {
  sourceFormat: SourceFormat;
  sourceCustomRatio?: number;
};

type JobFile = {
  id: string;
  name: string;
  file: File;
};

const scope = self as DedicatedWorkerGlobalScope;
const DETECTION_MAX_PIXELS = 1_200_000;

scope.onmessage = async (event) => {
  const data = event.data;
  try {
    if (data.type === "detect") {
      await detectFiles(data.files as JobFile[], data.settings as Settings);
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "The browser processing worker stopped unexpectedly.",
    });
  }
};

async function detectFiles(files: JobFile[], settings: Settings) {
  const preliminary: Array<{
    item: JobFile;
    width: number;
    height: number;
    result: ReturnType<typeof workerDetectionResult>;
  }> = [];
  const sourceRatioHint = sourceFormatRatioValue(
    settings.sourceFormat,
    settings.sourceCustomRatio,
  );

  for (const item of files) {
    let bitmap: ImageBitmap | null = null;
    try {
      scope.postMessage({ type: "detect-start", id: item.id });
      bitmap = await createImageBitmap(item.file);
      const detectionSettings: DetectionSettings = {
        maxDetectionWidth: 900,
        sourceRatioHint,
        enableBatchPrior: false,
      };
      const imageData = imageDataFromBitmap(bitmap, detectionSettings.maxDetectionWidth);
      const detection = detectQuad(imageData, detectionSettings);
      const result = workerDetectionResult(
        item.id,
        bitmap.width,
        bitmap.height,
        imageData.width,
        imageData.height,
        detection,
        settings,
      );
      preliminary.push({ item, width: bitmap.width, height: bitmap.height, result });
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

  postDetectionResults(
    preliminary.map(({ result }) => result),
    "preliminary",
  );

  const priors = buildBatchPriors(preliminary.map(({ item, width, height, result }) =>
    normalizeResult(
      item.id,
      width,
      height,
      result.quad,
      result.confidence,
      result.method,
      result.needsReview,
    )
  ));
  scope.postMessage({
    type: "detect-batch-summary",
    summary: {
      preliminaryCount: preliminary.length,
      reliableCount: preliminary.filter(({ result }) =>
        result.confidence >= 0.78 && result.method !== "fallback-frame"
      ).length,
      priorCount: priors.length,
      priors,
    },
  });
  const finalResults: Array<ReturnType<typeof workerDetectionResult>> = [];
  if (!priors.length) {
    for (const entry of preliminary) {
      finalResults.push(entry.result);
    }
  } else {
    for (const entry of preliminary) {
      if (!(entry.result.confidence < 0.72 && entry.result.needsReview)) {
        finalResults.push(entry.result);
        continue;
      }
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(entry.item.file);
        const detectionSettings: DetectionSettings = {
          maxDetectionWidth: 900,
          sourceRatioHint,
          enableBatchPrior: true,
        };
        const imageData = imageDataFromBitmap(bitmap, detectionSettings.maxDetectionWidth);
        const detection = detectQuad(imageData, detectionSettings, priors);
        finalResults.push(workerDetectionResult(
          entry.item.id,
          bitmap.width,
          bitmap.height,
          imageData.width,
          imageData.height,
          detection,
          settings,
        ));
      } catch (error) {
        finalResults.push({
          ...entry.result,
          diagnostics: {
            ...entry.result.diagnostics,
            batchPriorError: error instanceof Error
              ? error.message
              : "Could not apply the batch geometry prior.",
          },
        });
      } finally {
        bitmap?.close();
      }
    }
  }

  postDetectionResults(finalResults, "final");
}

function postDetectionResults(
  results: Array<ReturnType<typeof workerDetectionResult>>,
  phase: "preliminary" | "final",
) {
  for (const result of results) {
    scope.postMessage({
      type: "detect-result",
      phase,
      result,
    });
  }
}

function workerDetectionResult(
  id: string,
  width: number,
  height: number,
  detectionWidth: number,
  detectionHeight: number,
  detection: DetectionResult,
  settings: Settings,
) {
  const scaleX = width / detectionWidth;
  const scaleY = height / detectionHeight;
  const quad = detection.quad.map(([x, y]) => [x * scaleX, y * scaleY]) as Quad;
  const sourceRatio = sourceFormatRatioValue(
    settings.sourceFormat,
    settings.sourceCustomRatio,
  );
  return {
    id,
    width,
    height,
    quad,
    sourceRatio,
    method: detection.method,
    confidence: detection.confidence,
    needsReview: detection.needsReview,
    reviewReasons: detection.reviewReasons,
    bestScore: detection.bestScore,
    secondBestScore: detection.secondBestScore,
    candidatesEvaluated: detection.candidatesEvaluated,
    diagnostics: {
      ...detection.diagnostics,
      sourceRatio,
      sourceFormat: settings.sourceFormat,
    },
  };
}

function imageDataFromBitmap(bitmap: ImageBitmap, maxWidth: number) {
  const { width, height } = constrainedImageSize(
    bitmap.width,
    bitmap.height,
    maxWidth,
    DETECTION_MAX_PIXELS,
  );
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot process canvas image data.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;
  return data;
}
