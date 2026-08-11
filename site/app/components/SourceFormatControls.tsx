import React from "react";
import type { LocaleCopy, RatioUiCopy } from "../i18n";
import {
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
            <option value="16:9">{text.ratio16x9}</option>
            <option value="4:3">{text.ratio4x3}</option>
            <option value="16:10">16:10</option>
          </optgroup>
          <optgroup label={ratioUi.documentGroup}>
            <option value="A4">A4</option>
            <option value="letter">Letter</option>
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
