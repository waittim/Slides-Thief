import { useEffect, useRef } from "react";
import {
  createWindowDragDropHandlers,
  createWindowPasteHandler,
  type WindowImportActions,
} from "../window-import";

export function useWindowImport(actions: WindowImportActions) {
  const actionsRef = useRef(actions);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const { onDragEnter, onDragOver, onDragLeave, onDrop, onReset } =
      createWindowDragDropHandlers(actionsRef, dragDepthRef);
    const onPaste = createWindowPasteHandler(actionsRef);

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onReset);
    window.addEventListener("blur", onReset);
    window.addEventListener("paste", onPaste);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onReset);
      window.removeEventListener("blur", onReset);
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}
