import React, { useEffect, useRef, useState } from "react";
import type { LocaleCopy, ReviewUiCopy } from "../i18n";
import { slideBadgeTitle } from "../i18n";
import { displayFileName, formatBytes } from "../lib/slide-utils";
import type { ExportArtifact, SlideItem } from "../lib/types";
import { Button, CountBadge, StatusDot, type StatusDotProps } from "./ui";

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

  return (
    <aside className="sidebar">
      <div className="sidebarActions">
        <Button
          variant="primary"
          className="runAutoButton"
          disabled={busy || !slides.length}
          onClick={runAuto}
        >
          {text.runAuto}
        </Button>
        <Button
          variant="accent"
          className="exportPdfButton"
          disabled={busy || !readySlides.length}
          title={`${mainButtonLabel} (⌘↵ / Ctrl+Enter)`}
          onClick={exportPdf}
        >
          {mainButtonLabel}
        </Button>
        <Button
          variant="accent"
          className="exportJpgButton"
          disabled={busy || !readySlides.length}
          title={text.exportJpgDescription ? `${text.exportJpg} (${text.exportJpgDescription})` : text.exportJpg}
          onClick={exportJpg}
        >
          {text.exportJpg}
        </Button>
      </div>
      {slides.length > 0 ? (
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
      ) : null}
      <div className="sidebarRunMeta">
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
              <span className="statusLine">{statusText}</span>
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
              <a
                href={pdfUrl}
                download={isIOS ? undefined : pdfFilename}
                target="_blank"
                rel="noopener noreferrer"
                className={`artifactCard ${isPdfStale ? "artifactCard--stale sidebarLink--stale" : ""}`}
                title={isPdfStale ? text.staleExportHint : `${text.downloadPdf}: ${pdfFilename}`}
              >
                <div className="artifactCardIcon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="artifactCardInfo">
                  <div className="artifactCardPrimary">
                    <span className="artifactCardTitle">{text.downloadPdf}</span>
                    {isPdfStale ? (
                      <span className="sidebarStaleBadge" aria-hidden="true">
                        {text.staleBadge}
                      </span>
                    ) : null}
                  </div>
                  <div className="artifactCardMeta">
                    <span className="artifactCardName" title={pdfFilename}>
                      {pdfFilename}
                    </span>
                    {pdfArtifact?.byteLength ? (
                      <span className="artifactCardSize">
                        {formatBytes(pdfArtifact.byteLength)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </a>
            ) : null}
            {jpgArtifact ? (
              <a
                href={jpgArtifact.url}
                download={isIOS ? undefined : jpgArtifact.filename}
                target="_blank"
                rel="noopener noreferrer"
                className={`artifactCard ${isJpgStale ? "artifactCard--stale sidebarLink--stale" : ""}`}
                title={isJpgStale ? text.staleExportHint : `${readySlides.length === 1 ? text.downloadJpg : text.downloadJpgZip}: ${jpgArtifact.filename}`}
              >
                <div className="artifactCardIcon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="artifactCardInfo">
                  <div className="artifactCardPrimary">
                    <span className="artifactCardTitle">
                      {readySlides.length === 1 ? text.downloadJpg : text.downloadJpgZip}
                    </span>
                    {isJpgStale ? (
                      <span className="sidebarStaleBadge" aria-hidden="true">
                        {text.staleBadge}
                      </span>
                    ) : null}
                  </div>
                  <div className="artifactCardMeta">
                    <span className="artifactCardName" title={jpgArtifact.filename}>
                      {jpgArtifact.filename}
                    </span>
                    {jpgArtifact.byteLength ? (
                      <span className="artifactCardSize">
                        {formatBytes(jpgArtifact.byteLength)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </a>
            ) : null}
            {hasStaleExport ? (
              <p className="sidebarStaleNotice" role="note">
                {text.staleExportHint}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
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
            ! {text.selectReviewNeeded}
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
                  ×
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
                  aria-pressed={active}
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
                  <span className="name" title={slide.name}>
                    {displayFileName(slide.name, isMobile)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="slideMoveButton slideMoveUpButton iconOnlyButton"
                    type="button"
                    disabled={busy || index === 0}
                    title={text.moveSlideUpHint}
                    aria-label={`${text.moveSlideUpHint}: ${slide.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveSlideUp?.(slide.id);
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="slideMoveButton slideMoveDownButton iconOnlyButton"
                    type="button"
                    disabled={busy || index === slides.length - 1}
                    title={text.moveSlideDownHint}
                    aria-label={`${text.moveSlideDownHint}: ${slide.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveSlideDown?.(slide.id);
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </Button>
                  <Button
                    variant="danger"
                    size="touch"
                    className="slideDeleteButton iconOnlyButton"
                    type="button"
                    disabled={busy}
                    title={text.deleteSlideHint}
                    aria-label={`${text.deleteSlideHint}: ${slide.name}`}
                    onClick={() => deleteSlide(slide.id)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
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
