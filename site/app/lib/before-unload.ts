export interface ShouldWarnOnUnloadParams {
  slideCount: number;
  isBusy: boolean;
  hasExported: boolean;
}

/**
 * Determines whether the user should be warned before unloading/refreshing the page.
 *
 * Rules:
 * 1. If there are no slides loaded (slideCount === 0), never warn.
 * 2. If the application is actively busy (detecting, exporting, etc.), always warn.
 * 3. If slides are loaded and have not been freshly exported, warn the user.
 * 4. If slides have been exported and no subsequent edits were made, do not warn.
 */
export function shouldWarnOnUnload({
  slideCount,
  isBusy,
  hasExported,
}: ShouldWarnOnUnloadParams): boolean {
  if (slideCount <= 0) {
    return false;
  }
  if (isBusy) {
    return true;
  }
  return !hasExported;
}

/**
 * Checks if there is a fresh, non-stale export artifact (PDF or JPG).
 */
export function hasFreshExport(exportArtifacts?: {
  pdf?: { isStale?: boolean };
  jpg?: { isStale?: boolean };
}): boolean {
  if (!exportArtifacts) {
    return false;
  }
  return Boolean(
    (exportArtifacts.pdf && !exportArtifacts.pdf.isStale) ||
      (exportArtifacts.jpg && !exportArtifacts.jpg.isStale),
  );
}

/**
 * Standard beforeunload event handler that triggers the browser's native confirmation dialog.
 */
export function handleBeforeUnloadEvent(event: BeforeUnloadEvent): string {
  event.preventDefault();
  event.returnValue = "";
  return "";
}
