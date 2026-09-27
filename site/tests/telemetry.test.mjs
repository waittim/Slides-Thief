import assert from "node:assert/strict";
import test from "node:test";

const {
  GA_MEASUREMENT_ID,
  isTelemetryOptedOut,
  setTelemetryOptOut,
  trackEvent,
} = await import(new URL("../app/lib/telemetry.ts", import.meta.url).href);

test("GA_MEASUREMENT_ID is defined as expected", () => {
  assert.equal(GA_MEASUREMENT_ID, "G-74RGGMV3PH");
});

test("isTelemetryOptedOut handles missing window gracefully", () => {
  const originalWindow = globalThis.window;
  delete globalThis.window;
  try {
    assert.equal(isTelemetryOptedOut(), true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("analytics stays inactive until preferences are checked and the enabled tag loads", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const mockWindow = {};
  const appended = [];
  globalThis.window = mockWindow;
  globalThis.document = {
    querySelector: () => appended[0] ?? null,
    createElement: () => ({ dataset: {} }),
    head: { append: (script) => appended.push(script) },
  };

  try {
    assert.equal(isTelemetryOptedOut(), true);
    trackEvent("image_import", { count: 1, has_heif: false });
    assert.equal(appended.length, 0);

    setTelemetryOptOut(false);
    assert.equal(mockWindow[`ga-disable-${GA_MEASUREMENT_ID}`], false);
    assert.equal(isTelemetryOptedOut(), false);
    assert.equal(appended.length, 1);
    assert.match(appended[0].src, /googletagmanager\.com\/gtag\/js/);

    setTelemetryOptOut(true);
    assert.equal(isTelemetryOptedOut(), true);
    setTelemetryOptOut(false);
    assert.equal(appended.length, 1, "re-enabling must not inject the script twice");
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("setTelemetryOptOut(false) triggers gtag config when enabled", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const events = [];
  const mockWindow = {
    gtag: (command, action, params) => {
      events.push({ command, action, params });
    },
    [`ga-disable-${GA_MEASUREMENT_ID}`]: true,
  };
  globalThis.window = mockWindow;
  globalThis.document = {
    querySelector: () => ({}),
  };

  try {
    setTelemetryOptOut(false);
    assert.equal(mockWindow[`ga-disable-${GA_MEASUREMENT_ID}`], false);
    assert.deepEqual(events.at(-1), {
      command: "config",
      action: GA_MEASUREMENT_ID,
      params: {
        page_location: "https://slidesthief.com/",
        page_title: "Slides Thief",
        page_referrer: "",
      },
    });
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("trackEvent blocks event reporting when telemetry is opted out", () => {
  const originalWindow = globalThis.window;
  const events = [];
  const mockWindow = {
    gtag: (command, action, params) => {
      events.push({ command, action, params });
    },
    [`ga-disable-${GA_MEASUREMENT_ID}`]: true,
  };
  globalThis.window = mockWindow;

  try {
    trackEvent("image_import", { count: 5 });
    assert.equal(events.length, 0);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("trackEvent forwards events to gtag when telemetry is enabled", () => {
  const originalWindow = globalThis.window;
  const events = [];
  const mockWindow = {
    [`ga-disable-${GA_MEASUREMENT_ID}`]: false,
    gtag: (command, action, params) => {
      events.push({ command, action, params });
    },
  };
  globalThis.window = mockWindow;

  try {
    trackEvent("image_import", { count: 3, has_heif: false });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      command: "event",
      action: "image_import",
      params: { count: 3, has_heif: false },
    });
  } finally {
    globalThis.window = originalWindow;
  }
});

test("trackEvent strips filenames, error text, and unknown parameters", () => {
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = {
    [`ga-disable-${GA_MEASUREMENT_ID}`]: false,
    gtag: (command, action, params) => events.push({ command, action, params }),
  };
  try {
    trackEvent("corner_adjusted", { slide_id: "private-name.heic" });
    trackEvent("processing_error", {
      error_type: "slide_error",
      error_code: "private-name.heic",
      error_message: "Could not open private-name.heic",
    });
    trackEvent("image_import", { count: 1, has_heif: true, filename: "private-name.heic" });
    trackEvent("arbitrary_event", { filename: "private-name.heic" });
    assert.deepEqual(events, [
      { command: "event", action: "corner_adjusted", params: undefined },
      { command: "event", action: "processing_error", params: { error_type: "slide_error", error_code: "unknown" } },
      { command: "event", action: "image_import", params: { count: 1, has_heif: true } },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /private-name/);
  } finally {
    globalThis.window = originalWindow;
  }
});
