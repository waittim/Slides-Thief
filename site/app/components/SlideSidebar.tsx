import React, { useEffect, useRef, useState } from "react";
import type { LocaleCopy, ReviewUiCopy } from "../i18n";
import { slideBadgeTitle } from "../i18n";
import { displayFileName, formatBytes } from "../lib/slide-utils";
import type { ExportArtifact, SlideItem } from "../lib/types";
import { ExportArtifactCard } from "./ExportArtifactCard";
import { Button, CountBadge, Icon, StatusDot, type StatusDotProps } from "./ui";

interface SlideSidebarProps {
  busy: boolean;
  exporting?: boolean;
  cancelExport?: () => void;
  detecting?: boolean;
  cancelDetection?: () => void;
  progress?: { current: number; total: number } | null;
  slides: SlideItem[];
  readySlides: SlideItem[];
  runAuto: () => void;
  exportPdf: () => void;
  exportJpg: () => void;
  exportArtifacts?: { pdf?: ExportArtifact; jpg?: ExportArtifact };
  importManualQuads: (file: File) => void | Promise<void>;
  exportManualQuads: () => void;
  text: LocaleCopy;
  reviewText: ReviewUiCopy;
  statusTone: StatusDotProps["status"];
  statusText: string;
  errorMessage?: string;
  errorDetails?: string;
  onDismissError?: () => void;
  onRetryError?: () => void;
  exportUrl?: string | null;
  exportName?: string;
  isIOS: boolean;
  clearAllSlides: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  manualInputRef: React.RefObject<HTMLInputElement | null>;
  loadFiles: (files: FileList | File[]) => void;
  dragActive: boolean;
  setDragActive?: (active: boolean) => void;
  isMobile: boolean;
  selectedId: string | null;
  hasRun: boolean;
  selectAt: (index: number) => void;
  slideStatusText: (slide: SlideItem) => string;
  deleteSlide: (id: string) => void;
  deletedNotice?: { id: string; name: string } | null;
  onUndo?: () => void;
  moveSlide?: (fromIndex: number, toIndex: number) => void;
  moveSlideUp?: (id: string) => void;
  moveSlideDown?: (id: string) => void;
  selectedBatchIds?: Set<string>;
  toggleBatchSelect?: (id: string) => void;
  selectAllBatch?: () => void;
  clearBatchSelection?: () => void;
  selectReviewNeeded?: () => void;
  reDetectSelected?: () => void;
  applyQuadToSelected?: () => void;
}

