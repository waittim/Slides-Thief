import test from "node:test";
import assert from "node:assert/strict";

const { exportManualQuads } = await import(
  new URL("../app/lib/export-utils.ts", import.meta.url).href
);

test("exportManualQuads formats slides into valid ManualQuads object", () => {
  const dummyFile = { name: "slide_001.jpg" };
  const mockQuad = [
    [10, 20],
    [100, 20],
    [100, 80],
    [10, 80],
  ];

  const slides = [
    {
      id: "1",
      file: dummyFile,
      quad: mockQuad,
      autoDetection: {
        quad: mockQuad,
        method: "contrast-lines",
        confidence: 0.9,
        needsReview: false,
        reviewReasons: [],
        sourceRatio: 16 / 9,
      },
      needsReview: false,
      reviewReasons: [],
      confidence: 0.9,
    },
  ];

  const exported = exportManualQuads(slides);
  assert.deepEqual(exported, {
    "slide_001.jpg": [
      [10, 20],
      [100, 20],
      [100, 80],
      [10, 80],
    ],
  });
});
