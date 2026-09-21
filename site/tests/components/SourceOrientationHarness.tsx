import { useState } from "react";
import { SourceOrientationControl } from "../../app/components/SourceFormatControls";
import { copy, ratioUiCopy, type LocaleValue } from "../../app/i18n";
import { defaultSettings, type Settings } from "../../app/lib/types";

export interface SourceOrientationHarnessProps {
  locale?: LocaleValue;
  initialOrientation?: "landscape" | "portrait";
}

export function SourceOrientationHarness({
  locale = "zh-CN",
  initialOrientation = "landscape",
}: SourceOrientationHarnessProps) {
  const [settings, setSettings] = useState<Settings>({
    ...defaultSettings,
    sourceFormat: "16:9",
    sourceOrientation: initialOrientation,
  });

  const text = copy[locale];
  const ratioUi = ratioUiCopy[locale];

  return (
    <div style={{ padding: "20px" }}>
      <SourceOrientationControl
        hasRun={false}
        ratioUi={ratioUi}
        runAutoWithSettings={() => {}}
        settings={settings}
        text={text}
        updateSettings={(updater) => setSettings(updater)}
      />
    </div>
  );
}
