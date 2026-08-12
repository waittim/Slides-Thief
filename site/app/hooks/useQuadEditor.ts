import { useCallback, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent, SetStateAction, KeyboardEvent } from "react";
import type { Quad } from "../detection/types";
import type { LocaleCopy } from "../i18n";
import {
  clampQuadCoordinate,
  cloneQuad,
  maxQuadOutside,
  quadHandlePositions,
} from "../lib/slide-utils";
import { restoreAutoDetection } from "../lib/slide-transitions";
import { trackEvent, type CanvasRenderState, type HandlePosition, type Settings, type SlideItem } from "../lib/types";

type DragQuadRef = MutableRefObject<{ id: string; quad: Quad } | null>;
type DragHandleRef = MutableRefObject<number | null>;

type QuadEditorOptions = {
  selectedSlide: SlideItem | null;
  text: LocaleCopy;
  settings: Settings;
  setSlides: Dispatch<SetStateAction<SlideItem[]>>;
  setBusyText: (text: string) => void;
  setCornerAnnouncement: (announcement: string) => void;
  setHandlePositions: Dispatch<SetStateAction<HandlePosition[]>>;
  clearExport: () => void;
  pushHistory: () => void;
  startDetection: (
    files: Array<{ id: string; name: string; file: File }>,
    settings: Pick<Settings, "sourceFormat" | "sourceOrientation" | "sourceCustomRatio">,
  ) => number | null;
  refreshSlideThumbnail: (id: string, quad: Quad) => Promise<void>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasRenderRef: MutableRefObject<CanvasRenderState | null>;
  latestDragQuadRef: DragQuadRef;
  dragHandleRef: DragHandleRef;
  viewportRef: MutableRefObject<{ padX: number; padY: number }>;
  scaleRef: MutableRefObject<number>;
  paintCanvas: (quad: Quad | null) => void;
  redrawCanvas: () => void;
  updateLoupeCanvas: (quad: Quad | null, handleIndex: number | null) => void;
};

