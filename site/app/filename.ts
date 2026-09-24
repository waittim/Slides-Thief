export const PDF_BASENAME_MAX_LENGTH = 100;
export const DEFAULT_PDF_BASENAME = "flattened_slides";

const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const INVALID_FILENAME_CHARS_TEST = /[\u0000-\u001f\u007f<>:"/\\|?*]/;
export const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export type PdfBaseNameValidationReason =
  | "invalid_characters"
  | "invalid_extension"
  | "trailing_dot_or_space"
  | "reserved_name";

export interface PdfBaseNameValidationResult {
  isValid: boolean;
  reason?: PdfBaseNameValidationReason;
}

export function validatePdfBaseName(value: string): PdfBaseNameValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    if (value.length > 0) {
      return { isValid: false, reason: "trailing_dot_or_space" };
    }
    return { isValid: true };
  }

  if (INVALID_FILENAME_CHARS_TEST.test(value)) {
    return { isValid: false, reason: "invalid_characters" };
  }

  if (/\.pdf$/i.test(trimmed)) {
    return { isValid: false, reason: "invalid_extension" };
  }

  if (/[. ]+$/.test(value)) {
    return { isValid: false, reason: "trailing_dot_or_space" };
  }

  if (WINDOWS_RESERVED_NAME.test(trimmed)) {
    return { isValid: false, reason: "reserved_name" };
  }

  return { isValid: true };
}

export function sanitizePdfBaseName(value: string): string {
  const withoutExtension = value.replace(/\.pdf$/i, "");
  const safeCharacters = withoutExtension.replace(INVALID_FILENAME_CHARACTERS, "");
  return Array.from(safeCharacters).slice(0, PDF_BASENAME_MAX_LENGTH).join("");
}

function normalizePdfBase(value: string): string {
  let base = sanitizePdfBaseName(value).trim().replace(/[. ]+$/g, "");
  if (!base) base = DEFAULT_PDF_BASENAME;
  if (WINDOWS_RESERVED_NAME.test(base)) base = `_${base}`;
  return base;
}

export function normalizePdfName(value: string): string {
  return `${normalizePdfBase(value)}.pdf`;
}

export function normalizeSingleJpgName(value: string): string {
  return `${normalizePdfBase(value)}-001.jpg`;
}

export function normalizeJpgZipName(value: string): string {
  return `${normalizePdfBase(value)}-images.zip`;
}

export function formatZipSlideEntryName(index: number, totalSlides: number, originalName: string): string {
  const padLength = Math.max(3, String(totalSlides).length);
  const prefix = String(index + 1).padStart(padLength, "0");
  let stem = originalName
    .replace(/\.[^/.]+$/, "")
    .replace(INVALID_FILENAME_CHARACTERS, "")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");
  stem = Array.from(stem).slice(0, PDF_BASENAME_MAX_LENGTH).join("");
  if (!stem) stem = "slide";
  return `${prefix}-${stem}.jpg`;
}

export interface MiddleTruncateOptions {
  maxLength?: number;
  preserveExtension?: boolean;
  ellipsis?: string;
}

export function truncateMiddle(
  name: string,
  maxLength: number = 24,
  options: MiddleTruncateOptions = {}
): string {
  if (!name) return "";
  const {
    preserveExtension = true,
    ellipsis = "...",
  } = options;

  const codePoints = Array.from(name);
  if (codePoints.length <= maxLength) {
    return name;
  }

  const ellipsisCodePoints = Array.from(ellipsis);
  const ellipsisLen = ellipsisCodePoints.length;

  if (maxLength <= ellipsisLen + 1) {
    return codePoints.slice(0, maxLength).join("");
  }

  if (preserveExtension) {
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < name.length - 1) {
      const ext = name.slice(lastDotIndex);
      if (ext.length <= 8 && !/\s/.test(ext)) {
        const stem = name.slice(0, lastDotIndex);
        const stemCodePoints = Array.from(stem);
        const extCodePoints = Array.from(ext);

        const minStemChars = 2;
        if (extCodePoints.length + ellipsisLen + minStemChars <= maxLength) {
          const availableStem = maxLength - extCodePoints.length - ellipsisLen;
          let headCount = Math.ceil(availableStem / 2);
          let tailCount = availableStem - headCount;

          const trailingNumberMatch = stem.match(/[_-]?\d+$/);
          if (trailingNumberMatch) {
            const numLen = Array.from(trailingNumberMatch[0]).length;
            if (numLen > tailCount && numLen <= availableStem - 2) {
              tailCount = numLen;
              headCount = availableStem - tailCount;
            }
          }

          const head = stemCodePoints.slice(0, headCount).join("");
          const tail = tailCount > 0 ? stemCodePoints.slice(-tailCount).join("") : "";
          return `${head}${ellipsis}${tail}${ext}`;
        }
      }
    }
  }

  const available = maxLength - ellipsisLen;
  let headCount = Math.ceil(available / 2);
  let tailCount = available - headCount;

  const trailingNumberMatch = name.match(/[_-]?\d+$/);
  if (trailingNumberMatch) {
    const numLen = Array.from(trailingNumberMatch[0]).length;
    if (numLen > tailCount && numLen <= available - 2) {
      tailCount = numLen;
      headCount = available - tailCount;
    }
  }

  const head = codePoints.slice(0, headCount).join("");
  const tail = tailCount > 0 ? codePoints.slice(-tailCount).join("") : "";
  return `${head}${ellipsis}${tail}`;
}

export function stripFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

export interface DisplayFileNameOptions {
  isMobile?: boolean;
  maxLength?: number;
  preserveExtension?: boolean;
  hideExtension?: boolean;
  ellipsis?: string;
}

export const DISPLAY_FILENAME_MAX_LENGTH_DESKTOP = 26;
export const DISPLAY_FILENAME_MAX_LENGTH_MOBILE = 24;

export function displayFileName(
  name: string,
  isMobileOrOptionsOrMax?: boolean | number | DisplayFileNameOptions,
  customMaxLength?: number
): string {
  if (!name) return "";

  let isMobile = false;
  let hideExtension = false;
  let maxLength: number | undefined;
  let ellipsis = "...";

  if (typeof isMobileOrOptionsOrMax === "number") {
    maxLength = isMobileOrOptionsOrMax;
  } else if (typeof isMobileOrOptionsOrMax === "boolean") {
    isMobile = isMobileOrOptionsOrMax;
    maxLength = customMaxLength ?? (isMobile ? DISPLAY_FILENAME_MAX_LENGTH_MOBILE : DISPLAY_FILENAME_MAX_LENGTH_DESKTOP);
  } else if (isMobileOrOptionsOrMax && typeof isMobileOrOptionsOrMax === "object") {
    isMobile = Boolean(isMobileOrOptionsOrMax.isMobile);
    hideExtension = Boolean(isMobileOrOptionsOrMax.hideExtension);
    maxLength = customMaxLength ?? isMobileOrOptionsOrMax.maxLength;
    ellipsis = isMobileOrOptionsOrMax.ellipsis ?? "...";
  }

  if (maxLength === undefined) {
    maxLength = isMobile ? DISPLAY_FILENAME_MAX_LENGTH_MOBILE : DISPLAY_FILENAME_MAX_LENGTH_DESKTOP;
  }

  if (hideExtension) {
    const stem = stripFileExtension(name);
    return truncateMiddle(stem, maxLength, {
      preserveExtension: false,
      ellipsis,
    });
  }

  return truncateMiddle(name, maxLength, {
    preserveExtension: true,
    ellipsis,
  });
}
