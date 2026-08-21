import type { SlideItem } from "./lib/types";

type Ref<T> = { current: T };

export type GlobalKeyboardShortcutActions = {
  busy: boolean;
  isInfoOpen: boolean;
  slidesRef: Ref<SlideItem[]>;
  selectedIdRef: Ref<string | null>;
  handleUndo: () => void;
  handleRedo: () => void;
  selectNextSlide: () => void;
  selectPrevSlide: () => void;
  deleteSlide: (id: string) => void;
  exportPdf: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

export function createGlobalKeyDownHandler(actions: GlobalKeyboardShortcutActions) {
  return (event: KeyboardEvent) => {
    if (actions.isInfoOpen || isEditableTarget(event.target)) return;

    // Undo: Cmd+Z or Ctrl+Z
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      actions.handleUndo();
      return;
    }

    // Redo: Cmd+Shift+Z or Ctrl+Shift+Z or Ctrl+Y
    if (
      ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey) ||
      (event.ctrlKey && event.key.toLowerCase() === "y")
    ) {
      event.preventDefault();
      actions.handleRedo();
      return;
    }

    // Slide Navigation & Deletion
    if (actions.slidesRef.current.length > 0) {
      if (event.key.toLowerCase() === "j" || event.key === "PageDown") {
        event.preventDefault();
        actions.selectNextSlide();
        return;
      }
      if (event.key.toLowerCase() === "k" || event.key === "PageUp") {
        event.preventDefault();
        actions.selectPrevSlide();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (actions.selectedIdRef.current) {
          event.preventDefault();
          actions.deleteSlide(actions.selectedIdRef.current);
        }
        return;
      }
    }

    // Export PDF: Cmd+Enter or Ctrl+Enter
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const ready = actions.slidesRef.current.filter((slide) => slide.status === "ready" && slide.quad);
      if (ready.length && !actions.busy) {
        actions.exportPdf();
      }
    }
  };
}
