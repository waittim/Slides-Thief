import React from "react";
import { displayFileName, formatBytes } from "../lib/slide-utils";
import type { SlideItem } from "../lib/types";

interface SlideSidebarProps {
  busy: boolean;
  slides: SlideItem[];
  readySlides: SlideItem[];
  runAuto: () => void;
  exportPdf: () => void;
  text: Record<string, any>;
  reviewText: Record<string, any>;
  statusTone: string;
  statusText: string;
  exportUrl: string | null;
  exportName: string;
  isIOS: boolean;
  clearAllSlides: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
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
  slides,
  readySlides,
  runAuto,
  exportPdf,
  text,
  reviewText,
  statusTone,
  statusText,
  exportUrl,
  exportName,
  isIOS,
  clearAllSlides,
  inputRef,
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
  return (
    <aside className="sidebar">
      <div className="sidebarActions">
        <button type="button" className="primary" disabled={busy || !slides.length} onClick={runAuto}>
          {text.runAuto}
        </button>
        <button type="button" className="green" disabled={busy || !readySlides.length} title={`${text.generatePdf} (⌘↵ / Ctrl+Enter)`} onClick={exportPdf}>
          {text.generatePdf}
        </button>
      </div>
      <div className="sidebarRunMeta">
        <div className="sidebarStatus" role="status" aria-live="polite">
          <span className={`statusDot ${statusTone}`} aria-hidden="true" />
          <span className="statusLine">{statusText}</span>
        </div>
        {exportUrl ? (
          <div className="links sidebarLinks">
            <a
              href={exportUrl}
              download={isIOS ? undefined : exportName}
              target="_blank"
              rel="noopener noreferrer"
            >
              {text.downloadPdf}
            </a>
          </div>
        ) : null}
      </div>
      <div className="sectionHead">
        <h2>{text.images}</h2>
        <span className="count">{slides.length}</span>
        {slides.length > 0 && (
          <button
            type="button"
            className="clearAllBtn"
            disabled={busy}
            title={text.clearAll}
            onClick={clearAllSlides}
          >
            {text.clearAll}
          </button>
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
        <div className="files">
          {slides.map((slide, index) => {
            const active = selectedId === slide.id || (!selectedId && index === 0);
            const className = `${hasRun ? "slideRow" : "fileRow"} ${active ? "active" : ""}`;
            return (
              <button
                type="button"
                key={slide.id}
                className={className}
                aria-pressed={active}
                onClick={() => selectAt(index)}
              >
                <div className="idx">{String(index + 1).padStart(2, "0")}</div>
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
                  <div className="thumb thumbPlaceholder" aria-hidden="true">
                    HEIC
                  </div>
                )}
                <div className="name" title={slide.name}>
                  {displayFileName(slide.name, isMobile)}
                </div>
                {hasRun ? (
                  <div className={`badge ${slide.needsReview ? "low" : ""} ${slide.status === "error" ? "error" : ""}`}>
                    {slide.status === "ready"
                      ? slide.needsReview
                        ? `! ${reviewText.reviewSuggested}`
                        : slide.method === "manual"
                          ? `✓ ${text.manualAdjusted}`
                          : `✓ ${reviewText.automaticRecognized}`
                      : slide.status === "error"
                        ? `× ${text.failed}`
                        : slideStatusText(slide)}
                  </div>
                ) : (
                  <div className="sub">
                    {slide.status === "converting"
                      ? text.converting
                      : slide.status === "error"
                        ? text.failed
                        : formatBytes(slide.file.size)}
                  </div>
                )}
                <button
                  type="button"
                  className="slideDeleteBtn"
                  title={text.deleteSlideHint}
                  aria-label={`${text.deleteSlideHint}: ${slide.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSlide(slide.id);
                  }}
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
                </button>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
