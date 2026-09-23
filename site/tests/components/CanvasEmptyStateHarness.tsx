import { useState } from "react";
import { copy, type LocaleValue } from "../../app/i18n.ts";
import { CanvasEmptyState } from "../../app/components/CanvasEmptyState.tsx";

export function CanvasEmptyStateHarness({
  initialLocale = "en",
  initialBusy = false,
  isMobile = false,
}: {
  initialLocale?: LocaleValue;
  initialBusy?: boolean;
  isMobile?: boolean;
} = {}) {
  const [uploadClicked, setUploadClicked] = useState(false);
  const [sampleClicked, setSampleClicked] = useState(false);
  const text = copy[initialLocale];

  return (
    <div>
      <CanvasEmptyState
        text={text}
        isMobile={isMobile}
        onUpload={() => setUploadClicked(true)}
        onLoadSample={() => setSampleClicked(true)}
        busy={initialBusy}
      />
      <div data-testid="upload-status">{uploadClicked ? "uploaded" : "not-uploaded"}</div>
      <div data-testid="sample-status">{sampleClicked ? "sampled" : "not-sampled"}</div>
    </div>
  );
}
