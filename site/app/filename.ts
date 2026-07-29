export const PDF_BASENAME_MAX_LENGTH = 100;

const INVALID_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function sanitizePdfBaseName(value: string): string {
  const withoutExtension = value.replace(/\.pdf$/i, "");
  const safeCharacters = withoutExtension.replace(INVALID_FILENAME_CHARACTERS, "");
  return Array.from(safeCharacters).slice(0, PDF_BASENAME_MAX_LENGTH).join("");
}

export function normalizePdfName(value: string): string {
  let base = sanitizePdfBaseName(value).trim().replace(/[. ]+$/g, "");
  if (!base) base = "flattened_slides";
  if (WINDOWS_RESERVED_NAME.test(base)) base = `_${base}`;
  return `${base}.pdf`;
}