export function useQuadEditor({
  selectedSlide,
  text,
  settings,
  setSlides,
  setBusyText,
  setCornerAnnouncement,
  setHandlePositions,
  clearExport,
  pushHistory,
  startDetection,
  refreshSlideThumbnail,
  canvasRef,
  canvasRenderRef,
  latestDragQuadRef,
  dragHandleRef,
  viewportRef,
  scaleRef,
  paintCanvas,
  redrawCanvas,
  updateLoupeCanvas,
}: QuadEditorOptions) {
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  const cancelActiveDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
  }, [dragHandleRef, latestDragQuadRef]);

  const updateSlideQuad = useCallback(
    (id: string, nextQuad: Quad) => {
      clearExport();
      setSlides((current) =>
        current.map((slide) => {
          if (slide.id !== id) return slide;
          if (slide.status === "converting" || slide.status === "queued") return slide;
          if (slide.method !== "manual") trackEvent("corner_adjusted", { slide_id: id });
          const nextMetadata = {
            quad: nextQuad,
            method: "manual" as const,
            confidence: 1 as const,
            needsReview: false as const,
            reviewReasons: [],
          };
          if (slide.status === "detecting") {
            return {
              ...slide,
              ...nextMetadata,
              status: "detecting" as const,
              detectionState: "manual" as const,
            };
          }
          if (slide.status === "error") {
            return {
              ...slide,
              ...nextMetadata,
              status: "ready" as const,
              error: undefined,
            };
          }
          if (slide.status === "ready") {
            return {
              ...slide,
              ...nextMetadata,
              status: "ready" as const,
            };
          }
          return slide;
        }),
      );
    },
    [clearExport, setSlides],
  );

  const canvasPoint = useCallback((event: PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0] as const;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    ] as const;
  }, [canvasRef]);

  const onHandlePointerDown = useCallback((index: number, event: PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      activePointerRef.current !== null ||
      !selectedSlide?.quad ||
      canvasRenderRef.current?.slideId !== selectedSlide.id
    ) return;

    pushHistory();
    latestDragQuadRef.current = { id: selectedSlide.id, quad: cloneQuad(selectedSlide.quad) };
    activePointerRef.current = event.pointerId;
    dragHandleRef.current = index;
    setDragHandle(index);
    updateLoupeCanvas(selectedSlide.quad, index);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [canvasRenderRef, dragHandleRef, latestDragQuadRef, pushHistory, selectedSlide, updateLoupeCanvas]);

  const onHandlePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const handleIndex = dragHandleRef.current;
    const render = canvasRenderRef.current;
    const latest = latestDragQuadRef.current;
    if (
      handleIndex === null ||
      activePointerRef.current !== event.pointerId ||
      !render ||
      !latest ||
      render.slideId !== latest.id
    ) return;

    const [x, y] = canvasPoint(event);
    const scale = scaleRef.current || 1;
    const { padX, padY } = viewportRef.current;
    const next = cloneQuad(latest.quad);
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[handleIndex] = [
      clampQuadCoordinate(x / scale - padX, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(y / scale - padY, imageHeight, maxQuadOutside(imageHeight)),
    ];
    latestDragQuadRef.current = { id: latest.id, quad: next };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = latestDragQuadRef.current;
        if (!pending) return;
        const current = canvasRenderRef.current;
        const needsMorePad = Boolean(
          current && pending.quad.some(([px, py]) =>
            px < -current.padX ||
            py < -current.padY ||
            px > current.image.naturalWidth + current.padX ||
            py > current.image.naturalHeight + current.padY,
          ),
        );
        if (needsMorePad) redrawCanvas();
        else paintCanvas(pending.quad);
      });
    }
    event.preventDefault();
  }, [canvasPoint, canvasRenderRef, dragHandleRef, latestDragQuadRef, paintCanvas, redrawCanvas, scaleRef, viewportRef]);

  const onHandlePointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }

    const latest = latestDragQuadRef.current;
    const handleIndex = dragHandleRef.current;
    if (latest) {
      paintCanvas(latest.quad);
      const render = canvasRenderRef.current;
      if (render) setHandlePositions(quadHandlePositions(latest.quad, render.padX, render.padY, render.scale));
      updateSlideQuad(latest.id, latest.quad);
      void refreshSlideThumbnail(latest.id, latest.quad);
      if (handleIndex !== null) {
        const [x, y] = latest.quad[handleIndex];
        setCornerAnnouncement(`${text.cornerHandle} ${handleIndex + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`);
      }
    }

    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  }, [canvasRenderRef, dragHandleRef, latestDragQuadRef, paintCanvas, refreshSlideThumbnail, setCornerAnnouncement, setHandlePositions, text.cornerHandle, updateSlideQuad]);

  const onHandleKeyDown = useCallback((index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const render = canvasRenderRef.current;
    if (!selectedSlide?.quad || !render || render.slideId !== selectedSlide.id) return;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = direction[event.key];
    if (!delta) return;

    event.preventDefault();
    pushHistory();
    const sourceStep = (event.shiftKey ? 10 : 1) / (scaleRef.current || 1);
    const next = cloneQuad(selectedSlide.quad);
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[index] = [
      clampQuadCoordinate(next[index][0] + delta[0] * sourceStep, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(next[index][1] + delta[1] * sourceStep, imageHeight, maxQuadOutside(imageHeight)),
    ];
    const needsMorePad =
      next[index][0] < -render.padX ||
      next[index][1] < -render.padY ||
      next[index][0] > imageWidth + render.padX ||
      next[index][1] > imageHeight + render.padY;
    latestDragQuadRef.current = { id: selectedSlide.id, quad: next };
    if (needsMorePad) redrawCanvas();
    else {
      paintCanvas(next);
      setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
    }
    latestDragQuadRef.current = null;
    updateSlideQuad(selectedSlide.id, next);
    void refreshSlideThumbnail(selectedSlide.id, next);
    setCornerAnnouncement(`${text.cornerHandle} ${index + 1}: X ${Math.round(next[index][0])}, Y ${Math.round(next[index][1])}`);
  }, [canvasRenderRef, latestDragQuadRef, paintCanvas, pushHistory, redrawCanvas, refreshSlideThumbnail, scaleRef, selectedSlide, setCornerAnnouncement, setHandlePositions, text.cornerHandle, updateSlideQuad]);

  const resetSelected = useCallback(() => {
    if (!selectedSlide) return;
    clearExport();
    cancelActiveDrag();
    if (selectedSlide.autoDetection) {
      const snapshot = selectedSlide.autoDetection;
      const next = cloneQuad(snapshot.quad);
      setSlides((current) =>
        current.map((slide) => {
          if (slide.id !== selectedSlide.id) return slide;
          return restoreAutoDetection(slide);
        }),
      );
      void refreshSlideThumbnail(selectedSlide.id, next);
      return;
    }

    const jobId = startDetection(
      [{ id: selectedSlide.id, name: selectedSlide.name, file: selectedSlide.file }],
      settings,
    );
    if (jobId !== null) setBusyText(`${text.stretching}: ${selectedSlide.name}`);
  }, [cancelActiveDrag, clearExport, refreshSlideThumbnail, selectedSlide, setBusyText, setSlides, settings, startDetection, text.stretching]);

  return {
    dragHandle,
    cancelActiveDrag,
    updateSlideQuad,
    resetSelected,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandleKeyDown,
  };
}
