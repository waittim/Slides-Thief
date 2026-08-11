import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Quad } from "../detection/types";
import { maxQuadOutside, quadHandlePositions } from "../lib/slide-utils";
import type { CanvasRenderState, HandlePosition, SlideItem } from "../lib/types";

type DragQuadRef = MutableRefObject<{ id: string; quad: Quad } | null>;
type DragHandleRef = MutableRefObject<number | null>;

type CanvasViewportOptions = {
  selectedSlide: SlideItem | null;
  setSlides: Dispatch<SetStateAction<SlideItem[]>>;
  latestDragQuadRef: DragQuadRef;
  dragHandleRef: DragHandleRef;
};

export function useCanvasViewport({
  selectedSlide,
  setSlides,
  latestDragQuadRef,
  dragHandleRef,
}: CanvasViewportOptions) {
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoom, setZoom] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [handlePositions, setHandlePositions] = useState<HandlePosition[]>([]);
  const [previewErrorSlideId, setPreviewErrorSlideId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const handleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const canvasRenderRef = useRef<CanvasRenderState | null>(null);
  const imageCacheRef = useRef<{ id: string; url: string; image: HTMLImageElement } | null>(null);
  const viewportRef = useRef({ padX: 0, padY: 0 });
  const scaleRef = useRef(1);
  const fitZoomRef = useRef(1);
  const maxZoomRef = useRef(3);

  const updateLoupeCanvas = useCallback((quad: Quad | null, handleIndex: number | null) => {
    const loupeCanvas = loupeCanvasRef.current;
    const render = canvasRenderRef.current;
    if (!loupeCanvas || !render?.image || handleIndex === null || !quad || !quad[handleIndex]) return;

    const ctx = loupeCanvas.getContext("2d");
    if (!ctx) return;

    const [srcX, srcY] = quad[handleIndex];
    const size = 120;
    loupeCanvas.width = size;
    loupeCanvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const srcSize = size / 2.5;
    ctx.drawImage(
      render.image,
      srcX - srcSize / 2,
      srcY - srcSize / 2,
      srcSize,
      srcSize,
      0,
      0,
      size,
      size,
    );
  }, []);

  const paintCanvas = useCallback((quad: Quad | null) => {
    const canvas = canvasRef.current;
    const render = canvasRenderRef.current;
    if (!canvas || !render) return;

    const { image, width, height, padX, padY, scale, compact } = render;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    const imageX = padX * scale;
    const imageY = padY * scale;
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, .36)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);

    if (!quad) return;
    const positions = quadHandlePositions(quad, padX, padY, scale);
    positions.forEach((position, index) => {
      const handle = handleRefs.current[index];
      if (!handle) return;
      handle.style.left = `${position.left}px`;
      handle.style.top = `${position.top}px`;
    });

    ctx.lineWidth = Math.max(3, Math.min(7, width / 420));
    ctx.strokeStyle = "rgba(200, 69, 53, .98)";
    ctx.beginPath();
    positions.forEach(({ left, top }, index) => {
      if (index === 0) ctx.moveTo(left, top);
      else ctx.lineTo(left, top);
    });
    ctx.closePath();
    ctx.stroke();

    positions.forEach(({ left, top }, index) => {
      const radius = compact ? 12 : Math.max(9, Math.min(18, width / 150));
      ctx.fillStyle = "rgba(255, 216, 74, .96)";
      ctx.strokeStyle = "rgba(16, 20, 22, .92)";
      ctx.lineWidth = Math.max(2, Math.min(4, width / 700));
      ctx.beginPath();
      ctx.arc(left, top, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#172026";
      ctx.font = `700 ${Math.max(13, Math.min(18, width / 80))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), left, top + 1);
    });

    if (dragHandleRef.current !== null) updateLoupeCanvas(quad, dragHandleRef.current);
  }, [dragHandleRef, updateLoupeCanvas]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const slide = selectedSlide;
    if (!canvas || !stage || !slide) return;
    if (!slide.url) {
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      setHandlePositions([]);
      return;
    }

    const renderImage = (image: HTMLImageElement) => {
      if (imageCacheRef.current?.image !== image) return;
      setPreviewErrorSlideId((current) => (current === slide.id ? null : current));
      if (!slide.width || !slide.height) {
        setSlides((current) =>
          current.map((item) =>
            item.id === slide.id && (!item.width || !item.height)
              ? { ...item, width: image.naturalWidth, height: image.naturalHeight }
              : item,
          ),
        );
      }

      const previewQuad = latestDragQuadRef.current?.id === slide.id ? latestDragQuadRef.current.quad : slide.quad;
      const compact = stage.clientWidth <= 834 || window.matchMedia("(pointer: coarse)").matches;
      const maxWidth = Math.max(1, stage.clientWidth - (compact ? 16 : 26));
      const maxHeight = Math.max(1, stage.clientHeight - (compact ? 16 : 26));
      const imageFitScale = Math.max(
        0.0001,
        Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1),
      );
      const desiredHandleGutter = compact ? 30 : 34;
      const quadOverflowX = previewQuad
        ? Math.max(0, ...previewQuad.map(([x]) => Math.max(-x, x - image.naturalWidth)))
        : 0;
      const quadOverflowY = previewQuad
        ? Math.max(0, ...previewQuad.map(([, y]) => Math.max(-y, y - image.naturalHeight)))
        : 0;
      const handleSourceGutter = 24 / imageFitScale;
      const maxOutsideX = maxQuadOutside(image.naturalWidth);
      const maxOutsideY = maxQuadOutside(image.naturalHeight);
      const padX = Math.min(
        maxOutsideX,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalWidth * 0.12),
          Math.ceil(quadOverflowX + handleSourceGutter),
        ),
      );
      const padY = Math.min(
        maxOutsideY,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalHeight * 0.12),
          Math.ceil(quadOverflowY + handleSourceGutter),
        ),
      );
      const totalWidth = image.naturalWidth + padX * 2;
      const totalHeight = image.naturalHeight + padY * 2;
      const fitScale = Math.min(maxWidth / totalWidth, maxHeight / totalHeight, 1);
      const maxDimension = compact ? 4096 : 8192;
      const maxPixels = compact ? 8_000_000 : 24_000_000;
      const budgetScale = Math.min(
        maxDimension / totalWidth,
        maxDimension / totalHeight,
        Math.sqrt(maxPixels / (totalWidth * totalHeight)),
      );
      const maxScale = Math.max(fitScale, Math.min(3, budgetScale));
      const requestedScale = zoomMode === "fit" ? fitScale : zoom;
      const scale = Math.max(0.01, Math.min(requestedScale, maxScale));
      const width = Math.max(1, Math.round(totalWidth * scale));
      const height = Math.max(1, Math.round(totalHeight * scale));

      canvas.width = width;
      canvas.height = height;
      scaleRef.current = scale;
      fitZoomRef.current = fitScale;
      maxZoomRef.current = maxScale;
      viewportRef.current = { padX, padY };
      canvasRenderRef.current = { slideId: slide.id, image, width, height, padX, padY, scale, compact };
      setDisplayZoom((current) => (Math.abs(current - scale) < 0.0001 ? current : scale));
      setHandlePositions(previewQuad ? quadHandlePositions(previewQuad, padX, padY, scale) : []);
      paintCanvas(previewQuad);
    };

    const cached = imageCacheRef.current;
    if (cached?.id === slide.id && cached.url === slide.url) {
      if (cached.image.complete && cached.image.naturalWidth) {
        renderImage(cached.image);
      } else {
        cached.image.onload = () => renderImage(cached.image);
        cached.image.onerror = () => {
          if (imageCacheRef.current?.image === cached.image) setPreviewErrorSlideId(slide.id);
        };
      }
      return;
    }

    const image = new Image();
    image.decoding = "async";
    imageCacheRef.current = { id: slide.id, url: slide.url, image };
    image.onload = () => renderImage(image);
    image.onerror = () => {
      if (imageCacheRef.current?.image === image) setPreviewErrorSlideId(slide.id);
    };
    image.src = slide.url;
  }, [latestDragQuadRef, paintCanvas, selectedSlide, setSlides, zoom, zoomMode]);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(redrawCanvas);
    const observer = new ResizeObserver(redrawCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
    };
  }, [redrawCanvas]);

  const resetViewport = useCallback(() => {
    imageCacheRef.current = null;
    canvasRenderRef.current = null;
    setHandlePositions([]);
    if (canvasRef.current) {
      canvasRef.current.width = 1;
      canvasRef.current.height = 1;
    }
  }, []);

  const zoomOut = useCallback(() => {
    setZoomMode("manual");
    setZoom(Math.max(fitZoomRef.current * 0.5, Math.min(maxZoomRef.current, displayZoom / 1.18)));
  }, [displayZoom]);

  const zoomIn = useCallback(() => {
    setZoomMode("manual");
    setZoom(Math.min(maxZoomRef.current, Math.max(fitZoomRef.current * 0.5, displayZoom * 1.18)));
  }, [displayZoom]);

  return {
    stageRef,
    canvasRef,
    loupeCanvasRef,
    handleRefs,
    canvasRenderRef,
    viewportRef,
    scaleRef,
    displayZoom,
    handlePositions,
    setHandlePositions,
    previewErrorSlideId,
    setPreviewErrorSlideId,
    zoomMode,
    setZoomMode,
    paintCanvas,
    redrawCanvas,
    updateLoupeCanvas,
    resetViewport,
    zoomOut,
    zoomIn,
  };
}
