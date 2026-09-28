import assert from "node:assert/strict";
import test from "node:test";
import worker, { defaultAnalyticsAllowed } from "./worker.mjs";

test("only configured countries can use default analytics", () => {
  for (const country of ["US", "AU", "NZ"]) assert.equal(defaultAnalyticsAllowed(country), true);
  for (const country of ["FR", "DE", "GB", "CH", "BR", "CA", "XX", undefined, null]) {
    assert.equal(defaultAnalyticsAllowed(country), false);
  }
});

async function policy(country, origin = "https://slidesthief.com") {
  const request = new Request("https://analytics-policy.slidesthief.com/v1", {
    headers: { Origin: origin },
  });
  Object.defineProperty(request, "cf", { value: { country } });
  return worker.fetch(request);
}

test("response is a non-cacheable decision without location details", async () => {
  const allowed = await policy("US");
  assert.deepEqual(await allowed.json(), { version: 1, defaultAllowed: true });
  assert.equal(allowed.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://slidesthief.com");
  const blocked = await policy("FR");
  assert.deepEqual(await blocked.json(), { version: 1, defaultAllowed: false });
});

test("unknown location, unapproved origin, and other paths never allow default analytics", async () => {
  assert.deepEqual(await (await policy(undefined)).json(), { version: 1, defaultAllowed: false });
  assert.equal((await policy("US", "https://evil.example")).status, 403);
  assert.equal((await worker.fetch(new Request("https://analytics-policy.slidesthief.com/other"))).status, 404);
});
