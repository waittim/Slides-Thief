export type SourceSlideRatio =
  | "16:9"
  | "4:3"
  | "16:10"
  | "custom";

export type OutputPageRatio =
  | "match-slide"
  | "16:9"
  | "4:3"
  | "A4-landscape"
  | "A4-portrait"
  | "letter-landscape"
  | "letter-portrait";

/** @deprecated Use SourceSlideRatio or OutputPageRatio at the appropriate boundary. */
export type RatioValue = Exclude<OutputPageRatio, "match-slide">;

export const RATIO_PRESETS: Record<string, number> = {
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "16:10": 16 / 10,
  "a4": 297 / 210,
  "a4-landscape": 297 / 210,
  "a3": 297 / 210,
  "a3-landscape": 297 / 210,
  "a4-portrait": 210 / 297,
  "a3-portrait": 210 / 297,
  "letter": 11 / 8.5,
  "letter-landscape": 11 / 8.5,
  "letter-portrait": 8.5 / 11,
};

const PAPER_PRESET_KEYS = new Set([
  "a4",
  "a4-landscape",
  "a3",
  "a3-landscape",
  "a4-portrait",
  "a3-portrait",
  "letter",
  "letter-landscape",
  "letter-portrait",
]);

export function isPaperRatio(value: string): boolean {
  if (!value) return false;
  const key = value.trim().toLowerCase();
  return PAPER_PRESET_KEYS.has(key);
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

export function sourceSlideRatioValue(value: SourceSlideRatio, customRatio?: number): number {
  if (value === "custom") {
    return Number.isFinite(customRatio) && (customRatio ?? 0) > 0 ? customRatio! : 16 / 9;
  }
  return parseRatio(value);
}

export function outputPageRatioValue(
  value: OutputPageRatio,
  sourceRatio: number,
): number {
  return value === "match-slide" ? sourceRatio : parseRatio(value);
}
