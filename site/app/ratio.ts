import { PRODUCT_METADATA } from "./product-metadata.ts";

export type BaseFormat = typeof PRODUCT_METADATA.ratios.web_source_base_formats[number]["id"];
export type Orientation = "landscape" | "portrait";
export type SourceFormat = typeof PRODUCT_METADATA.ratios.web_source_format_ids[number];
export type OutputPageRatio =
  | "match-source"
  | typeof PRODUCT_METADATA.ratios.web_output_ids[number];

export type SourceFormatSettings = {
  sourceFormat: SourceFormat;
  sourceOrientation: Orientation;
  sourceCustomRatio?: number;
};

export type PageLayoutMode = "match-source" | "paper" | "custom-size";

/** @deprecated Use SourceFormat or OutputPageRatio at the appropriate boundary. */
export type RatioValue = Exclude<OutputPageRatio, "match-source">;

export const WEB_SOURCE_BASE_FORMATS = PRODUCT_METADATA.ratios.web_source_base_formats;
export const WEB_SOURCE_FORMATS = PRODUCT_METADATA.ratios.web_source_formats;
export const WEB_OUTPUT_PAPER_FORMATS = PRODUCT_METADATA.ratios.paper.filter((item) => item.web);

const ratioPresets: Record<string, number> = Object.fromEntries(
  PRODUCT_METADATA.ratios.presentation.map((item) => [item.id.toLowerCase(), item.ratio]),
);
const paperPresetKeys = new Set<string>();

for (const item of PRODUCT_METADATA.ratios.paper) {
  for (const alias of item.aliases) {
    ratioPresets[alias.toLowerCase()] = item.ratio;
    paperPresetKeys.add(alias.toLowerCase());
  }
}

export const RATIO_PRESETS = ratioPresets;

export function isPaperRatio(value: string): boolean {
  if (!value) return false;
  return paperPresetKeys.has(value.trim().toLowerCase());
}

export function parseRatio(value: string): number {
  if (!value) return 16 / 9;
  const key = value.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(RATIO_PRESETS, key)) {
    return RATIO_PRESETS[key];
  }
  if (value.includes(":")) {
    const [w, h] = value.split(":").map(Number);
    if (Number.isFinite(w) && Number.isFinite(h) && h !== 0) {
      const ratio = w / h;
      if (Number.isFinite(ratio) && ratio > 0) {
        return ratio;
      }
    }
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 16 / 9;
}

export function defaultOrientationForBaseFormat(baseFormat: BaseFormat): Orientation {
  return WEB_SOURCE_BASE_FORMATS.find((format) => format.id === baseFormat)?.default_orientation ?? "landscape";
}

export function deriveSourceFormat(
  baseFormat: BaseFormat,
  orientation: Orientation,
): SourceFormat {
  if (baseFormat === "custom") return "custom";
  return WEB_SOURCE_FORMATS.find(
    (format) => format.base_id === baseFormat && format.orientation === orientation,
  )?.id ?? (baseFormat as SourceFormat);
}

export function splitSourceFormat(
  sourceFormat: string,
  customOrientation: Orientation = "landscape",
): { baseFormat: BaseFormat; orientation: Orientation } {
  if (sourceFormat === "custom") return { baseFormat: "custom", orientation: customOrientation };
  const format = WEB_SOURCE_FORMATS.find((item) => item.id === sourceFormat);
  if (format) return { baseFormat: format.base_id, orientation: format.orientation };
  return { baseFormat: "16:9", orientation: "landscape" };
}

export function sourceFormatRatioValue(settings: SourceFormatSettings): number {
  if (settings.sourceFormat === "custom") {
    const raw = Number.isFinite(settings.sourceCustomRatio)
      && (settings.sourceCustomRatio ?? 0) > 0
      ? settings.sourceCustomRatio ?? 16 / 9
      : 16 / 9;
    return settings.sourceOrientation === "portrait" ? 1 / raw : raw;
  }
  return parseRatio(settings.sourceFormat);
}

export function outputPageRatioValue(
  value: OutputPageRatio,
  sourceRatio: number,
): number {
  return value === "match-source" ? sourceRatio : parseRatio(value);
}

export function pdfPageDimensions(
  value: OutputPageRatio,
  fallbackWidth: number,
  fallbackHeight: number,
): [number, number] {
  const paper = PRODUCT_METADATA.ratios.paper.find((item) => item.id === value);
  return paper ? [paper.width_points, paper.height_points] : [fallbackWidth, fallbackHeight];
}

export function pageLayoutMode(
  outputPageRatio: OutputPageRatio,
  outputHeight: number | null,
): PageLayoutMode {
  if (outputHeight !== null) return "custom-size";
  return isPaperRatio(outputPageRatio) ? "paper" : "match-source";
}
