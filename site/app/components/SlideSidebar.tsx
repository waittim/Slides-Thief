import React, { useEffect, useRef, useState } from "react";
import type { LocaleCopy, ReviewUiCopy } from "../i18n";
import { displayFileName, formatBytes } from "../lib/slide-utils";
import type { ExportArtifact, SlideItem } from "../lib/types";
import { Button, CountBadge, StatusDot, type StatusDotProps } from "./ui";

interface SlideSidebarProps {
  busy: boolean;
  exporting?: boolean;
  cancelExport?: () => void;
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
  setDragActive: (active: boolean) => void;
  isMobile: boolean;
  selectedId: string | null;
  hasRun: boolean;
  selectAt: (index: number) => void;
  slideStatusText: (slide: SlideItem) => string;
  deleteSlide: (id: string) => void;
}

export function SlideSidebar({
  busy,
  exporting,
  cancelExport,
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
  setDragActive,
  isMobile,
  selectedId,
  hasRun,
  selectAt,
  slideStatusText,
  deleteSlide,
}: SlideSidebarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const splitButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (splitButtonRef.current && !splitButtonRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (busy || !readySlides.length) {
      setExportMenuOpen(false);
    }
  }, [busy, readySlides.length]);

  const pdfUrl = exportArtifacts?.pdf?.url ?? exportUrl ?? null;
  const pdfFilename = exportArtifacts?.pdf?.filename ?? exportName ?? "presentation.pdf";
  const jpgArtifact = exportArtifacts?.jpg;

  return (
    <aside className="sidebar">
      <div className="sidebarActions">
        <Button variant="primary" disabled={busy || !slides.length} onClick={runAuto}>
          {text.runAuto}
        </Button>
        <div className="splitButton" ref={splitButtonRef}>
          <Button
            variant="accent"
            className="splitButtonMain"
            disabled={busy || !readySlides.length}
            title={`${text.generatePdf} (⌘↵ / Ctrl+Enter)`}
            onClick={() => {
              setExportMenuOpen(false);
              exportPdf();
            }}
          >
            {text.generatePdf}
          </Button>
          <button
            type="button"
            className="splitButtonToggle uiButton uiButton--accent"
            disabled={busy || !readySlides.length}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-label={text.exportOptions}
            onClick={() => setExportMenuOpen((open) => !open)}
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
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {exportMenuOpen ? (
            <div className="exportMenu" role="menu">
              <div className="exportMenuHeading">{text.exportOptions}</div>
              <button
                type="button"
                role="menuitem"
                className="exportMenuItem"
                onClick={() => {
                  setExportMenuOpen(false);
                  exportJpg();
                }}
              >
                <svg
                  className="exportMenuItemIcon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span className="exportMenuItemText">
                  <span className="exportMenuItemTitle">{text.exportJpg}</span>
                  <span className="exportMenuItemDesc">{text.exportJpgDescription}</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
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
          ) : null}
        </div>
        {(pdfUrl || jpgArtifact) ? (
          <div className="links sidebarLinks">
            {pdfUrl ? (
              <a
                href={pdfUrl}
                download={isIOS ? undefined : pdfFilename}
                target="_blank"
                rel="noopener noreferrer"
              >
                {text.downloadPdf}
              </a>
            ) : null}
            {jpgArtifact ? (
              <a
                href={jpgArtifact.url}
                download={isIOS ? undefined : jpgArtifact.filename}
                target="_blank"
                rel="noopener noreferrer"
              >
                {readySlides.length === 1 ? text.downloadJpg : text.downloadJpgZip}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="sectionHead">
        <h2>{text.images}</h2>
        <CountBadge count={slides.length} />
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
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void loadFiles(event.dataTransfer.files);
          }}
        >
          <span className="dropzoneContent">
            <strong>{isMobile ? text.uploadTitle : text.dropTitle}</strong>
            {!isMobile && <span>{text.dropSubtitle}</span>}
          </span>
        </button>
        <ul className="files">
          {slides.map((slide, index) => {
            const active = selectedId === slide.id || (!selectedId && index === 0);
            const className = `${hasRun ? "slideRow" : "fileRow"} ${active ? "active" : ""}`;
            return (
              <li
                key={slide.id}
                className={className}
              >
                <Button
                  variant="ghost"
                  size="touch"
                  className="slideSelectButton"
                  aria-pressed={active}
                  onClick={() => selectAt(index)}
                >
                  <span className="idx">{String(index + 1).padStart(2, "0")}</span>
                  {slide.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */
                    <img
                      className="thumb"
                      src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url}
                      alt=""
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
                  {hasRun ? (
                    <span className={`badge ${slide.needsReview ? "low" : ""} ${slide.status === "error" ? "error" : ""}`}>
                      {slide.status === "ready"
                        ? slide.needsReview
                          ? `! ${reviewText.reviewSuggested}`
                          : slide.method === "manual"
                            ? `✓ ${text.manualAdjusted}`
                            : `✓ ${reviewText.automaticRecognized}`
                        : slide.status === "error"
                          ? `× ${text.failed}`
                          : slideStatusText(slide)}
                    </span>
                  ) : (
                    <span className="sub">
                      {slide.status === "converting"
                        ? text.converting
                        : slide.status === "error"
                          ? text.failed
                          : formatBytes(slide.file.size)}
                    </span>
                  )}
                </Button>
                <Button
                  variant="danger"
                  size="touch"
                  className="slideDeleteButton iconOnlyButton"
                  type="button"
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
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
