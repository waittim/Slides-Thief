import { useCallback, useEffect, useRef, useState } from "react";
import { cloneSlides } from "../lib/slide-utils";
import type { SlideItem } from "../lib/types";

export function useSlideDeck(
  markExportStale: () => void,
  clearExport: () => void,
  cancelActiveDrag: () => void,
  confirmClearText: (count: number) => string,
) {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const slidesRef = useRef<SlideItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const historyPastRef = useRef<SlideItem[][]>([]);
  const historyFutureRef = useRef<SlideItem[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const pushHistory = useCallback(() => {
    if (slidesRef.current.length === 0) return;
    historyPastRef.current = [...historyPastRef.current.slice(-29), cloneSlides(slidesRef.current)];
    historyFutureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [cloneSlides(slidesRef.current), ...historyFutureRef.current];
    setCanUndo(historyPastRef.current.length > 0);
    setCanRedo(true);
    if (previous.length === 0) {
      clearExport();
    } else {
      markExportStale();
    }
    setSlides(previous);
    if (selectedIdRef.current && !previous.some((s) => s.id === selectedIdRef.current)) {
      setSelectedId(previous[previous.length - 1]?.id ?? null);
    }
  }, [clearExport, markExportStale]);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, cloneSlides(slidesRef.current)];
    setCanUndo(true);
    setCanRedo(historyFutureRef.current.length > 0);
    if (next.length === 0) {
      clearExport();
    } else {
      markExportStale();
    }
    setSlides(next);
    if (selectedIdRef.current && !next.some((s) => s.id === selectedIdRef.current)) {
      setSelectedId(next[0]?.id ?? null);
    }
  }, [clearExport, markExportStale]);

  const deleteSlide = useCallback(
    (id: string) => {
      pushHistory();
      const current = slidesRef.current;
      const next = current.filter((slide) => slide.id !== id);
      if (next.length === 0) {
        clearExport();
      } else {
        markExportStale();
      }
      if (selectedIdRef.current === id) {
        const index = current.findIndex((slide) => slide.id === id);
        const nextSelected = next[Math.min(index, next.length - 1)];
        setSelectedId(nextSelected?.id ?? null);
      }
      setSlides(next);
    },
    [clearExport, markExportStale, pushHistory],
  );

  const clearAllSlides = useCallback(() => {
    const count = slidesRef.current.length;
    if (!count) return;
    const shouldClear = window.confirm(confirmClearText(count));
    if (!shouldClear) return;
    pushHistory();
    clearExport();
    cancelActiveDrag();
    setSlides([]);
    setSelectedId(null);
  }, [cancelActiveDrag, clearExport, confirmClearText, pushHistory]);

  const selectNextSlide = useCallback(
    (onSelect?: () => void) => {
      const currentSlides = slidesRef.current;
      if (!currentSlides.length) return;
      const currentId = selectedIdRef.current;
      const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
      const nextIndex = Math.min(currentIndex + 1, currentSlides.length - 1);
      if (nextIndex >= 0 && nextIndex !== currentIndex && currentSlides[nextIndex]) {
        cancelActiveDrag();
        setSelectedId(currentSlides[nextIndex].id);
        onSelect?.();
      }
    },
    [cancelActiveDrag],
  );

  const selectPrevSlide = useCallback(
    (onSelect?: () => void) => {
      const currentSlides = slidesRef.current;
      if (!currentSlides.length) return;
      const currentId = selectedIdRef.current;
      const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      if (prevIndex >= 0 && prevIndex !== currentIndex && currentSlides[prevIndex]) {
        cancelActiveDrag();
        setSelectedId(currentSlides[prevIndex].id);
        onSelect?.();
      }
    },
    [cancelActiveDrag],
  );

  return {
    slides,
    setSlides,
    selectedId,
    setSelectedId,
    slidesRef,
    selectedIdRef,
    pushHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    deleteSlide,
    clearAllSlides,
    selectNextSlide,
    selectPrevSlide,
  };
}
