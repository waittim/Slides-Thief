/** Only a configured edge decision may allow analytics without a prior choice. */
export const ANALYTICS_POLICY_URL = import.meta.env.VITE_ANALYTICS_POLICY_URL || "https://analytics-policy.slidesthief.com/v1";

export async function requiresAnalyticsConsent(signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(ANALYTICS_POLICY_URL, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) return true;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || (body as Record<string, unknown>).version !== 1) return true;
    return (body as Record<string, unknown>).defaultAllowed !== true;
  } catch {
    return true;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
