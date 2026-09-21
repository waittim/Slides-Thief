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
import { calculateAutoPanVelocity } from "../lib/viewport-math";

type DragQuadRef = MutableRefObject<{ id: string; quad: Quad } | null>;
type DragHandleRef = MutableRefObject<number | null>;

type QuadEditorOptions = {
  selectedSlide: SlideItem | null;
  text: LocaleCopy;
  settings?: Pick<Settings, "sourceFormat" | "sourceOrientation" | "sourceCustomRatio">;
  setSlides: Dispatch<SetStateAction<SlideItem[]>>;
  setBusyText?: (text: string) => void;
  setCornerAnnouncement: (announcement: string) => void;
  setHandlePositions: Dispatch<SetStateAction<HandlePosition[]>>;
  markExportStale: () => void;
  clearExport?: () => void;
  pushHistory: () => void;
  startDetection?: (
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
  updateLoupePosition?: (handleIndex: number | null, handlePos?: HandlePosition) => void;
  stageRef?: MutableRefObject<HTMLDivElement | null>;
  isSpacePressed?: boolean;
};

export function useQuadEditor({
  selectedSlide,
  text,
  settings,
  setSlides,
  setBusyText,
  setCornerAnnouncement,
  setHandlePositions,
  markExportStale,
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
  updateLoupePosition,
  stageRef,
  isSpacePressed = false,
}: QuadEditorOptions) {
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const autoPanFrameRef = useRef<number | null>(null);
  const lastHandlePointerClientRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const stopAutoPan = useCallback(() => {
    if (autoPanFrameRef.current !== null) {
      window.cancelAnimationFrame(autoPanFrameRef.current);
      autoPanFrameRef.current = null;
    }
    lastHandlePointerClientRef.current = null;
  }, []);

  const cancelActiveDrag = useCallback(() => {
    stopAutoPan();
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
      markExportStale();
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
    [markExportStale, setSlides],
  );

  const canvasPointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0] as const;
    const rect = canvas.getBoundingClientRect();
    return [
      ((clientX - rect.left) / rect.width) * canvas.width,
      ((clientY - rect.top) / rect.height) * canvas.height,
    ] as const;
  }, [canvasRef]);

  const canvasPoint = useCallback((event: PointerEvent<HTMLElement>) => {
    return canvasPointFromClient(event.clientX, event.clientY);
  }, [canvasPointFromClient]);

  const updateHandleFromClient = useCallback((clientX: number, clientY: number) => {
    const handleIndex = dragHandleRef.current;
    const render = canvasRenderRef.current;
    const latest = latestDragQuadRef.current;
    if (handleIndex === null || !render || !latest || render.slideId !== latest.id) return;

    const [x, y] = canvasPointFromClient(clientX, clientY);
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
  }, [canvasPointFromClient, canvasRenderRef, dragHandleRef, latestDragQuadRef, paintCanvas, redrawCanvas, scaleRef, viewportRef]);

  const checkAutoPan = useCallback(() => {
    const stage = stageRef?.current;
    const coords = lastHandlePointerClientRef.current;
    if (!stage || !coords || dragHandleRef.current === null) {
      stopAutoPan();
      return;
    }

    const rect = stage.getBoundingClientRect();
    const { vx, vy } = calculateAutoPanVelocity(coords, rect, 40, 24);

    if (vx === 0 && vy === 0) {
      if (autoPanFrameRef.current !== null) {
        window.cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }
      return;
    }

    if (autoPanFrameRef.current === null) {
      const step = () => {
        if (dragHandleRef.current === null) {
          autoPanFrameRef.current = null;
          return;
        }
        const st = stageRef?.current;
        const pt = lastHandlePointerClientRef.current;
        if (!st || !pt) {
          autoPanFrameRef.current = null;
          return;
        }

        const r = st.getBoundingClientRect();
        const vel = calculateAutoPanVelocity(pt, r, 40, 24);
        if (vel.vx === 0 && vel.vy === 0) {
          autoPanFrameRef.current = null;
          return;
        }

        const prevX = st.scrollLeft;
        const prevY = st.scrollTop;
        st.scrollLeft += vel.vx;
        st.scrollTop += vel.vy;

        if (st.scrollLeft !== prevX || st.scrollTop !== prevY) {
          updateHandleFromClient(pt.clientX, pt.clientY);
        }

        autoPanFrameRef.current = window.requestAnimationFrame(step);
      };
      autoPanFrameRef.current = window.requestAnimationFrame(step);
    }
  }, [dragHandleRef, stageRef, stopAutoPan, updateHandleFromClient]);

  const onHandlePointerDown = useCallback((index: number, event: PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      isSpacePressed ||
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
    updateLoupePosition?.(index);
    lastHandlePointerClientRef.current = { clientX: event.clientX, clientY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [canvasRenderRef, dragHandleRef, isSpacePressed, latestDragQuadRef, pushHistory, selectedSlide, updateLoupeCanvas, updateLoupePosition]);

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

    lastHandlePointerClientRef.current = { clientX: event.clientX, clientY: event.clientY };
    updateHandleFromClient(event.clientX, event.clientY);
    checkAutoPan();
    event.preventDefault();
  }, [activePointerRef, checkAutoPan, dragHandleRef, latestDragQuadRef, updateHandleFromClient]);

  const onHandlePointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    stopAutoPan();
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
  }, [canvasRenderRef, dragHandleRef, latestDragQuadRef, paintCanvas, refreshSlideThumbnail, setCornerAnnouncement, setHandlePositions, stopAutoPan, text.cornerHandle, updateSlideQuad]);

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

  const restoreSelectedAutoDetection = useCallback(() => {
    if (!selectedSlide || !selectedSlide.autoDetection || selectedSlide.status !== "ready") return;
    cancelActiveDrag();
    pushHistory();
    markExportStale();
    const snapshot = selectedSlide.autoDetection;
    const next = cloneQuad(snapshot.quad);
    const render = canvasRenderRef.current;
    if (render && render.slideId === selectedSlide.id) {
      paintCanvas(next);
      setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
    }
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id !== selectedSlide.id) return slide;
        return restoreAutoDetection(slide);
      }),
    );
    void refreshSlideThumbnail(selectedSlide.id, next);
  }, [
    cancelActiveDrag,
    canvasRenderRef,
    markExportStale,
    paintCanvas,
    pushHistory,
    refreshSlideThumbnail,
    selectedSlide,
    setHandlePositions,
    setSlides,
  ]);

  const updateCornerCoordinate = useCallback(
    (cornerIndex: number, coordIndex: 0 | 1, value: number) => {
      if (!selectedSlide?.quad) return;
      const width = selectedSlide.width;
      const height = selectedSlide.height;
      if (width <= 0 || height <= 0) return;

      const max = coordIndex === 0 ? width : height;
      const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? Math.round(value) : 0));
      const currentVal = selectedSlide.quad[cornerIndex][coordIndex];
      if (Math.abs(clamped - currentVal) < 0.5) return;

      cancelActiveDrag();
      pushHistory();
      const next = cloneQuad(selectedSlide.quad);
      next[cornerIndex][coordIndex] = clamped;

      const render = canvasRenderRef.current;
      if (render && render.slideId === selectedSlide.id) {
        paintCanvas(next);
        setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
      }
      updateSlideQuad(selectedSlide.id, next);
      void refreshSlideThumbnail(selectedSlide.id, next);
      setCornerAnnouncement(
        `${text.cornerHandle} ${cornerIndex + 1}: X ${Math.round(next[cornerIndex][0])}, Y ${Math.round(next[cornerIndex][1])}`,
      );
    },
    [
      cancelActiveDrag,
      canvasRenderRef,
      paintCanvas,
      pushHistory,
      refreshSlideThumbnail,
      selectedSlide,
      setCornerAnnouncement,
      setHandlePositions,
      text.cornerHandle,
      updateSlideQuad,
    ],
  );

  return {
    dragHandle,
    cancelActiveDrag,
    updateSlideQuad,
    updateCornerCoordinate,
    restoreAutoDetection: restoreSelectedAutoDetection,
    resetSelected: restoreSelectedAutoDetection,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandleKeyDown,
  };
}
