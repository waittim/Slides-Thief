import assert from "node:assert/strict";
import test from "node:test";

const {
  APP_ERROR_CODES,
  AppError,
  isAppError,
  isAppErrorCode,
  toAppErrorPayload,
} = await import(new URL("../app/lib/errors.ts", import.meta.url).href);

const {
  errorUiCopy,
  formatAppError,
  formatSlideError,
  localeOptions,
  slideBadgeTitle,
  copy,
  reviewUiCopy,
} = await import(new URL("../app/i18n.ts", import.meta.url).href);

const ALL_LOCALES = localeOptions.map((opt) => opt.value);

test("all 9 locales have complete errorUiCopy definitions", () => {
  assert.equal(ALL_LOCALES.length, 9);
  for (const locale of ALL_LOCALES) {
    const localeCopy = errorUiCopy[locale];
    assert.ok(localeCopy, `errorUiCopy exists for ${locale}`);

    // Verify all static string keys exist and are non-empty
    const staticKeys = [
      "workerInvalidResponse",
      "workerStoppedUnexpectedly",
      "workerResponseReadFailed",
      "exportWorkerStoppedUnexpectedly",
      "exportWorkerResponseReadFailed",
      "processingWorkerStopped",
      "exportWorkerFailed",
      "imageDecodeFailed",
      "batchPriorFailed",
      "noSlidesToExport",
      "canvasReadFailed",
      "canvasRenderFailed",
      "canvasNotAvailable",
      "canvasEncodeFailed",
      "cornersImportNoImages",
      "cornersImportEmpty",
    ];

    for (const key of staticKeys) {
      assert.equal(
        typeof localeCopy[key],
        "string",
        `errorUiCopy.${locale}.${key} should be a string`,
      );
      assert.ok(
        localeCopy[key].length > 0,
        `errorUiCopy.${locale}.${key} should not be empty`,
      );
    }

    // Verify parameterized function keys
    assert.equal(typeof localeCopy.slideImageNotFound, "function");
    assert.ok(localeCopy.slideImageNotFound("test.jpg").includes("test.jpg"));

    assert.equal(typeof localeCopy.cornersImportNoMatch, "function");
    assert.ok(localeCopy.cornersImportNoMatch("page-1").includes("page-1"));

    assert.equal(typeof localeCopy.cornersImportDuplicate, "function");
    assert.ok(localeCopy.cornersImportDuplicate("page-1").includes("page-1"));

    assert.equal(typeof localeCopy.cornersImportDimensionsNotReady, "function");
    assert.ok(localeCopy.cornersImportDimensionsNotReady("page-1").includes("page-1"));

    assert.equal(typeof localeCopy.heifConversionFailed, "function");
    assert.ok(localeCopy.heifConversionFailed("photo.heic", "decode error").includes("photo.heic"));
  }
});

test("formatAppError translates error codes into active locale", () => {
  // Test Chinese translations
  assert.equal(
    formatAppError("worker-invalid-response", "zh-CN"),
    "图像处理服务返回了无效响应。",
  );
  assert.equal(
    formatAppError("worker-invalid-response", "zh-TW"),
    "影像處理服務回傳了無效回應。",
  );
  assert.equal(
    formatAppError("worker-invalid-response", "en"),
    "The image worker returned an invalid response.",
  );
  assert.equal(
    formatAppError("worker-invalid-response", "ja"),
    "画像処理ワーカーから無効な応答が返されました。",
  );
  assert.equal(
    formatAppError("worker-invalid-response", "de"),
    "Der Bildverarbeitungsprozess hat eine ungültige Antwort zurückgegeben.",
  );

  // Test corner import error
  assert.equal(
    formatAppError("corners-import-no-images", "zh-CN"),
    "导入角点坐标前，请先导入图像。",
  );
  assert.equal(
    formatAppError("corners-import-no-images", "en"),
    "Import images before importing corner coordinates.",
  );

  // Test export worker error
  assert.equal(
    formatAppError("export-worker-stopped-unexpectedly", "zh-CN"),
    "导出服务意外停止。",
  );
  assert.equal(
    formatAppError("export-worker-stopped-unexpectedly", "es"),
    "El proceso de exportación se detuvo inesperadamente.",
  );
});

