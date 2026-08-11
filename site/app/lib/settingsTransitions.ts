import type { EnhancementMode } from "../enhance";
import {
  defaultOrientationForBaseFormat,
  deriveSourceFormat,
  isPaperRatio,
  outputPageRatioValue,
  sourceFormatRatioValue,
  splitSourceFormat,
  type BaseFormat,
  type OutputPageRatio,
  type PageLayoutMode,
} from "../ratio.ts";
import type { Settings } from "./types.ts";

export type SettingsAction =
  | { type: "source-format"; value: BaseFormat }
  | { type: "source-custom-ratio"; value: number }
  | { type: "source-orientation-toggle" }
  | { type: "page-layout"; value: PageLayoutMode }
  | { type: "paper-format"; value: OutputPageRatio }
  | { type: "width"; value: number }
  | { type: "height"; value: number }
  | { type: "quality-percent"; value: number }
  | { type: "enhancement"; value: EnhancementMode }
  | { type: "fill-color"; value: string }
  | { type: "fill-color-auto" };

function clamp(value: number, min: number, max: number, fallback: number): number {
  const candidate = Number.isFinite(value) && value !== 0 ? value : fallback;
  return Math.max(min, Math.min(max, candidate));
}

export function settingsReducer(settings: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case "source-format": {
      const sourceOrientation = defaultOrientationForBaseFormat(action.value);
      return {
        ...settings,
        sourceFormat: deriveSourceFormat(action.value, sourceOrientation),
        sourceOrientation,
      };
    }
    case "source-custom-ratio":
      return {
        ...settings,
        sourceCustomRatio: clamp(action.value, 0.2, 5, 16 / 9),
      };
    case "source-orientation-toggle": {
      const { baseFormat, orientation } = splitSourceFormat(
        settings.sourceFormat,
        settings.sourceOrientation,
      );
      const sourceOrientation = orientation === "portrait" ? "landscape" : "portrait";
      return {
        ...settings,
        sourceFormat: deriveSourceFormat(baseFormat, sourceOrientation),
        sourceOrientation,
      };
    }
    case "page-layout": {
      if (action.value === "paper") {
        const sourceRatio = sourceFormatRatioValue(settings);
        const outputPageRatio = isPaperRatio(settings.outputPageRatio)
          ? settings.outputPageRatio
          : sourceRatio >= 1
            ? "A4-landscape"
            : "A4-portrait";
        return {
          ...settings,
          outputPageRatio,
          height: null,
        };
      }
      if (action.value === "custom-size") {
        const sourceRatio = sourceFormatRatioValue(settings);
        const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
        return {
          ...settings,
          outputPageRatio: "match-source",
          height: clamp(Math.round(settings.width / ratio), 600, 6000, 600),
        };
      }
      return {
        ...settings,
        outputPageRatio: "match-source",
        height: null,
      };
    }
    case "paper-format":
      return {
        ...settings,
        outputPageRatio: action.value,
        height: null,
      };
    case "width":
      return {
        ...settings,
        width: clamp(action.value, 800, 6000, settings.width),
      };
    case "height":
      return {
        ...settings,
        height: clamp(action.value, 600, 6000, 600),
      };
    case "quality-percent":
      return {
        ...settings,
        quality: clamp(action.value, 60, 98, 92) / 100,
      };
    case "enhancement":
      return {
        ...settings,
        enhancement: action.value,
      };
    case "fill-color":
      return {
        ...settings,
        fillColor: action.value,
      };
    case "fill-color-auto":
      return {
        ...settings,
        fillColor: "auto",
      };
  }
}
