import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const fetchFn = typeof worker.fetch === "function" ? worker.fetch.bind(worker) : worker;
  return fetchFn(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Slides Thief workspace shell with SEO metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en"/i);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/i);
  assert.equal(html.match(/<meta name="viewport"/gi)?.length, 1);
  assert.match(html, /setAttribute\("content", "width=device-width, initial-scale=1, viewport-fit=cover"\)/i);
  const viewportIndex = html.search(/<meta[^>]*name="viewport"/i);
  const viewportPatchIndex = html.indexOf("setAttribute(\"content\"");
  assert.ok(viewportIndex >= 0 && viewportPatchIndex > viewportIndex);
  assert.match(html, /<title>Slides Thief - Straighten Slide &amp; Document Photos into PDFs<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/slidesthief\.com\/"/i);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/i);
  assert.doesNotMatch(html, /rel="manifest" href="https:\/\//i);
  assert.match(html, /<link rel="describedby" href="\/llms\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="service-doc" href="\/llms-full\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="sitemap" href="\/sitemap\.xml"[^>]*type="application\/xml"/i);
  assert.match(html, /property="og:title" content="Slides Thief - Straighten Slide &amp; Document Photos into PDFs"/i);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /"alternateName":\["PPT捕手"/);
  assert.match(html, /<h1 class="brandText">Slides Thief<\/h1>/);
  assert.match(html, /Auto straighten/);
  assert.match(html, /Generate PDF/);
  assert.match(html, /Convert angled slide or document photos into a clean PDF/);
  assert.match(html, /<section class="productInfo" aria-hidden="true" inert/);
  assert.doesNotMatch(html, /导出角点/);
  assert.match(html, /class="settings"/);
  assert.match(html, /class="settingsMenu"/);
  assert.match(html, /class="prefsBar"/);
  assert.match(html, /class="reviewBar"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("client code uses browser-local processing contracts", async () => {
  const [
    appMain,
    i18n,
    slideUtils,
    types,
    canvasUtils,
    perspective,
    perspectiveRender,
    useSlideDeck,
    useDetectionWorker,
    useExportWorker,
    useCanvasViewport,
    useImportPipeline,
    useKeyboardShortcuts,
    usePreferences,
    useQuadEditor,
    header,
    preferencesControls,
    sourceFormatControls,
    outputPageControls,
    settingsTransitions,
    slideSidebar,
    canvasQuadEditor,
    inspectorPanel,
    aboutModal,
    uiButton,
    uiSelect,
    uiBadge,
    uiSwitch,
    uiModalShell,
    worker,
    exportWorker,
    detector,
    css,
    packageJson,
  ] = await Promise.all([
    readFile(new URL("../app/SlidesThiefApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/slide-utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/canvas-utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/perspective.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/perspective-render.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useSlideDeck.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useDetectionWorker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useExportWorker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useCanvasViewport.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useImportPipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useKeyboardShortcuts.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/usePreferences.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useQuadEditor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PreferencesControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SourceFormatControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/OutputPageControls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/settingsTransitions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SlideSidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CanvasQuadEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/InspectorPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AboutModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/Button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/Select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/Badge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/Switch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/ModalShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slides-worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/slides-export-worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/detection/detect.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const app = [
    appMain,
    i18n,
    slideUtils,
    types,
    canvasUtils,
    perspective,
    perspectiveRender,
    useSlideDeck,
    useDetectionWorker,
    useExportWorker,
    useCanvasViewport,
    useImportPipeline,
    useKeyboardShortcuts,
    usePreferences,
    useQuadEditor,
    header,
    preferencesControls,
    sourceFormatControls,
    outputPageControls,
    settingsTransitions,
    slideSidebar,
    canvasQuadEditor,
    inspectorPanel,
    aboutModal,
    uiButton,
    uiSelect,
    uiBadge,
    uiSwitch,
    uiModalShell,
  ].join("\n");



  assert.match(app, /new Worker\(new URL\("\.\.\/slides-worker\.ts"/);
  assert.match(app, /new Worker\(new URL\("\.\.\/slides-export-worker\.ts"/);
  assert.match(app, /runAuto/);
  assert.match(app, /slide\.method === "manual" && slide\.quad !== null/);
  assert.match(app, /SlideDetectionMethod = DetectionMethod \| "manual" \| null/);
  assert.doesNotMatch(app, /method: string/);
  assert.match(app, /SlideErrorCode =/);
  assert.match(app, /export type SlideItem = PendingSlide \| DetectingSlide \| ReadySlide \| FailedSlide/);
  assert.match(app, /autoDetection: AutoDetectionSnapshot \| null/);
  assert.match(app, /detectionState: "empty"/);
  assert.match(app, /detectionState: "preview"/);
  assert.match(app, /detectionState: "manual"/);
  assert.doesNotMatch(app, /autoQuad/);
  assert.match(app, /buildAdjustedThumbnail/);
  assert.match(app, /refreshSlideThumbnail/);
  assert.match(app, /x \/ scale - padX/);
  assert.match(app, /clampQuadCoordinate/);
  assert.match(app, /QUAD_OUTSIDE_RATIO/);
  assert.match(app, /className="sidebarActions"/);
  assert.doesNotMatch(app, /manual_quads\.json/);
  assert.match(app, /themeSetting/);
  assert.match(app, /localeOptions/);
  assert.match(app, /className="prefsBar"/);
  assert.match(app, /className="settingsMenu"/);
  assert.match(app, /settings: "Settings"/);
  assert.match(app, /sourceFormat: "Source format"/);
  assert.match(app, /sourceFormat: "16:9"/);
  assert.doesNotMatch(app, /recommended16x9:/);
  assert.doesNotMatch(app, /autoDetect:/);
  assert.match(app, /pageLayout: "PDF page"/);
  assert.match(app, /matchSource: "Match source \(recommended\)"/);
  assert.doesNotMatch(app, /PDF page ratio/);
  assert.match(app, /maxLength=\{PDF_BASENAME_MAX_LENGTH\}/);
  assert.match(app, /sanitizePdfBaseName\(event\.target\.value\)/);
  assert.match(app, /"zh-TW"/);
  assert.match(app, /Español/);
  assert.match(app, /Français/);
  assert.match(app, /Português/);
  assert.match(app, /detectBrowserLocale/);
  assert.match(app, /navigator\.languages/);
  assert.match(app, /pt: "pt-BR"/);
  assert.match(app, /\.heic/);
  assert.match(app, /normalizeImageFile/);
  assert.match(app, /const clearExport = useCallback/);
  assert.match(app, /const updateSettings = useCallback/);
  assert.match(app, /clearExport\(\);\s*setSettings\(updater\)/s);
  assert.match(app, /clearExport\(\);\s*setSlides/s);
  assert.match(app, /downloadPdf: "下载 PDF"/);
  assert.doesNotMatch(app, /\{text\.downloadPdf\} \{exportName\}/);
  assert.match(app, /张照片建议复查/);
  assert.match(app, /Review suggested/);
  assert.match(app, /Revisión recomendada/);
  assert.match(app, /Vérification conseillée/);
  assert.match(app, /Prüfung empfohlen/);
  assert.match(app, /要確認/);
  assert.match(app, /검토 권장/);
  assert.match(app, /Revisão recomendada/);
  assert.match(app, /manualAdjustment: "手動調整"/);
  assert.match(app, /manualAdjustment: "Ajuste manual"/);
  assert.match(app, /manualAdjustment: "Ajustement manuel"/);
  assert.match(app, /manualAdjustment: "Manuelle Anpassung"/);
  assert.match(app, /manualAdjustment: "手動調整"/);
  assert.match(app, /manualAdjustment: "수동 조정"/);
  assert.doesNotMatch(app, /locale === "zh-CN"/);
  assert.match(app, /reviewUiCopy\[locale\]/);
  assert.match(app, /\[reviewText\.privacy, text\.noUpload\]/);
  assert.match(app, /manualAdjusted: "已手动调整"/);
  assert.match(app, /slide\.method === "manual"/);
  assert.match(app, /text\.manualAdjusted/);
  assert.doesNotMatch(app, /张图片需要检查四角|建议检查/);
  assert.match(app, /slide\.status === "detecting"\) return text\.stretching/);
  assert.match(app, /detectionMethodText\(selectedSlide\.method, locale\)/);
  assert.doesNotMatch(app, /:\s*slide\.status\}/);
  assert.match(app, /previewError: "无法显示此照片的预览"/);
  assert.match(app, /setPreviewErrorSlideId\(slide\.id\)/);
  assert.doesNotMatch(app, /setWorkerError\("Cannot render this image in the browser\."\)/);
  assert.doesNotMatch(app, /reviewedByUser/);
  assert.match(app, /autoDetection,/);
  assert.match(app, /detectionState: "preview"/);
  assert.match(app, /method: message\.result\.method/);
  assert.match(app, /needsReview: message\.result\.needsReview/);
  assert.match(app, /enhancement: "original"/);
  assert.match(app, /enhancementOriginal: "Original"/);
  assert.match(app, /enhancementClean: "清晰增强"/);
  assert.match(exportWorker, /renderPerspectivePage/);
  assert.match(slideUtils, /renderPerspectivePage/);
  assert.match(slideUtils, /interpolation:\s*"nearest"/);
  assert.match(exportWorker, /interpolation:\s*"bilinear"/);
  assert.match(exportWorker, /enhancement/);
  assert.match(exportWorker, /sourceFormatRatioValue\(settings\)/);
  assert.doesNotMatch(exportWorker, /sourceRatio = slide\.sourceRatio/);
  assert.doesNotMatch(exportWorker, /settings\.grayscale/);
  assert.match(app, /settings\.enhancement/);
  assert.match(app, /type="color"/);
  assert.match(app, /const fitScale = Math\.min\(maxWidth \/ totalWidth, maxHeight \/ totalHeight, 1\)/);
  assert.doesNotMatch(app, /Math\.max\(320, stage\.client/);
  assert.match(app, /const maxPixels = compact \? 8_000_000 : 24_000_000/);
  assert.match(app, /const redrawFrameRef = useRef<number \| null>\(null\)/);
  assert.match(app, /const observer = new ResizeObserver\(scheduleRedraw\)/);
  assert.match(app, /if \(canvas\.width !== width \|\| canvas\.height !== height\)/);
  assert.match(app, /quadHandlePositions/);
  assert.match(app, /className=\{`cornerHandle/);
  assert.match(app, /aria-describedby="cornerKeyboardHelp"/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /role="dialog"/);
  assert.match(app, /aria-modal="true"/);
  assert.match(app, /aria-labelledby="info-modal-title"/);
  assert.match(app, /import packageMetadata from "\.\.\/package\.json"/);
  assert.match(app, /const APP_VERSION = packageMetadata\.version/);
  assert.match(app, /className="modalVersion">v\{(?:APP_VERSION|appVersion)\}/);
  assert.match(JSON.parse(packageJson).version, /^\d+\.\d+\.\d+$/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /document\.activeElement === last/);
  assert.match(app, /aria-label=\{(?:text\.close|closeLabel)\}/);
  assert.match(app, /window\.requestAnimationFrame/);
  assert.match(app, /if \(workerRef\.current === worker\) workerRef\.current = null/);
  assert.match(useDetectionWorker, /message\.jobId !== activeJobIdRef\.current/);
  assert.match(useDetectionWorker, /parseDetectionWorkerMessage/);
  assert.match(useDetectionWorker, /type: "detect", jobId, files, settings/);
  assert.match(worker, /createLatestJobRunner/);
  assert.match(worker, /parseDetectionWorkerRequest/);
  assert.match(worker, /data\.type === "cancel-detect"/);
  assert.match(worker, /jobId,\s*phase/);
  assert.match(app, /slide\.status === "detecting"[\s\S]*status: "error"/);
  assert.match(app, /loading="lazy"/);
  assert.match(app, /decoding="async"/);
  assert.match(app, /status:\s*converting \? "converting" : "queued"/);
  assert.match(app, /className="thumb thumbPlaceholder"/);
  assert.match(app, /slide\.status === "converting"\s*\?\s*text\.converting/s);
  assert.doesNotMatch(app, /Promise\.all\(inputFiles\.map\(normalizeImageFile\)\)/);
  assert.match(app, /const normalizedFile = await normalizeImageFile\(file\)/);
  assert.doesNotMatch(worker, /pdf-lib|PDFDocument|renderWarpedJpeg/);
  assert.match(exportWorker, /PDFDocument\.create/);
  assert.match(exportWorker, /^import\s+\{\s*PDFDocument\s*\}\s+from\s+"pdf-lib"/m);
  assert.match(worker, /finally\s*{\s*bitmap\?\.close\(\)/s);
  assert.match(exportWorker, /fillColor/);
  assert.match(exportWorker, /new ImageData\(output\.data(?: as ImageDataArray)?, output\.width, output\.height\)/);
  assert.doesNotMatch(exportWorker, /createImageData\(output\.width, output\.height\)/);
  assert.match(
    perspectiveRender,
    /applyEnhancement\(content\.data[\s\S]*resolveFillColor\(options\.fillColor, content\)[\s\S]*fillAndBlitContent/,
  );
  assert.doesNotMatch(app, /applyEnhancement\(output\.data/);
  assert.doesNotMatch(perspectiveRender, /applyEnhancement\(output\.data/);
  assert.match(exportWorker, /OffscreenCanvas/);
  assert.match(worker, /detectQuad/);
  assert.match(detector, /contrast-lines/);
  assert.match(css, /linear-gradient\(45deg, var\(--stage-grid\) 25%, transparent 25%\)/);
  assert.match(css, /background-position: 0 0, 0 14px, 14px -14px, -14px 0/);
  assert.match(css, /canvas\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /canvas\s*\{[^}]*touch-action:\s*pan-x pan-y/s);
  assert.match(css, /\.cornerHandle\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /@media \(max-width: 834px\), \(max-height: 600px\) and \(max-width: 1040px\)/);
  assert.match(css, /body\s*\{[^}]*min-height:\s*100dvh;[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.productInfo\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
  assert.match(css, /grid-template-areas:\s*"topbar"\s*"shell"/s);
  assert.match(css, /\.settingsMenuBody\s*\{[^}]*grid-template-columns:\s*var\(--settings-columns\)/s);
  assert.match(css, /\.settingsMenuToggle/);
  assert.match(css, /\.pdfNameSetting\s*\{[^}]*max-width:\s*320px/s);
  assert.match(css, /\.sidebarFilePicker\s*\{[^}]*min-height:\s*0;[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.sidebar\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.sidebarStatus\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.statusLine\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.files\s*\{[^}]*max-height:\s*calc\(100%\s*-\s*var\(--space-3\)\);[^}]*align-self:\s*start;[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(css, /\.files\s*\{[^}]*max-height:\s*calc\(100vh/s);
  assert.match(css, /--font-size-lg:\s*16px/);
  assert.match(css, /font-size:\s*var\(--font-size-lg\)/);
  assert.match(css, /--control-height-touch:\s*44px/);
  assert.match(css, /min-height:\s*var\(--control-height-touch\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /button:not\(:disabled\):not\(\.cornerHandle\):active/);
  assert.match(css, /transform:\s*translateY\(1px\)/);
  assert.match(css, /\.uiButton--primary:not\(:disabled\):active/);
  assert.match(css, /filter:\s*brightness\(0\.9\)/);
  assert.match(css, /\.links a:active\s*\{[^}]*filter:\s*brightness\(0\.9\)[^}]*transform:\s*translateY\(1px\)/s);
  assert.doesNotMatch(css, /cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/);
  assert.doesNotMatch(css, /border-left:\s*4px solid var\(--accent-2\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(css, /canvas\s*\{[^}]*background:\s*#111/s);
  assert.match(packageJson, /"pdf-lib"/);
  assert.match(packageJson, /"heic-to"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
