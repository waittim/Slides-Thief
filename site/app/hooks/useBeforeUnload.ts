import { useEffect } from "react";
import { handleBeforeUnloadEvent } from "../lib/before-unload";

/**
 * Registers a beforeunload window listener when `enabled` is true.
 * Prompts the user with the browser's native confirmation dialog before
 * leaving or reloading the page if unsaved work exists.
 */
export function useBeforeUnload(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener("beforeunload", handleBeforeUnloadEvent);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnloadEvent);
    };
  }, [enabled]);
}
