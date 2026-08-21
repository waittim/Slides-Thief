import { useEffect, useRef } from "react";
import { createGlobalKeyDownHandler, type GlobalKeyboardShortcutActions } from "../keyboard-shortcuts";

export function useKeyboardShortcuts(actions: GlobalKeyboardShortcutActions) {
  const handlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  useEffect(() => {
    handlerRef.current = createGlobalKeyDownHandler(actions);
  }, [actions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
