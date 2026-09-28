// This service returns only a policy decision. It does not forward or persist IPs or country codes.
const DEFAULT_ALLOWED_COUNTRIES = new Set(["US", "AU", "NZ"]);
const ALLOWED_ORIGINS = new Set([
  "https://slidesthief.com",
  "https://www.slidesthief.com",
  "https://waittim.github.io",
  "https://slides-thief.waittim.chatgpt.site",
]);

export function defaultAnalyticsAllowed(country) {
  return DEFAULT_ALLOWED_COUNTRIES.has(country);
}

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    const headers = new Headers({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    });
    if (origin && isAllowedOrigin(origin)) headers.set("Access-Control-Allow-Origin", origin);
    if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403, headers });
    if (new URL(request.url).pathname !== "/v1") return new Response(null, { status: 404, headers });
    if (request.method !== "GET") return new Response(null, { status: 405, headers });

    const country = request.cf?.country;
    return new Response(JSON.stringify({ version: 1, defaultAllowed: defaultAnalyticsAllowed(country) }), {
      status: 200,
      headers,
    });
  },
};
