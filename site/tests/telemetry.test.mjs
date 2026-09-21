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
    assert.equal(isTelemetryOptedOut(), false);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("isTelemetryOptedOut and setTelemetryOptOut control the window opt-out flag", () => {
  const originalWindow = globalThis.window;
  const mockWindow = {};
  globalThis.window = mockWindow;

  try {
    assert.equal(isTelemetryOptedOut(), false);

    setTelemetryOptOut(true);
    assert.equal(mockWindow[`ga-disable-${GA_MEASUREMENT_ID}`], true);
    assert.equal(isTelemetryOptedOut(), true);

    setTelemetryOptOut(false);
    assert.equal(mockWindow[`ga-disable-${GA_MEASUREMENT_ID}`], undefined);
    assert.equal(isTelemetryOptedOut(), false);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("setTelemetryOptOut(false) triggers gtag config if gtag is available", () => {
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
    setTelemetryOptOut(false);
    assert.equal(mockWindow[`ga-disable-${GA_MEASUREMENT_ID}`], undefined);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      command: "config",
      action: GA_MEASUREMENT_ID,
      params: undefined,
    });
  } finally {
    globalThis.window = originalWindow;
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
