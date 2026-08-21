import React from "react";
import type { LocaleCopy, RatioUiCopy } from "../i18n";
import {
  WEB_SOURCE_BASE_FORMATS,
  splitSourceFormat,
  type BaseFormat,
} from "../ratio";
import { settingsReducer, type SettingsAction } from "../lib/settingsTransitions";
import type { Settings } from "../lib/types";
import { Select, Switch } from "./ui";

export interface SourceFormatControlsProps {
  hasRun: boolean;
  runAutoWithSettings: (settings: Settings) => void;
  settings: Settings;
  text: LocaleCopy;
  ratioUi: RatioUiCopy;
  updateSettings: (updater: (current: Settings) => Settings) => void;
}

export function SourceFormatControls({
  hasRun,
  runAutoWithSettings,
  settings,
  text,
  ratioUi,
  updateSettings,
}: SourceFormatControlsProps) {
  const { baseFormat: currentBaseFormat } = splitSourceFormat(
    settings.sourceFormat,
    settings.sourceOrientation,
  );
  const applySourceAction = (action: SettingsAction) => {
    const nextSettings = settingsReducer(settings, action);
    updateSettings(() => nextSettings);
    if (hasRun) runAutoWithSettings(nextSettings);
  };
  const formatLabel = (format: (typeof WEB_SOURCE_BASE_FORMATS)[number]) => {
    if ("label_key" in format && format.label_key) {
      return String(text[format.label_key as keyof LocaleCopy]);
    }
    const fallback = format as { label?: string; id: string };
    return fallback.label ?? fallback.id;
  };

  return (
    <>
      <label className="ratioSetting">
        <span>{ratioUi.sourceFormat}</span>
        <Select
          value={currentBaseFormat}
          onChange={(event) =>
            applySourceAction({ type: "source-format", value: event.target.value as BaseFormat })
          }
        >
          <optgroup label={ratioUi.presentationGroup}>
            {WEB_SOURCE_BASE_FORMATS.filter((format) => format.kind === "presentation").map((format) => (
              <option key={format.id} value={format.id}>{formatLabel(format)}</option>
            ))}
          </optgroup>
          <optgroup label={ratioUi.documentGroup}>
            {WEB_SOURCE_BASE_FORMATS.filter((format) => format.kind === "document").map((format) => (
              <option key={format.id} value={format.id}>{formatLabel(format)}</option>
            ))}
          </optgroup>
          <option value="custom">{ratioUi.custom}</option>
        </Select>
      </label>
      {settings.sourceFormat === "custom" && (
        <label className="sourceCustomSetting">
          <span>{ratioUi.customRatio}</span>
          <input
            type="number"
            min={0.2}
            max={5}
            step={0.01}
            value={settings.sourceCustomRatio ?? 16 / 9}
            onChange={(event) =>
              applySourceAction({ type: "source-custom-ratio", value: Number(event.target.value) })
            }
          />
        </label>
      )}
    </>
  );
}

export interface SourceOrientationControlProps {
  hasRun: boolean;
  ratioUi: RatioUiCopy;
  runAutoWithSettings: (settings: Settings) => void;
  settings: Settings;
  updateSettings: (updater: (current: Settings) => Settings) => void;
}

export function SourceOrientationControl({
  hasRun,
  ratioUi,
  runAutoWithSettings,
  settings,
  updateSettings,
}: SourceOrientationControlProps) {
  const { orientation } = splitSourceFormat(settings.sourceFormat, settings.sourceOrientation);
  const applyOrientationChange = () => {
    const nextSettings = settingsReducer(settings, { type: "source-orientation-toggle" });
    updateSettings(() => nextSettings);
    if (hasRun) runAutoWithSettings(nextSettings);
  };

  return (
    <div className="orientationSetting">
      <span>{ratioUi.orientation}</span>
      <Switch
        checked={orientation === "portrait"}
        label={orientation === "portrait" ? ratioUi.portrait : ratioUi.landscape}
        onChange={applyOrientationChange}
      />
    </div>
  );
}
