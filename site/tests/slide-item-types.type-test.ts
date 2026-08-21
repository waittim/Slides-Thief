import type { Quad } from "../app/detection/types";
import type { SlideItem } from "../app/lib/types";

const quad: Quad = [[0, 0], [100, 0], [100, 60], [0, 60]];
const base = {
  id: "slide-1",
  file: {} as File,
  name: "slide.jpg",
  url: "blob:slide",
  width: 100,
  height: 60,
  autoDetection: null,
  thumbnailUrl: undefined,
  confidence: 0,
  needsReview: false,
  reviewReasons: [],
  sourceRatio: 5 / 3,
};

const validQueued: SlideItem = {
  ...base,
  status: "queued",
  quad: null,
  method: null,
};

const validDetecting: SlideItem = {
  ...base,
  status: "detecting",
  detectionState: "empty",
  quad: null,
  method: null,
};

const validReady: SlideItem = {
  ...base,
  status: "ready",
  quad,
  method: "contrast-lines",
};

const validError: SlideItem = {
  ...base,
  status: "error",
  quad: null,
  method: null,
  error: { code: "decode-failed", message: "bad image" },
};

void [validQueued, validDetecting, validReady, validError];

// @ts-expect-error A ready slide must have a resolved quadrilateral.
const readyWithoutQuad: SlideItem = { ...base, status: "ready", quad: null, method: "contrast-lines" };
// @ts-expect-error Pending slides cannot carry a manual detection source.
const queuedWithManualMethod: SlideItem = { ...base, status: "queued", quad: null, method: "manual" };
// @ts-expect-error Error slides must carry a structured error.
const errorWithoutError: SlideItem = { ...base, status: "error", quad: null, method: null };
// @ts-expect-error Error slides cannot use an undefined error value.
const errorWithUndefined: SlideItem = { ...base, status: "error", quad: null, method: null, error: undefined };
const readyWithError: SlideItem = {
  ...base,
  status: "ready",
  quad,
  method: "contrast-lines",
  // @ts-expect-error Non-error slides cannot carry an error payload.
  error: { code: "decode-failed", message: "bad image" },
};
// @ts-expect-error Detecting slides must state whether they are empty, preview, or manual.
const detectingWithoutState: SlideItem = { ...base, status: "detecting", quad: null, method: null };

void [readyWithoutQuad, queuedWithManualMethod, errorWithoutError, errorWithUndefined, readyWithError, detectingWithoutState];
