export const PDF_BASENAME_MAX_LENGTH = 100;

const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function sanitizePdfBaseName(value: string): string {
  const withoutExtension = value.replace(/\.pdf$/i, "");
  const safeCharacters = withoutExtension.replace(INVALID_FILENAME_CHARACTERS, "");
  return Array.from(safeCharacters).slice(0, PDF_BASENAME_MAX_LENGTH).join("");
}

function normalizePdfBase(value: string): string {
  let base = sanitizePdfBaseName(value).trim().replace(/[. ]+$/g, "");
  if (!base) base = "flattened_slides";
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
