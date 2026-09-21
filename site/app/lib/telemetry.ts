export const GA_MEASUREMENT_ID = "G-74RGGMV3PH";

export interface GtagWindow extends Window {
  gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
}

export function isTelemetryOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  const gtagWindow = window as unknown as GtagWindow;
  return gtagWindow[`ga-disable-${GA_MEASUREMENT_ID}`] === true;
}

export function setTelemetryOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  const gtagWindow = window as unknown as GtagWindow;
  if (optOut) {
    gtagWindow[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  } else {
    delete gtagWindow[`ga-disable-${GA_MEASUREMENT_ID}`];
    if (typeof gtagWindow.gtag === "function") {
      gtagWindow.gtag("config", GA_MEASUREMENT_ID);
    }
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (isTelemetryOptedOut()) return;

  const gtagWindow = window as unknown as GtagWindow;
  if (typeof gtagWindow.gtag === "function") {
    gtagWindow.gtag("event", name, params);
  }
}
