import assert from "node:assert/strict";
import test from "node:test";

const { parseDetectionWorkerMessage, parseDetectionWorkerRequest } = await import(
  new URL("../app/lib/types.ts", import.meta.url).href,
);

const quad = [[0, 0], [100, 0], [100, 60], [0, 60]];
const result = {
  id: "slide-1",
  width: 100,
  height: 60,
  quad,
  sourceRatio: 5 / 3,
  method: "contrast-lines",
  confidence: 0.9,
  needsReview: false,
  reviewReasons: [],
  bestScore: 1,
  secondBestScore: null,
  candidatesEvaluated: 3,
  diagnostics: {},
};

test("worker protocol accepts structured detection results and errors", () => {
  assert.deepEqual(
    parseDetectionWorkerMessage({ type: "detect-result", jobId: 1, phase: "final", result }),
    { type: "detect-result", jobId: 1, phase: "final", result },
  );
  assert.deepEqual(
    parseDetectionWorkerMessage({
      type: "slide-error",
      jobId: 1,
      id: "slide-1",
      error: { code: "decode-failed", message: "bad image" },
    }),
    {
      type: "slide-error",
      jobId: 1,
      id: "slide-1",
      error: { code: "decode-failed", message: "bad image" },
    },
  );
});

test("worker protocol rejects polluted status strings and malformed payloads", () => {
  assert.equal(parseDetectionWorkerMessage({ type: "detect-start", jobId: 1, method: "detecting" }), null);
  assert.equal(parseDetectionWorkerMessage({
    type: "detect-result",
    jobId: 1,
    phase: "final",
    result: { ...result, method: "detecting" },
  }), null);
  assert.equal(parseDetectionWorkerMessage({
    type: "detect-result",
    jobId: 1,
    phase: "final",
    result: { ...result, width: -1 },
  }), null);
  assert.equal(parseDetectionWorkerMessage({
    type: "error",
    jobId: 1,
    error: "worker failed",
  }), null);
});

test("worker request validation keeps the settings contract narrow", () => {
  const file = { name: "slide.jpg", arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); } };
  assert.deepEqual(
    parseDetectionWorkerRequest({
      type: "detect",
      jobId: 2,
      files: [{ id: "slide-1", name: file.name, file }],
      settings: { sourceFormat: "16:9", sourceOrientation: "landscape" },
    }),
    {
      type: "detect",
      jobId: 2,
      files: [{ id: "slide-1", name: file.name, file }],
      settings: { sourceFormat: "16:9", sourceOrientation: "landscape" },
    },
  );
  assert.equal(parseDetectionWorkerRequest({
    type: "detect",
    jobId: 2,
    files: [{ id: "slide-1", name: file.name, file }],
    settings: { sourceFormat: "16:9", sourceOrientation: "sideways" },
  }), null);
});
