import { useRef, useState } from "react";
import { copy, reviewUiCopy } from "../../app/i18n";
import { SlideSidebar } from "../../app/components/SlideSidebar";
import type { SlideItem } from "../../app/lib/types";

const QUAD = [[12, 10], [108, 10], [108, 70], [12, 70]] as const;

function queuedSlide(file: File): SlideItem {
  return {
    id: file.name,
    file,
    name: file.name,
    url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    width: 100,
    height: 70,
    quad: null,
    autoDetection: null,
    method: null,
    confidence: 0,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
    status: "queued",
  };
}

function readySlide(slide: SlideItem): SlideItem {
  return {
    ...slide,
    quad: QUAD.map(([x, y]) => [x, y]) as [number, number][],
    method: "contrast-lines",
    confidence: 0.95,
    needsReview: false,
    status: "ready",
  } as SlideItem;
}

export function SidebarHarness({
  initialBusy = false,
  initialSlides = [],
  initialHasRun = false,
  initialDetecting = false,
  initialProgress = null,
  initialErrorMessage,
  initialErrorDetails,
  isMobile = false,
  isIOS = false,
  onLoadSample,
}: {
  initialBusy?: boolean;
  initialSlides?: SlideItem[];
  initialHasRun?: boolean;
  initialDetecting?: boolean;
  initialProgress?: { current: number; total: number } | null;
  initialErrorMessage?: string;
  initialErrorDetails?: string;
  isMobile?: boolean;
  isIOS?: boolean;
  onLoadSample?: () => void;
} = {}) {
  const [busy, setBusy] = useState(initialBusy);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage ?? "");
  const [errorDetails, setErrorDetails] = useState(initialErrorDetails);
  const [retriedAction, setRetriedAction] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(initialDetecting);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(initialProgress);
  const [detectionCancelled, setDetectionCancelled] = useState(false);
  const [slides, setSlides] = useState<SlideItem[]>(initialSlides);
  const [hasRun, setHasRun] = useState(initialHasRun);
  const [exported, setExported] = useState(false);
  const [exportedJpg, setExportedJpg] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [manualExported, setManualExported] = useState(false);
  const [manualImported, setManualImported] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [batchRedetectedCount, setBatchRedetectedCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const text = copy.en;
  const reviewText = reviewUiCopy.en;
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);

  const exportArtifacts = {
    ...(exported
      ? {
          pdf: {
            format: "pdf" as const,
            url: "blob:http://localhost/test-pdf",
            filename: "deck.pdf",
            byteLength: 1024,
            isStale,
          },
        }
      : {}),
    ...(exportedJpg
      ? {
          jpg: {
            format: "jpg" as const,
            url: "blob:http://localhost/test-jpg",
            filename: readySlides.length === 1 ? "deck.jpg" : "deck-jpgs.zip",
            byteLength: 2048,
            isStale,
          },
        }
      : {}),
  };

  return (
    <>
      <SlideSidebar
        busy={busy}
        detecting={detecting}
        cancelDetection={() => {
          setDetecting(false);
          setProgress(null);
          setDetectionCancelled(true);
        }}
        progress={progress}
        slides={slides}
        readySlides={readySlides}
        runAuto={() => {
          setHasRun(true);
          setSlides((current) => current.map(readySlide));
        }}
        exportPdf={() => {
          setExported(true);
          setIsStale(false);
        }}
        exportJpg={() => {
          setExportedJpg(true);
          setIsStale(false);
        }}
        exportArtifacts={exportArtifacts}
        importManualQuads={() => setManualImported(true)}
        exportManualQuads={() => setManualExported(true)}
        text={text}
        reviewText={reviewText}
        statusTone={detecting ? "busy" : hasRun ? "good" : "default"}
        statusText={
          detecting && progress
            ? `${text.stretching} ${progress.current}/${progress.total}: ${slides[0]?.name ?? ""}`
            : exportedJpg
              ? text.generatedJpg
              : exported
                ? text.generated
                : hasRun
                  ? text.reviewReady
                  : text.ready
        }
        errorMessage={errorMessage}
        errorDetails={errorDetails}
        onDismissError={() => setErrorMessage("")}
        onRetryError={() => {
          setRetriedAction("retried");
          setErrorMessage("");
        }}
        exportUrl={exported ? "blob:http://localhost/test-pdf" : null}
        exportName="deck.pdf"
        isIOS={isIOS}
        clearAllSlides={() => {
          setSlides([]);
          setHasRun(false);
          setExported(false);
          setExportedJpg(false);
          setIsStale(false);
        }}
        inputRef={inputRef}
        manualInputRef={manualInputRef}
        loadFiles={(files) => {
          const fileList = Array.from(files);
          if (!fileList.length) return;
          setSlides((current) => {
            const existingNames = new Set(current.map((s) => s.name));
            const newFiles = fileList.filter((f) => !existingNames.has(f.name));
            if (!newFiles.length) return current;
            return [...current, ...newFiles.map(queuedSlide)];
          });
          setSelectedId(fileList[0].name);
          setExported(false);
          setExportedJpg(false);
        }}
        dragActive={dragActive}
        setDragActive={setDragActive}
        isMobile={isMobile}
        selectedId={selectedId}
        hasRun={hasRun}
        selectAt={(index) => setSelectedId(slides[index]?.id ?? null)}
        slideStatusText={(slide) =>
          slide.status === "ready"
            ? reviewText.corrected
            : slide.status === "detecting"
              ? text.stretching
              : text.pending
        }
        deleteSlide={(id) => setSlides((current) => current.filter((slide) => slide.id !== id))}
        moveSlide={(from, to) => {
          setSlides((current) => {
            const next = [...current];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
          });
          setIsStale(true);
        }}
        moveSlideUp={(id) => {
          setSlides((current) => {
            const idx = current.findIndex((s) => s.id === id);
            if (idx <= 0) return current;
            const next = [...current];
            const [item] = next.splice(idx, 1);
            next.splice(idx - 1, 0, item);
            return next;
          });
          setIsStale(true);
        }}
        moveSlideDown={(id) => {
          setSlides((current) => {
            const idx = current.findIndex((s) => s.id === id);
            if (idx < 0 || idx >= current.length - 1) return current;
            const next = [...current];
            const [item] = next.splice(idx, 1);
            next.splice(idx + 1, 0, item);
            return next;
          });
          setIsStale(true);
        }}
        selectedBatchIds={selectedBatchIds}
        toggleBatchSelect={(id) => {
          setSelectedBatchIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        selectAllBatch={() => {
          setSelectedBatchIds((prev) =>
            prev.size === slides.length ? new Set() : new Set(slides.map((s) => s.id))
          );
        }}
        clearBatchSelection={() => setSelectedBatchIds(new Set())}
        selectReviewNeeded={() => {
          const reviewNeeded = slides.filter((s) => s.needsReview).map((s) => s.id);
          setSelectedBatchIds(new Set(reviewNeeded));
        }}
        reDetectSelected={() => {
          setBatchRedetectedCount((c) => c + selectedBatchIds.size);
          setSlides((current) =>
            current.map((s) => (selectedBatchIds.has(s.id) ? readySlide(s) : s))
          );
        }}
        applyQuadToSelected={() => {
          const activeSlide = slides.find((s) => s.id === selectedId);
          if (!activeSlide?.quad) return;
          const activeQuad = activeSlide.quad;
          setSlides((current) =>
            current.map((s) =>
              selectedBatchIds.has(s.id) && s.id !== selectedId
                ? ({
                    ...s,
                    status: "ready",
                    quad: activeQuad,
                    method: "manual",
                    confidence: 1,
                    needsReview: false,
                    reviewReasons: [],
                    error: undefined,
                  } as SlideItem)
                : s
            )
          );
        }}
        onLoadSample={onLoadSample ?? (() => setSlides([readySlide(queuedSlide(new File(["sample"], "sample.jpg", { type: "image/jpeg" })))]))}
      />
      <output data-testid="workflow-status">
        {manualImported
          ? "manual-imported"
          : manualExported
            ? "manual-exported"
            : exportedJpg
              ? "exported-jpg"
              : exported
                ? "exported"
                : hasRun
                  ? "straightened"
                  : "waiting"}
      </output>
      <output data-testid="detection-cancelled">
        {detectionCancelled ? "cancelled" : "not-cancelled"}
      </output>
      <output data-testid="batch-selected-count">
        {selectedBatchIds.size}
      </output>
      <output data-testid="batch-redetected-count">
        {batchRedetectedCount}
      </output>
      <output data-testid="retry-status">
        {retriedAction ?? "idle"}
      </output>
      <button type="button" data-testid="mark-stale" onClick={() => setIsStale(true)}>
        Mark Stale
      </button>
      <button type="button" data-testid="toggle-busy" onClick={() => setBusy((b) => !b)}>
        Toggle Busy
      </button>
    </>
  );
}
