import React, { useEffect, useRef, useState } from "react";
import type { LocaleCopy, ReviewUiCopy } from "../i18n";
import { canRestoreAutoDetection } from "../lib/slide-transitions";
import { displayFileName } from "../lib/slide-utils";
import type { HandlePosition, SlideItem } from "../lib/types";
import { calculateLoupePosition } from "../lib/viewport-math";
import { Button } from "./ui";
import { ReviewModeBanner, type ReviewModeBannerProps } from "./ReviewModeBanner";

export interface CanvasQuadEditorProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  loupeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  loupeOverlayRef?: React.RefObject<HTMLDivElement | null>;
  updateLoupePosition?: (handleIndex: number | null, handlePos?: HandlePosition) => void;
  handleRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  slides: SlideItem[];
  selectedSlide: SlideItem | null;
  selectedIndex: number;
  isMobile: boolean;
  text: LocaleCopy;
  displayZoom: number;
  previewErrorSlideId: string | null;
  handlePositions: HandlePosition[];
  dragHandle: number | null;
  selectAt: (index: number) => void;
  zoomOut: () => void;
  zoomIn: () => void;
  setZoomMode: (mode: "fit" | "manual") => void;
  resetSelected?: () => void;
  restoreAutoDetection?: () => void;
  onHandlePointerDown: (index: number, event: React.PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onHandleKeyDown: (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  handleUndo?: () => void;
  handleRedo?: () => void;
  applyQuadToFollowing?: () => void;
  applyQuadToAll?: () => void;
  applyQuadToSelected?: () => void;
  selectedBatchCount?: number;
  reDetectCurrent?: () => void;
  busy?: boolean;
  isReviewMode?: boolean;
  reviewBannerProps?: ReviewModeBannerProps | null;
  isSpacePressed?: boolean;
  isPanning?: boolean;
}

export function CanvasQuadEditor({
  stageRef,
  canvasRef,
  loupeCanvasRef,
  loupeOverlayRef,
  updateLoupePosition,
  handleRefs,
  slides,
  selectedSlide,
  selectedIndex,
  isMobile,
  text,
  displayZoom,
  previewErrorSlideId,
  handlePositions,
  dragHandle,
  selectAt,
  zoomOut,
  zoomIn,
  setZoomMode,
  resetSelected,
  restoreAutoDetection,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onHandleKeyDown,
  canUndo = false,
  canRedo = false,
  handleUndo,
  handleRedo,
  applyQuadToFollowing,
  applyQuadToAll,
  applyQuadToSelected,
  selectedBatchCount = 0,
  reDetectCurrent,
  busy = false,
  isReviewMode = false,
  reviewBannerProps = null,
  isSpacePressed = false,
  isPanning = false,
}: CanvasQuadEditorProps) {
  const [isQuadMenuOpen, setIsQuadMenuOpen] = useState(false);
  const [showFullNamePopover, setShowFullNamePopover] = useState(false);
  const quadMenuRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const localLoupeOverlayRef = useRef<HTMLDivElement | null>(null);
  const effectiveLoupeOverlayRef = loupeOverlayRef ?? localLoupeOverlayRef;

  useEffect(() => {
    setShowFullNamePopover(false);
  }, [selectedSlide?.id]);

  useEffect(() => {
    if (!showFullNamePopover) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (titleRef.current && !titleRef.current.contains(event.target as Node)) {
        setShowFullNamePopover(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFullNamePopover(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFullNamePopover]);

  useEffect(() => {
    if (!isQuadMenuOpen) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (quadMenuRef.current && !quadMenuRef.current.contains(event.target as Node)) {
        setIsQuadMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuadMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isQuadMenuOpen]);

  const handleRestore = restoreAutoDetection ?? resetSelected;
  const canRestore = Boolean(handleRestore && canRestoreAutoDetection(selectedSlide));

  const restoreTooltip = (() => {
    if (!selectedSlide) return text.noSlide;
    if (selectedSlide.status !== "ready") return text.waiting;
    if (!selectedSlide.autoDetection) return text.restoreAutoNoSnapshot;
    if (!canRestore) return text.restoreAutoUnchanged;
    return text.restoreAutoTitle;
  })();

  const isRedetectDisabled =
    !selectedSlide ||
    busy ||
    selectedSlide.status === "converting" ||
    selectedSlide.status === "detecting" ||
    !selectedSlide.url ||
    selectedSlide.error?.code === "conversion-failed";

  const redetectTooltip = (() => {
    if (!selectedSlide) return text.noSlide;
    if (busy) return text.reDetectBusy;
    if (selectedSlide.status === "converting") return text.reDetectConverting;
    if (selectedSlide.status === "detecting") return text.reDetectDetecting;
    if (!selectedSlide.url || selectedSlide.error?.code === "conversion-failed") {
      return text.reDetectUnavailable;
    }
    return text.reDetectSlideTitle;
  })();

  return (
    <section className={`workspace ${isReviewMode ? "inReviewMode" : ""}`}>
      {isReviewMode && reviewBannerProps ? (
        <ReviewModeBanner {...reviewBannerProps} />
      ) : null}
      <div className="reviewBar">
        <Button
          variant="icon"
          className="reviewPrevious"
          disabled={!slides.length || selectedIndex <= 0}
          title={`${text.prev} (K / PageUp)`}
          aria-label={text.prev}
          onClick={() => selectAt(selectedIndex - 1)}
        >
          ‹
        </Button>
        <Button
          variant="icon"
          className="reviewNext"
          disabled={!slides.length || selectedIndex < 0 || selectedIndex >= slides.length - 1}
          title={`${text.next} (J / PageDown)`}
          aria-label={text.next}
          onClick={() => selectAt(selectedIndex + 1)}
        >
          ›
        </Button>
        <div ref={titleRef} className="title" title={selectedSlide?.name}>
          {selectedSlide ? (
            <>
              <span className="reviewPageIndicator">
                {String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(2, "0")}
                {slides.length > 0 ? ` / ${String(slides.length).padStart(2, "0")}` : ""}
              </span>
              <span
                className="reviewFileName"
                title={selectedSlide.name}
                aria-label={selectedSlide.name}
                role="button"
                tabIndex={0}
                aria-expanded={showFullNamePopover}
                onClick={() => setShowFullNamePopover((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowFullNamePopover((prev) => !prev);
                  }
                }}
              >
                {displayFileName(selectedSlide.name, isMobile)}
              </span>
              {showFullNamePopover ? (
                <div
                  className="reviewFileNamePopover"
                  role="tooltip"
                  aria-label={selectedSlide.name}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="reviewFileNamePopoverText">{selectedSlide.name}</span>
                </div>
              ) : null}
            </>
          ) : (
            text.noSlide
          )}
        </div>
        <div className="historyControls">
          <Button
            variant="icon"
            className="reviewUndoButton"
            disabled={!canUndo || !handleUndo}
            title={`${text.undo} (⌘Z / Ctrl+Z)`}
            aria-label={text.undo}
            onClick={handleUndo}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
            </svg>
          </Button>
          <Button
            variant="icon"
            className="reviewRedoButton"
            disabled={!canRedo || !handleRedo}
            title={`${text.redo} (⇧⌘Z / Ctrl+Y)`}
            aria-label={text.redo}
            onClick={handleRedo}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
            </svg>
          </Button>
        </div>
        <div className="zoomControls">
          <Button variant="icon" disabled={!selectedSlide} title={text.zoomOut} aria-label={text.zoomOut} onClick={zoomOut}>
            −
          </Button>
          <span className="zoomValue">{Math.round(displayZoom * 100)}%</span>
          <Button variant="icon" disabled={!selectedSlide} title={text.zoomIn} aria-label={text.zoomIn} onClick={zoomIn}>
            +
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="reviewFitButton"
            disabled={!selectedSlide}
            title={text.fit}
            onClick={() => setZoomMode("fit")}
          >
            {text.fit}
          </Button>
        </div>
        {handleRestore ? (
          <Button
            variant="ghost"
            size="sm"
            className="reviewResetButton"
            disabled={!canRestore}
            title={restoreTooltip}
            aria-label={restoreTooltip}
            onClick={handleRestore}
          >
            {text.restoreAuto || text.resetSlide}
          </Button>
        ) : null}
        {reDetectCurrent ? (
          <Button
            variant="ghost"
            size="sm"
            className="reviewRedetectButton"
            disabled={isRedetectDisabled}
            title={redetectTooltip}
            aria-label={redetectTooltip}
            onClick={reDetectCurrent}
          >
            {text.reDetectSlide}
          </Button>
        ) : null}
        <div className="quadBatchMenu" ref={quadMenuRef}>
          <Button
            variant="secondary"
            size="sm"
            className="applyQuadToggle"
            disabled={
              !selectedSlide ||
              selectedSlide.status !== "ready" ||
              !selectedSlide.quad ||
              slides.length <= 1 ||
              busy
            }
            aria-haspopup="menu"
            aria-expanded={isQuadMenuOpen}
            title={text.applyCornersTitle}
            aria-label={text.applyCorners}
            onClick={() => setIsQuadMenuOpen((open) => !open)}
          >
            {text.applyCorners}
            <svg
              width="12"
              height="12"
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
          </Button>
          {isQuadMenuOpen ? (
            <div className="quadBatchDropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                className="quadBatchMenuItem"
                disabled={selectedIndex >= slides.length - 1}
                onClick={() => {
                  setIsQuadMenuOpen(false);
                  applyQuadToFollowing?.();
                }}
              >
                <span className="quadBatchMenuTitle">{text.applyToFollowing}</span>
                <span className="quadBatchMenuDesc">
                  {text.applyToFollowingDesc(Math.max(0, slides.length - 1 - selectedIndex))}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="quadBatchMenuItem"
                disabled={slides.length <= 1}
                onClick={() => {
                  setIsQuadMenuOpen(false);
                  applyQuadToAll?.();
                }}
              >
                <span className="quadBatchMenuTitle">{text.applyToAll}</span>
                <span className="quadBatchMenuDesc">{text.applyToAllDesc(Math.max(0, slides.length - 1))}</span>
              </button>
              {selectedBatchCount && selectedBatchCount > 0 ? (
                <button
                  type="button"
                  role="menuitem"
                  className="quadBatchMenuItem"
                  onClick={() => {
                    setIsQuadMenuOpen(false);
                    applyQuadToSelected?.();
                  }}
                >
                  <span className="quadBatchMenuTitle">{text.applyToSelected}</span>
                  <span className="quadBatchMenuDesc">{text.applyToSelectedDesc(selectedBatchCount)}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={`stageArea ${dragHandle !== null ? "isDraggingHandle" : ""} ${isPanning || isSpacePressed ? "isPanning" : ""}`}
      >
        <div className={`stage ${isSpacePressed ? "isSpacePressed" : ""} ${isPanning ? "isPanning" : ""}`} ref={stageRef}>
          <div className="canvasShell">
            {selectedSlide?.url && previewErrorSlideId !== selectedSlide.id ? (
              <div className="canvasWrap">
                <canvas ref={canvasRef} aria-label={text.adjustCorners}>
                  {text.adjustCorners}
                </canvas>
                <span id="cornerKeyboardHelp" className="srOnly">
                  {text.cornerKeyboardHelp}
                </span>
                {selectedSlide.quad && handlePositions.length === selectedSlide.quad.length
                  ? selectedSlide.quad.map(([x, y], index) => {
                      const position = handlePositions[index] ?? { left: 0, top: 0 };
                      return (
                        <button
                          type="button"
                          key={index}
                          ref={(node) => {
                            handleRefs.current[index] = node;
                          }}
                          className={`cornerHandle ${dragHandle === index ? "active" : ""}`}
                          style={{ left: position.left, top: position.top }}
                          aria-label={`${text.cornerHandle} ${index + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`}
                          aria-describedby="cornerKeyboardHelp"
                          title={text.adjustCorners}
                          onPointerDown={(event) => onHandlePointerDown(index, event)}
                          onPointerMove={onHandlePointerMove}
                          onPointerUp={onHandlePointerUp}
                          onPointerCancel={onHandlePointerUp}
                          onLostPointerCapture={onHandlePointerUp}
                          onKeyDown={(event) => onHandleKeyDown(index, event)}
                        />
                      );
                    })
                  : null}
                {dragHandle !== null && handlePositions[dragHandle] && (() => {
                  const stage = stageRef.current;
                  const canvas = canvasRef.current;
                  const stageRect = stage
                    ? {
                        left: stage.getBoundingClientRect().left + stage.clientLeft,
                        top: stage.getBoundingClientRect().top + stage.clientTop,
                        right: stage.getBoundingClientRect().left + stage.clientLeft + stage.clientWidth,
                        bottom: stage.getBoundingClientRect().top + stage.clientTop + stage.clientHeight,
                        width: stage.clientWidth,
                        height: stage.clientHeight,
                      }
                    : null;
                  const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
                  const canvasSize = canvas ? { width: canvas.width, height: canvas.height } : null;
                  const pos = calculateLoupePosition({
                    handlePos: handlePositions[dragHandle],
                    stageRect,
                    canvasRect,
                    canvasSize,
                  });
                  return (
                    <div
                      ref={effectiveLoupeOverlayRef}
                      className="loupeOverlay"
                      data-placement={pos.placement}
                      style={{
                        left: `${pos.left}px`,
                        top: `${pos.top}px`,
                      }}
                    >
                      <canvas ref={loupeCanvasRef} className="loupeCanvas" />
                      <div className="loupeCrosshair" />
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="empty">
                {selectedSlide && previewErrorSlideId === selectedSlide.id
                  ? text.previewError
                  : selectedSlide?.status === "converting"
                  ? text.converting
                  : selectedSlide?.error?.message ?? text.empty}
              </div>
            )}
          </div>
        </div>
        {slides.length > 1 ? (
          <>
            <Button
              variant="icon"
              size="touch"
              className="stageFloatingNav stageFloatingNav--prev"
              disabled={selectedIndex <= 0}
              title={`${text.prev} (K / PageUp)`}
              aria-label={text.prev}
              onClick={() => selectAt(selectedIndex - 1)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Button>
            <Button
              variant="icon"
              size="touch"
              className="stageFloatingNav stageFloatingNav--next"
              disabled={selectedIndex < 0 || selectedIndex >= slides.length - 1}
              title={`${text.next} (J / PageDown)`}
              aria-label={text.next}
              onClick={() => selectAt(selectedIndex + 1)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
