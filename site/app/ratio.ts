export type SourceFormat =
  | "auto"
  | "16:9"
  | "4:3"
  | "16:10"
  | "A4-landscape"
  | "A4-portrait"
  | "letter-landscape"
  | "letter-portrait"
  | "custom";

export type OutputPageRatio =
  | "match-source"
  | "16:9"
  | "4:3"
  | "A4-landscape"
  | "A4-portrait"
  | "letter-landscape"
  | "letter-portrait";

export type PageLayoutMode = "match-source" | "paper" | "custom-size";

/** @deprecated Use SourceFormat or OutputPageRatio at the appropriate boundary. */
export type RatioValue = Exclude<OutputPageRatio, "match-source">;

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

const AUTO_SOURCE_RATIOS = [
  RATIO_PRESETS["16:9"],
  RATIO_PRESETS["16:10"],
  RATIO_PRESETS["a4-landscape"],
  RATIO_PRESETS["4:3"],
  RATIO_PRESETS["letter-landscape"],
  RATIO_PRESETS["letter-portrait"],
  RATIO_PRESETS["a4-portrait"],
];

export type BatchSourceRatioCandidate = {
  ratio: number;
  confidence?: number;
  reliable?: boolean;
};

export function nearestSourceFormatRatio(estimatedRatio: number): number {
  if (!Number.isFinite(estimatedRatio) || estimatedRatio <= 0) return RATIO_PRESETS["16:9"];
  return AUTO_SOURCE_RATIOS.reduce((nearest, candidate) =>
    Math.abs(Math.log(estimatedRatio / candidate)) < Math.abs(Math.log(estimatedRatio / nearest))
      ? candidate
      : nearest
  );
}

export function consensusSourceFormatRatio(
  candidates: BatchSourceRatioCandidate[],
): number {
  const valid = candidates.filter(({ ratio }) => Number.isFinite(ratio) && ratio > 0);
  if (!valid.length) return RATIO_PRESETS["16:9"];

  const reliable = valid.filter((candidate) => candidate.reliable !== false);
  const pool = reliable.length ? reliable : valid;
  const votes = new Map<number, number>();

  for (const candidate of pool) {
    const ratio = nearestSourceFormatRatio(candidate.ratio);
    const confidence = Number.isFinite(candidate.confidence)
      ? Math.max(0.1, Math.min(1, candidate.confidence!))
      : 0.5;
    votes.set(ratio, (votes.get(ratio) ?? 0) + confidence);
  }

  return AUTO_SOURCE_RATIOS.reduce((winner, ratio) =>
    (votes.get(ratio) ?? 0) > (votes.get(winner) ?? 0) ? ratio : winner
  );
}

export function sourceFormatRatioValue(
  value: SourceFormat,
  customRatio?: number,
  detectedRatio?: number,
): number {
  if (value === "auto") {
    return Number.isFinite(detectedRatio) && (detectedRatio ?? 0) > 0
      ? detectedRatio!
      : RATIO_PRESETS["16:9"];
  }
  if (value === "custom") {
    return Number.isFinite(customRatio) && (customRatio ?? 0) > 0 ? customRatio! : 16 / 9;
  }
  return parseRatio(value);
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
  if (value === "A4-landscape") return [841.89, 595.28];
  if (value === "A4-portrait") return [595.28, 841.89];
  if (value === "letter-landscape") return [792, 612];
  if (value === "letter-portrait") return [612, 792];
  return [fallbackWidth, fallbackHeight];
}

export function pageLayoutMode(
  outputPageRatio: OutputPageRatio,
  outputHeight: number | null,
): PageLayoutMode {
  if (outputHeight !== null) return "custom-size";
  return isPaperRatio(outputPageRatio) ? "paper" : "match-source";
}
