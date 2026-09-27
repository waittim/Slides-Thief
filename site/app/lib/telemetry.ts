import { isAppErrorCode } from "./errors.ts";

export const GA_MEASUREMENT_ID = "G-74RGGMV3PH";

export interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (command: string, action: string | Date, params?: Record<string, unknown>) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
}

const ERROR_TYPES = new Set([
  "worker_failure",
  "slide_error",
  "worker_error",
  "export_worker_error",
  "export_worker_failure",
]);

export function isTelemetryOptedOut(): boolean {
  if (typeof window === "undefined") return true;
  return (window as unknown as GtagWindow)[`ga-disable-${GA_MEASUREMENT_ID}`] !== false;
}

export function setTelemetryOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  const gtagWindow = window as unknown as GtagWindow;
  const wasOptedOut = isTelemetryOptedOut();
  gtagWindow[`ga-disable-${GA_MEASUREMENT_ID}`] = optOut;
  if (optOut || !wasOptedOut) return;

  // Read saved preferences before calling this, so a previous opt-out never loads the script.
  gtagWindow.dataLayer ??= [];
  gtagWindow.gtag ??= (...args) => { gtagWindow.dataLayer?.push(args); };
  gtagWindow.gtag("js", new Date());
  // Keep URL query strings and referrers out of automatic page views.
  gtagWindow.gtag("config", GA_MEASUREMENT_ID, {
    page_location: "https://slidesthief.com/",
    page_title: "Slides Thief",
    page_referrer: "",
  });
  if (!document.querySelector(`script[data-analytics-id="${GA_MEASUREMENT_ID}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.analyticsId = GA_MEASUREMENT_ID;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.append(script);
  }
}

function safeCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** Restrict app-generated events to fixed names and non-identifying parameters. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (isTelemetryOptedOut()) return;
  const gtag = (window as unknown as GtagWindow).gtag;
  if (typeof gtag !== "function") return;

  if (name === "image_import") {
    const count = safeCount(params.count);
    if (count === undefined || typeof params.has_heif !== "boolean") return;
    gtag("event", name, { count, has_heif: params.has_heif });
  } else if (name === "pdf_export_success" || name === "jpg_export_success") {
    const pageCount = safeCount(params.page_count);
    const fileSize = safeCount(params.file_size_bytes);
    if (pageCount === undefined || fileSize === undefined) return;
    gtag("event", name, { page_count: pageCount, file_size_bytes: fileSize });
  } else if (name === "corner_adjusted") {
    gtag("event", name);
  } else if (name === "processing_error") {
    const errorType = ERROR_TYPES.has(params.error_type as string) ? params.error_type : "unknown";
    const errorCode = isAppErrorCode(params.error_code) ? params.error_code : "unknown";
    gtag("event", name, { error_type: errorType, error_code: errorCode });
  }
}
