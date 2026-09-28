import assert from "node:assert/strict";
import test from "node:test";

const { restoreAutoDetection, canRestoreAutoDetection } = await import(
  new URL("../app/lib/slide-transitions.ts", import.meta.url).href,
);

const { copy } = await import(new URL("../app/i18n.ts", import.meta.url).href);

test("restore auto-detection button enabled state and tooltip feedback", () => {
  const text = copy["zh-CN"];
  const snapshot = {
    quad: [[10, 10], [100, 10], [100, 70], [10, 70]],
    method: "cv",
    confidence: 0.9,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
  };

  function computeRestoreState(slide) {
    const canRestore = canRestoreAutoDetection(slide);
    const tooltip = (() => {
      if (!slide) return text.noSlide;
      if (slide.status !== "ready") return typeof text.waiting === "function" ? text.waiting(1) : text.waiting;
      if (!slide.autoDetection) return text.restoreAutoNoSnapshot;
      if (!canRestore) return text.restoreAutoUnchanged;
      return text.restoreAutoTitle;
    })();
    return { canRestore, tooltip };
  }

  // Case 1: No slide selected
  const resNoSlide = computeRestoreState(null);
  assert.equal(resNoSlide.canRestore, false);
  assert.equal(resNoSlide.tooltip, text.noSlide);

  // Case 2: Slide has no autoDetection snapshot (e.g. manual JSON import)
  const slideNoSnapshot = {
    id: "s1",
    status: "ready",
    quad: [[10, 10], [100, 10], [100, 70], [10, 70]],
    autoDetection: null,
  };
  const resNoSnapshot = computeRestoreState(slideNoSnapshot);
  assert.equal(resNoSnapshot.canRestore, false);
  assert.equal(resNoSnapshot.tooltip, "无自动检测结果可还原");

  // Case 3: Slide has autoDetection snapshot, but is unmodified
  const slideUnmodified = {
    id: "s1",
    status: "ready",
    quad: [[10, 10], [100, 10], [100, 70], [10, 70]],
    method: "cv",
    confidence: 0.9,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
    autoDetection: snapshot,
  };
  const resUnmodified = computeRestoreState(slideUnmodified);
  assert.equal(resUnmodified.canRestore, false);
  assert.equal(resUnmodified.tooltip, "当前已是自动检测结果");

  // Case 4: Slide has autoDetection snapshot and was manually modified
  const slideModified = {
    ...slideUnmodified,
    quad: [[15, 12], [102, 10], [100, 70], [10, 70]],
    method: "manual",
  };
  const resModified = computeRestoreState(slideModified);
  assert.equal(resModified.canRestore, true);
  assert.equal(resModified.tooltip, "还原到自动检测的角点与结果");

  // Case 5: Restoring resets it back to unmodified state
  const restored = restoreAutoDetection(slideModified);
  const resRestored = computeRestoreState(restored);
  assert.equal(resRestored.canRestore, false);
  assert.equal(resRestored.tooltip, "当前已是自动检测结果");
});

test("re-detect button disabled state and explanatory tooltip feedback", () => {
  const text = copy["zh-CN"];

  function computeRedetectState(slide, busy = false) {
    const isRedetectDisabled =
      !slide ||
      busy ||
      slide.status === "converting" ||
      slide.status === "detecting" ||
      !slide.url ||
      slide.error?.code === "conversion-failed";

    const tooltip = (() => {
      if (!slide) return text.noSlide;
      if (busy) return text.reDetectBusy;
      if (slide.status === "converting") return text.reDetectConverting;
      if (slide.status === "detecting") return text.reDetectDetecting;
      if (!slide.url || slide.error?.code === "conversion-failed") {
        return text.reDetectUnavailable;
      }
      return text.reDetectSlideTitle;
    })();

    return { isRedetectDisabled, tooltip };
  }

  // Case 1: No slide selected
  assert.deepEqual(computeRedetectState(null), {
    isRedetectDisabled: true,
    tooltip: "未选择页面",
  });

  // Case 2: Ready slide, idle
  const readySlide = { id: "s1", status: "ready", url: "blob:url" };
  assert.deepEqual(computeRedetectState(readySlide, false), {
    isRedetectDisabled: false,
    tooltip: "重新检测本页角点",
  });

  // Case 3: System is busy
  assert.deepEqual(computeRedetectState(readySlide, true), {
    isRedetectDisabled: true,
    tooltip: "正在处理中，请稍候",
  });

  // Case 4: Slide is converting
  const convertingSlide = { id: "s2", status: "converting", url: "blob:url" };
  assert.deepEqual(computeRedetectState(convertingSlide, false), {
    isRedetectDisabled: true,
    tooltip: "图片正在转换中",
  });

  // Case 5: Slide is detecting
  const detectingSlide = { id: "s3", status: "detecting", url: "blob:url" };
  assert.deepEqual(computeRedetectState(detectingSlide, false), {
    isRedetectDisabled: true,
    tooltip: "正在检测中",
  });
});