export function SlideSidebar({
  busy,
  exporting,
  cancelExport,
  detecting,
  cancelDetection,
  progress,
  slides,
  readySlides,
  runAuto,
  exportPdf,
  exportJpg,
  exportArtifacts,
  importManualQuads,
  exportManualQuads,
  text,
  reviewText,
  statusTone,
  statusText,
  errorMessage,
  errorDetails,
  onDismissError,
  onRetryError,
  exportUrl,
  exportName,
  isIOS,
  clearAllSlides,
  inputRef,
  manualInputRef,
  loadFiles,
  dragActive,
  isMobile,
  selectedId,
  hasRun,
  selectAt,
  slideStatusText,
  deleteSlide,
  deletedNotice,
  onUndo,
  moveSlide,
  moveSlideUp,
  moveSlideDown,
  selectedBatchIds,
  toggleBatchSelect,
  selectAllBatch,
  clearBatchSelection,
  selectReviewNeeded,
  reDetectSelected,
  applyQuadToSelected,
}: SlideSidebarProps) {
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "above" | "below" } | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [copiedError, setCopiedError] = useState(false);

  useEffect(() => {
    setShowErrorDetails(false);
    setCopiedError(false);
  }, [errorMessage]);

  const handleCopyError = React.useCallback(async () => {
    if (!errorMessage) return;
    const fullText =
      errorDetails && errorDetails !== errorMessage
        ? `${errorMessage}\n\n${errorDetails}`
        : errorMessage;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = fullText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedError(true);
      window.setTimeout(() => setCopiedError(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }, [errorMessage, errorDetails]);

  const handleSlideDragStart = (event: React.DragEvent<HTMLLIElement>, index: number) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    dragSourceIndexRef.current = index;
    setDraggedSlideIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-slide-index", String(index));
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleSlideDragOver = (event: React.DragEvent<HTMLLIElement>, index: number) => {
    if (dragSourceIndexRef.current === null && !event.dataTransfer.types.includes("application/x-slide-index")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: "above" | "below" = event.clientY < midY ? "above" : "below";

    setDropTarget((prev) => {
      if (prev?.index === index && prev?.position === position) return prev;
      return { index, position };
    });
  };

  const handleSlideDragLeave = (event: React.DragEvent<HTMLLIElement>, index: number) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTarget((prev) => (prev?.index === index ? null : prev));
    }
  };

  const handleSlideDrop = (event: React.DragEvent<HTMLLIElement>, targetIndex: number) => {
    if (dragSourceIndexRef.current === null && !event.dataTransfer.types.includes("application/x-slide-index")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const rawSource = event.dataTransfer.getData("application/x-slide-index") || event.dataTransfer.getData("text/plain");
    const sourceIndex = dragSourceIndexRef.current ?? parseInt(rawSource, 10);
    dragSourceIndexRef.current = null;
    setDraggedSlideIndex(null);
    setDropTarget(null);

    if (isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= slides.length) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isAbove = event.clientY < midY;

    let destinationIndex: number;
    if (sourceIndex < targetIndex) {
      destinationIndex = isAbove ? targetIndex - 1 : targetIndex;
    } else if (sourceIndex > targetIndex) {
      destinationIndex = isAbove ? targetIndex : targetIndex + 1;
    } else {
      return;
    }

    if (destinationIndex !== sourceIndex && moveSlide) {
      moveSlide(sourceIndex, destinationIndex);
    }
  };

  const handleSlideDragEnd = () => {
    dragSourceIndexRef.current = null;
    setDraggedSlideIndex(null);
    setDropTarget(null);
  };

  const pdfArtifact = exportArtifacts?.pdf;
  const pdfUrl = pdfArtifact?.url ?? exportUrl ?? null;
  const pdfFilename = pdfArtifact?.filename ?? exportName ?? "presentation.pdf";
  const jpgArtifact = exportArtifacts?.jpg;
  const isPdfStale = Boolean(pdfArtifact?.isStale);
  const isJpgStale = Boolean(jpgArtifact?.isStale);
  const hasStaleExport = (Boolean(pdfUrl) && isPdfStale) || (Boolean(jpgArtifact) && isJpgStale);
  const hasPdfExport = Boolean(pdfUrl);
  const mainButtonLabel = hasPdfExport ? text.regeneratePdf : text.generatePdf;
  const autoAction = (
    <Button
      key="auto"
      variant={slides.length > 0 && readySlides.length === 0 ? "accent" : "secondary"}
      className="runAutoButton"
      disabled={busy || !slides.length}
      onClick={runAuto}
    >
      {text.runAuto}
    </Button>
  );
  const pdfAction = (
    <Button
      key="pdf"
      variant={readySlides.length > 0 ? "accent" : "secondary"}
      className="exportPdfButton"
      disabled={busy || !readySlides.length}
      title={`${mainButtonLabel} (⌘↵ / Ctrl+Enter)`}
      onClick={exportPdf}
    >
      {mainButtonLabel}
    </Button>
  );
  const jpgAction = (
    <Button
      key="jpg"
      variant="secondary"
      className="exportJpgButton"
      disabled={busy || !readySlides.length}
      title={text.exportJpgDescription ? `${text.exportJpg} (${text.exportJpgDescription})` : text.exportJpg}
      onClick={exportJpg}
    >
      {text.exportJpg}
    </Button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebarActions">
        {autoAction}
        {pdfAction}
        {jpgAction}
      </div>
      <div className="sidebarRunMeta">
        {errorMessage ? (
          <div className="sidebarErrorBanner">
            <div className="sidebarErrorBannerHeader">
              <div className="sidebarErrorIcon" aria-hidden="true">
                <Icon name="exclamationmark.circle" size={15} />
              </div>
              <p className="sidebarErrorMessage" role="alert" title={errorMessage}>
                {errorMessage}
              </p>
              {onDismissError ? (
                <button
                  type="button"
                  className="sidebarErrorDismiss"
                  title={text.dismissError}
                  aria-label={text.dismissError}
                  onClick={onDismissError}
                >
                  <Icon name="xmark" size={13} strokeWidth={2.2} />
                </button>
              ) : null}
            </div>
            <div className="sidebarErrorActions">
              {onRetryError ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="sidebarErrorRetryButton"
                  disabled={busy}
                  onClick={onRetryError}
                >
                  {text.retry}
                </Button>
              ) : null}
              {errorDetails && errorDetails !== errorMessage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="sidebarErrorDetailsButton"
                  onClick={() => setShowErrorDetails((prev) => !prev)}
                >
                  {showErrorDetails ? text.collapse : text.errorDetails}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="sidebarErrorCopyButton"
                onClick={handleCopyError}
              >
                {copiedError ? text.errorCopied : text.copyError}
              </Button>
            </div>
            {showErrorDetails && errorDetails ? (
              <div className="sidebarErrorDetails">
                <pre>{errorDetails}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="sidebarStatus" role="status" aria-live="polite">
          {deletedNotice ? (
            <>
              <StatusDot status="default" />
              <span className="statusLine" title={text.slideDeleted(deletedNotice.name)}>
                {text.slideDeleted(deletedNotice.name)}
              </span>
              {onUndo ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="statusUndoButton"
                  disabled={busy}
                  onClick={onUndo}
                >
                  {text.undo}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <StatusDot status={statusTone} />
              <span className="statusLine" title={statusText}>{statusText}</span>
              {exporting && cancelExport ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cancelExportButton"
                  title={text.cancelExport}
                  onClick={cancelExport}
                >
                  {text.cancelExport}
                </Button>
              ) : detecting && cancelDetection ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cancelExportButton cancelDetectionButton"
                  title={text.cancelDetection}
                  onClick={cancelDetection}
                >
                  {text.cancelDetection}
                </Button>
              ) : null}
            </>
          )}
        </div>
        {progress && progress.total > 0 ? (
          <div
            className="sidebarProgressBar"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={detecting ? text.stretching : text.generating}
          >
            <div
              className="sidebarProgressFill"
              style={{
                width: `${Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)))}%`,
              }}
            />
          </div>
        ) : null}
        {(pdfUrl || jpgArtifact) ? (
          <div className="links sidebarLinks sidebarArtifacts">
            {pdfUrl ? (
              <ExportArtifactCard
                format="pdf"
                url={pdfUrl}
                filename={pdfFilename}
                byteLength={pdfArtifact?.byteLength}
                isStale={isPdfStale}
                isIOS={isIOS}
                text={text}
              />
            ) : null}
            {jpgArtifact ? (
              <ExportArtifactCard
                format="jpg"
                url={jpgArtifact.url}
                filename={jpgArtifact.filename}
                byteLength={jpgArtifact.byteLength}
                isStale={isJpgStale}
                isIOS={isIOS}
                multiSlideJpg={readySlides.length > 1}
                text={text}
              />
            ) : null}
            {hasStaleExport ? (
              <p className="sidebarStaleNotice" role="note">
                {text.staleExportHint}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {slides.length > 0 ? (
        <details className="manualQuadsDisclosure">
          <summary className="manualQuadsSummary">
            <span>{text.cornerData}</span>
            <Icon name="chevron.down" size={14} aria-hidden="true" />
          </summary>
          <div className="manualQuadsActions">
            <input
              ref={manualInputRef}
              className="fileInput"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importManualQuads(file);
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !slides.length}
              onClick={() => manualInputRef.current?.click()}
            >
              {text.importCorners}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !readySlides.length}
              onClick={exportManualQuads}
            >
              {text.exportCorners}
            </Button>
          </div>
        </details>
      ) : null}
      <div className="sectionHead">
        <h2>{text.images}</h2>
        <CountBadge count={slides.length} />
        {selectReviewNeeded && slides.some((s) => s.status === "ready" && s.needsReview) && (!selectedBatchIds || selectedBatchIds.size === 0) ? (
          <Button
            variant="ghost"
            size="sm"
            className="selectReviewNeededAction"
            disabled={busy}
            title={text.selectReviewNeeded}
            onClick={selectReviewNeeded}
          >
            <Icon name="exclamationmark.circle" size={12} />
            <span>{text.selectReviewNeeded}</span>
          </Button>
        ) : null}
        {slides.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="clearAction"
            disabled={busy}
            title={text.clearAll}
            onClick={clearAllSlides}
          >
            {text.clearAll}
          </Button>
        )}
      </div>
      <div className="sidebarFilePicker">
        <input
          ref={inputRef}
          className="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
          multiple
          disabled={busy}
          onChange={(event) => {
            const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
            event.currentTarget.value = "";
            if (files.length) void loadFiles(files);
          }}
        />
        <button
          type="button"
          className={`dropzone ${dragActive ? "active" : ""}`}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <span className="dropzoneContent">
            <strong>{slides.length > 0 ? text.addMorePhotos : isMobile ? text.uploadTitle : text.dropTitle}</strong>
            {!isMobile && <span>{text.dropSubtitle}</span>}
          </span>
        </button>
        {selectedBatchIds && selectedBatchIds.size > 0 ? (
          <div className="batchActionBar" role="toolbar" aria-label={text.selectedCount(selectedBatchIds.size)}>
            <div className="batchActionInfo">
              <span className="batchActionCount">{text.selectedCount(selectedBatchIds.size)}</span>
              <div className="batchActionControls">
                {selectAllBatch ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="batchSelectAllButton"
                    disabled={busy}
                    onClick={selectAllBatch}
                  >
                    {selectedBatchIds.size === slides.length ? text.deselectAll : text.selectAll}
                  </Button>
                ) : null}
                {clearBatchSelection ? (
                  <Button
                    variant="icon"
                    size="sm"
                    className="batchClearButton"
                    aria-label={text.clearSelection}
                    title={text.clearSelection}
                    onClick={clearBatchSelection}
                  >
                    <Icon name="xmark" size={10} strokeWidth={2.4} />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="batchActionButtons">
              {reDetectSelected ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="batchRedetectButton"
                  disabled={busy}
                  onClick={reDetectSelected}
                >
                  {text.reDetectSelected}
                </Button>
              ) : null}
              {applyQuadToSelected && readySlides.some((s) => s.id === selectedId && s.quad) ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="batchApplyQuadButton"
                  disabled={busy}
                  onClick={applyQuadToSelected}
                >
                  {text.applyToSelected}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <ul className="files">
          {slides.map((slide, index) => {
            const active = selectedId === slide.id || (!selectedId && index === 0);
            const isBatchSelected = Boolean(selectedBatchIds?.has(slide.id));
            const isDragging = draggedSlideIndex === index;
            const isDropAbove = dropTarget?.index === index && dropTarget.position === "above";
            const isDropBelow = dropTarget?.index === index && dropTarget.position === "below";
            const className = [
              hasRun ? "slideRow" : "fileRow",
              active ? "active" : "",
              isBatchSelected ? "selectedBatchRow" : "",
              selectedBatchIds && selectedBatchIds.size > 0 ? "hasBatchSelection" : "",
              isDragging ? "dragging" : "",
              isDropAbove ? "dropTargetAbove" : "",
              isDropBelow ? "dropTargetBelow" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li
                key={slide.id}
                className={className}
                draggable={!busy}
                onDragStart={(event) => handleSlideDragStart(event, index)}
                onDragOver={(event) => handleSlideDragOver(event, index)}
                onDragLeave={(event) => handleSlideDragLeave(event, index)}
                onDrop={(event) => handleSlideDrop(event, index)}
                onDragEnd={handleSlideDragEnd}
              >
                {toggleBatchSelect && selectedBatchIds ? (
                  <label className="slideCheckboxLabel" title={text.selectSlide(slide.name)}>
                    <input
                      type="checkbox"
                      className="slideCheckbox"
                      checked={isBatchSelected}
                      disabled={busy}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleBatchSelect(slide.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="srOnly">{text.selectSlide(slide.name)}</span>
                  </label>
                ) : null}
                <Button
                  variant="ghost"
                  size="touch"
                  className="slideSelectButton"
                  aria-current={active ? "true" : undefined}
                  title={slide.name}
                  onClick={() => selectAt(index)}
                >
                  <span className="idx" title={text.dragToReorder}>{String(index + 1).padStart(2, "0")}</span>
                  {slide.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */
                    <img
                      className="thumb"
                      src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="thumb thumbPlaceholder" aria-hidden="true">
                      HEIC
                    </span>
                  )}
                  <span className="name" title={slide.name} aria-label={slide.name}>
                    {displayFileName(slide.name, isMobile ? 18 : 26)}
                  </span>
                  {hasRun ? (() => {
                    const isFallback = slide.needsReview && slide.reviewReasons.includes("fallback_used");
                    const badgeTitle = slideBadgeTitle(slide, text, reviewText);
                    const isProcessing = slide.status === "detecting";
                    const isQueued = slide.status === "queued";
                    return (
                      <span
                        className={[
                          "badge",
                          isFallback ? "fallback" : slide.needsReview ? "low" : "",
                          slide.status === "error" ? "error" : "",
                          isProcessing ? "processing" : "",
                          isQueued ? "queued" : "",
                        ].filter(Boolean).join(" ")}
                        title={badgeTitle || undefined}
                      >
                        {slide.status === "ready"
                          ? slide.needsReview
                            ? isFallback
                              ? `! ${reviewText.fallbackFrame}`
                              : `! ${reviewText.reviewSuggested}`
                            : slide.method === "manual"
                              ? `✓ ${text.manualAdjusted}`
                              : `✓ ${reviewText.automaticRecognized}`
                          : slide.status === "error"
                            ? `× ${text.failed}`
                            : slideStatusText(slide)}
                      </span>
                    );
                  })() : (
                    <span className="sub">
                      {slide.status === "converting"
                        ? text.converting
                        : slide.status === "error"
                          ? text.failed
                          : formatBytes(slide.file.size)}
                    </span>
                  )}
                </Button>
                <div className="slideRowActions">
                  <div className="slideMoveButtonGroup">
                    <Button
                      variant="icon"
                      size="sm"
                      className="slideMoveButton slideMoveUpButton"
                      type="button"
                      disabled={busy || index === 0}
                      title={`${text.moveSlideUpHint} (Alt+↑)`}
                      aria-label={`${text.moveSlideUpHint}: ${slide.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveSlideUp?.(slide.id);
                      }}
                    >
                      <Icon name="chevron.up" size={10} />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      className="slideMoveButton slideMoveDownButton"
                      type="button"
                      disabled={busy || index === slides.length - 1}
                      title={`${text.moveSlideDownHint} (Alt+↓)`}
                      aria-label={`${text.moveSlideDownHint}: ${slide.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveSlideDown?.(slide.id);
                      }}
                    >
                      <Icon name="chevron.down" size={10} />
                    </Button>
                  </div>
                  <Button
                    variant="icon"
                    size="sm"
                    className="slideDeleteButton"
                    type="button"
                    disabled={busy}
                    title={`${text.deleteSlideHint} (Delete / Backspace)`}
                    aria-label={`${text.deleteSlideHint}: ${slide.name}`}
                    onClick={() => deleteSlide(slide.id)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