test("formatAppError formats parameterized errors correctly", () => {
  const errNoMatch = {
    code: "corners-import-no-match",
    params: { name: "slide-01.png" },
  };
  assert.equal(
    formatAppError(errNoMatch, "zh-CN"),
    '已加载的图像中没有匹配 "slide-01.png" 的角点数据。',
  );
  assert.equal(
    formatAppError(errNoMatch, "en"),
    'No loaded image matches manual corners for "slide-01.png".',
  );

  const errDuplicate = {
    code: "corners-import-duplicate",
    params: { name: "slide-02.png" },
  };
  assert.equal(
    formatAppError(errDuplicate, "zh-CN"),
    '角点文件中包含重复的 "slide-02.png" 条目。',
  );

  const errNotFound = {
    code: "slide-image-not-found",
    params: { name: "slide-03.png" },
  };
  assert.equal(
    formatAppError(errNotFound, "zh-CN"),
    "未找到幻灯片图像：slide-03.png",
  );
  assert.equal(
    formatAppError(errNotFound, "en"),
    "Slide image not found: slide-03.png",
  );
});

test("formatAppError handles AppError class instances", () => {
  const appError = new AppError("corners-import-empty", "The manual corner file does not contain any entries.");
  assert.equal(formatAppError(appError, "zh-CN"), "角点文件中没有任何有效条目。");
  assert.equal(formatAppError(appError, "en"), "The manual corner file does not contain any entries.");
});

test("formatAppError maps legacy English strings for backward compatibility", () => {
  assert.equal(
    formatAppError("The image worker returned an invalid response.", "zh-CN"),
    "图像处理服务返回了无效响应。",
  );
  assert.equal(
    formatAppError("The export worker stopped unexpectedly.", "zh-CN"),
    "导出服务意外停止。",
  );
  assert.equal(
    formatAppError("Import images before importing corner coordinates.", "zh-CN"),
    "导入角点坐标前，请先导入图像。",
  );
  assert.equal(
    formatAppError('No loaded image matches manual corners for "slide-1.jpg".', "zh-CN"),
    '已加载的图像中没有匹配 "slide-1.jpg" 的角点数据。',
  );
});

test("formatAppError preserves arbitrary unknown error strings", () => {
  assert.equal(
    formatAppError("Failed to export PDF: Out of memory", "zh-CN"),
    "Failed to export PDF: Out of memory",
  );
  assert.equal(formatAppError("", "zh-CN"), "");
});

test("formatSlideError and slideBadgeTitle format structured slide errors", () => {
  const textZh = copy["zh-CN"];
  const reviewZh = reviewUiCopy["zh-CN"];

  const structuredErrorSlide = {
    id: "slide-1",
    name: "slide-1.jpg",
    status: "error",
    error: {
      code: "worker-failed",
      message: "The image worker stopped unexpectedly.",
      errorCode: "worker-stopped-unexpectedly",
    },
    confidence: 0,
    needsReview: false,
    reviewReasons: [],
  };

  assert.equal(
    formatSlideError(structuredErrorSlide.error, "zh-CN"),
    "图像处理服务意外停止。",
  );
  assert.equal(
    slideBadgeTitle(structuredErrorSlide, textZh, reviewZh, "zh-CN"),
    "图像处理服务意外停止。",
  );

  // Unstructured error preserves message
  const rawErrorSlide = {
    id: "slide-2",
    name: "slide-2.jpg",
    status: "error",
    error: {
      code: "decode-failed",
      message: "Custom decode issue",
    },
    confidence: 0,
    needsReview: false,
    reviewReasons: [],
  };
  assert.equal(
    slideBadgeTitle(rawErrorSlide, textZh, reviewZh, "zh-CN"),
    "Custom decode issue",
  );
});

test("isAppError and toAppErrorPayload utility behavior", () => {
  assert.ok(isAppError(new AppError("canvas-read-failed")));
  assert.ok(isAppError({ code: "canvas-read-failed" }));
  assert.ok(!isAppError("canvas-read-failed"));
  assert.ok(!isAppError(null));

  const payloadFromCode = toAppErrorPayload("canvas-read-failed");
  assert.equal(payloadFromCode.code, "canvas-read-failed");

  const payloadFromLegacy = toAppErrorPayload("The image worker stopped unexpectedly.");
  assert.equal(payloadFromLegacy.code, "worker-stopped-unexpectedly");

  const payloadFromUnknown = toAppErrorPayload(new Error("custom error"), "export-worker-failed");
  assert.equal(payloadFromUnknown.code, "export-worker-failed");
  assert.equal(payloadFromUnknown.message, "custom error");
});
