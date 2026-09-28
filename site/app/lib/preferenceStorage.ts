import { enhancementModes, type EnhancementMode } from "../enhance.ts";
import { sanitizePdfBaseName } from "../filename.ts";
import type { LocaleValue } from "../i18n.ts";
import { PRODUCT_METADATA } from "../product-metadata.ts";
import type { OutputPageRatio, SourceFormat } from "../ratio.ts";
import { defaultSettings, type Settings, type ThemeValue } from "./types.ts";

export const PREFERENCES_STORAGE_KEY = "slides_thief_user_preferences";
export const ANALYTICS_CONSENT_VERSION = 1;

export interface AnalyticsConsent {
  version: typeof ANALYTICS_CONSENT_VERSION;
  granted: boolean;
  decidedAt: string;
}

export interface StoredPreferences {
  version?: number;
  theme?: ThemeValue;
  explicitLocale?: LocaleValue | null;
  settings?: Partial<Settings>;
  pdfBaseName?: string;
  telemetry?: boolean;
  analyticsConsent?: AnalyticsConsent;
}

/** Older telemetry:true values may have been defaults, so they are not proof of consent. */
export function shouldEnableTelemetry(stored: StoredPreferences | null, consentRequired: boolean): boolean {
  if (stored?.telemetry === false || stored?.analyticsConsent?.granted === false) return false;
  return !consentRequired || stored?.analyticsConsent?.granted === true;
}

export function hasAnalyticsChoice(stored: StoredPreferences | null): boolean {
  return stored?.telemetry === false || stored?.analyticsConsent !== undefined;
}

const VALID_THEMES = new Set<ThemeValue>(["auto", "light", "dark"]);
const VALID_LOCALES = new Set<LocaleValue>([
  "zh-CN",
  "zh-TW",
  "en",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
  "pt-BR",
]);
const VALID_ENHANCEMENTS = new Set<EnhancementMode>(enhancementModes);
const VALID_SOURCE_FORMATS = new Set<string>([
  ...PRODUCT_METADATA.ratios.web_source_format_ids,
  "custom",
]);
const VALID_OUTPUT_PAGE_RATIOS = new Set<string>([
  "match-source",
  ...PRODUCT_METADATA.ratios.web_output_ids,
]);

function clamp(value: number, min: number, max: number, fallback: number): number {
  const candidate = Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, candidate));
}

export function sanitizeSettings(input: unknown): Settings {
  if (typeof input !== "object" || input === null) {
    return { ...defaultSettings };
  }

  const record = input as Record<string, unknown>;
  const result: Settings = { ...defaultSettings };

  if (typeof record.sourceFormat === "string" && VALID_SOURCE_FORMATS.has(record.sourceFormat)) {
    result.sourceFormat = record.sourceFormat as SourceFormat;
  }

  if (record.sourceOrientation === "landscape" || record.sourceOrientation === "portrait") {
    result.sourceOrientation = record.sourceOrientation;
  }

  if (typeof record.sourceCustomRatio === "number" && Number.isFinite(record.sourceCustomRatio)) {
    result.sourceCustomRatio = clamp(record.sourceCustomRatio, 0.2, 5, 16 / 9);
  }

  if (typeof record.outputPageRatio === "string" && VALID_OUTPUT_PAGE_RATIOS.has(record.outputPageRatio)) {
    result.outputPageRatio = record.outputPageRatio as OutputPageRatio;
  }

  if (typeof record.width === "number" && Number.isFinite(record.width)) {
    result.width = clamp(record.width, 800, 6000, defaultSettings.width);
  }

  if (record.height === null) {
    result.height = null;
  } else if (typeof record.height === "number" && Number.isFinite(record.height)) {
    result.height = clamp(record.height, 600, 6000, 600);
  }

  if (typeof record.quality === "number" && Number.isFinite(record.quality)) {
    result.quality = clamp(record.quality, 0.6, 0.98, defaultSettings.quality);
  }

  if (typeof record.enhancement === "string" && VALID_ENHANCEMENTS.has(record.enhancement as EnhancementMode)) {
    result.enhancement = record.enhancement as EnhancementMode;
  }

  if (typeof record.fillColor === "string") {
    if (record.fillColor === "auto" || /^#[0-9a-fA-F]{6}$/.test(record.fillColor)) {
      result.fillColor = record.fillColor;
    }
  }

  return result;
}

export function sanitizeStoredPreferences(input: unknown): StoredPreferences {
  if (typeof input !== "object" || input === null) {
    return {};
  }

  const record = input as Record<string, unknown>;
  const result: StoredPreferences = {};

  if (record.version === 1 || record.version === 2 || record.version === 3) {
    result.version = record.version;
  }

  if (typeof record.theme === "string" && VALID_THEMES.has(record.theme as ThemeValue)) {
    result.theme = record.theme as ThemeValue;
  }

  if (record.explicitLocale === null) {
    result.explicitLocale = null;
  } else if (typeof record.explicitLocale === "string") {
    result.explicitLocale = VALID_LOCALES.has(record.explicitLocale as LocaleValue)
      ? (record.explicitLocale as LocaleValue)
      : null;
  }

  if (typeof record.pdfBaseName === "string") {
    result.pdfBaseName = sanitizePdfBaseName(record.pdfBaseName);
  }

  if (typeof record.settings === "object" && record.settings !== null) {
    result.settings = sanitizeSettings(record.settings);
  }

  if (typeof record.telemetry === "boolean") {
    result.telemetry = record.telemetry;
  }

  if (typeof record.analyticsConsent === "object" && record.analyticsConsent !== null) {
    const consent = record.analyticsConsent as Record<string, unknown>;
    if (
      consent.version === ANALYTICS_CONSENT_VERSION &&
      typeof consent.granted === "boolean" &&
      typeof consent.decidedAt === "string" &&
      Number.isFinite(Date.parse(consent.decidedAt))
    ) {
      result.analyticsConsent = {
        version: ANALYTICS_CONSENT_VERSION,
        granted: consent.granted,
        decidedAt: consent.decidedAt,
      };
    }
  }

  return result;
}

export function loadStoredPreferences(): StoredPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeStoredPreferences(parsed);
  } catch {
    return null;
  }
}

export function saveStoredPreferences(prefs: StoredPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Safely ignore QuotaExceededError or SecurityError
  }
}

export function clearStoredPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    // Safely ignore SecurityError
  }
}
