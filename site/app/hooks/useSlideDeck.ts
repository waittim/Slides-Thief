import { useCallback, useEffect, useRef, useState } from "react";
import { cloneSlides } from "../lib/slide-utils";
import type { SlideItem } from "../lib/types";

export function useSlideDeck(
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
  }, []);

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [cloneSlides(slidesRef.current), ...historyFutureRef.current];
    clearExport();
    setSlides(previous);
  }, [clearExport]);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, cloneSlides(slidesRef.current)];
    clearExport();
    setSlides(next);
  }, [clearExport]);

  const deleteSlide = useCallback(
    (id: string) => {
      pushHistory();
      clearExport();
      setSlides((current) => {
        const next = current.filter((slide) => slide.id !== id);
        if (selectedIdRef.current === id) {
          const index = current.findIndex((slide) => slide.id === id);
          const nextSelected = next[Math.min(index, next.length - 1)];
          setSelectedId(nextSelected?.id ?? null);
        }
        return next;
      });
    },
    [clearExport, pushHistory],
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
    deleteSlide,
    clearAllSlides,
    selectNextSlide,
    selectPrevSlide,
  };
}
