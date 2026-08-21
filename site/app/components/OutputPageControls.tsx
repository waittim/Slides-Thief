import React from "react";
import type { EnhancementMode } from "../enhance";
import type { LocaleCopy, RatioUiCopy } from "../i18n";
import {
  pageLayoutMode,
  WEB_OUTPUT_PAPER_FORMATS,
  type OutputPageRatio,
  type PageLayoutMode,
} from "../ratio";
import { settingsReducer, type SettingsAction } from "../lib/settingsTransitions";
import type { Settings } from "../lib/types";
import { Button, Select } from "./ui";

export interface OutputPageControlsProps {
  ratioUi: RatioUiCopy;
  settings: Settings;
  text: LocaleCopy;
  updateSettings: (updater: (current: Settings) => Settings) => void;
}

export function OutputPageControls({
  ratioUi,
  settings,
  text,
  updateSettings,
}: OutputPageControlsProps) {
  const currentPageLayout = pageLayoutMode(settings.outputPageRatio, settings.height);
  const applyAction = (action: SettingsAction) => {
    updateSettings((current) => settingsReducer(current, action));
  };

  return (
    <>
      <label>
        <span>{ratioUi.pageLayout}</span>
        <Select
          value={currentPageLayout}
          onChange={(event) =>
            applyAction({ type: "page-layout", value: event.target.value as PageLayoutMode })
          }
        >
          <option value="match-source">{ratioUi.matchSource}</option>
          <option value="paper">{ratioUi.standardPaper}</option>
          <option value="custom-size">{ratioUi.customPage}</option>
        </Select>
      </label>
      {currentPageLayout === "paper" && (
        <label>
          <span>{ratioUi.paperFormat}</span>
          <Select
            value={settings.outputPageRatio}
            onChange={(event) =>
              applyAction({ type: "paper-format", value: event.target.value as OutputPageRatio })
            }
          >
            {WEB_OUTPUT_PAPER_FORMATS.map((format) => (
              <option key={format.id} value={format.id}>
                {String(text[format.label_key as keyof LocaleCopy])}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label>
        <span>{text.width}</span>
        <input
          type="number"
          min={800}
          max={6000}
          value={settings.width}
          onChange={(event) => applyAction({ type: "width", value: Number(event.target.value) })}
        />
      </label>
      {currentPageLayout === "custom-size" && (
        <label>
          <span>{text.height}</span>
          <input
            type="number"
            min={600}
            max={6000}
            value={settings.height ?? 1350}
            onChange={(event) => applyAction({ type: "height", value: Number(event.target.value) })}
          />
        </label>
      )}
      <label>
        <span>{text.quality}</span>
        <input
          type="number"
          min={60}
          max={98}
          value={Math.round(settings.quality * 100)}
          onChange={(event) =>
            applyAction({ type: "quality-percent", value: Number(event.target.value) })
          }
        />
      </label>
      <label>
        <span>{text.enhancement}</span>
        <Select
          value={settings.enhancement}
          onChange={(event) =>
            applyAction({ type: "enhancement", value: event.target.value as EnhancementMode })
          }
        >
          <option value="original">{text.enhancementOriginal}</option>
          <option value="clean">{text.enhancementClean}</option>
          <option value="high-contrast">{text.enhancementHighContrast}</option>
          <option value="bw">{text.enhancementBw}</option>
        </Select>
      </label>
      <div className="colorSetting" role="group" aria-labelledby="fill-color-label">
        <span id="fill-color-label">{text.fillColor}</span>
        <div className="colorControls">
          <Button
            type="button"
            aria-pressed={settings.fillColor === "auto"}
            onClick={() => applyAction({ type: "fill-color-auto" })}
          >
            {text.auto}
          </Button>
          <input
            type="color"
            className={settings.fillColor === "auto" ? undefined : "isActive"}
            aria-label={text.fillColor}
            value={settings.fillColor === "auto" ? "#FFFFFF" : settings.fillColor}
            onChange={(event) => applyAction({ type: "fill-color", value: event.target.value })}
          />
        </div>
      </div>
    </>
  );
}
