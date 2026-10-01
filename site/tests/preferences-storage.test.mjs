import assert from "node:assert/strict";
import test from "node:test";

const {
  PREFERENCES_STORAGE_KEY,
  loadStoredPreferences,
  saveStoredPreferences,
  clearStoredPreferences,
  sanitizeSettings,
  sanitizeStoredPreferences,
  shouldEnableTelemetry,
  hasAnalyticsChoice,
  ANALYTICS_CONSENT_VERSION,
  ANALYTICS_CONSENT_EXPIRATION_DAYS,
  ANALYTICS_CONSENT_EXPIRATION_MS,
  isAnalyticsConsentExpired,
} = await import(
  new URL("../app/lib/preferenceStorage.ts", import.meta.url).href
);
const { defaultSettings } = await import(
  new URL("../app/lib/types.ts", import.meta.url).href
);

// Helper to mock window.localStorage
function mockLocalStorage(store = {}) {
  const storage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  globalThis.window = { localStorage: storage };
  return storage;
}

function restoreWindow() {
  delete globalThis.window;
}

test("default analytics requires an edge allowance or a recorded opt-in", () => {
  const consent = { version: ANALYTICS_CONSENT_VERSION, granted: true, decidedAt: "2026-09-27T00:00:00.000Z" };
  assert.equal(shouldEnableTelemetry(null, false), true);
  assert.equal(shouldEnableTelemetry(null, true), false);
  assert.equal(shouldEnableTelemetry({ version: 2, telemetry: true }, true), false);
  assert.equal(shouldEnableTelemetry({ version: 2, telemetry: false }, false), false);
  assert.equal(shouldEnableTelemetry({ version: 3, telemetry: true, analyticsConsent: consent }, true), true);
  assert.equal(shouldEnableTelemetry({ version: 3, telemetry: false, analyticsConsent: consent }, true), false);
  assert.equal(hasAnalyticsChoice({ version: 2, telemetry: true }), false);
  assert.equal(hasAnalyticsChoice({ version: 2, telemetry: false }), true);
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consent }), true);
});

test("consent and opt-out expire after 180 days", () => {
  const baseTime = Date.parse("2026-09-27T00:00:00.000Z");
  const consentGranted = {
    version: ANALYTICS_CONSENT_VERSION,
    granted: true,
    decidedAt: "2026-09-27T00:00:00.000Z",
  };
  const consentDenied = {
    version: ANALYTICS_CONSENT_VERSION,
    granted: false,
    decidedAt: "2026-09-27T00:00:00.000Z",
  };

  assert.equal(ANALYTICS_CONSENT_EXPIRATION_DAYS, 180);
  assert.equal(ANALYTICS_CONSENT_EXPIRATION_MS, 180 * 24 * 60 * 60 * 1000);

  // Invalid or missing decidedAt is considered expired
  assert.equal(isAnalyticsConsentExpired(undefined, baseTime), true);
  assert.equal(isAnalyticsConsentExpired({}, baseTime), true);
  assert.equal(isAnalyticsConsentExpired({ decidedAt: "invalid" }, baseTime), true);

  // Exactly within 180 days (e.g. 179 days later)
  const day179 = baseTime + 179 * 24 * 60 * 60 * 1000;
  assert.equal(isAnalyticsConsentExpired(consentGranted, day179), false);
  assert.equal(isAnalyticsConsentExpired(consentDenied, day179), false);
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consentGranted }, day179), true);
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consentDenied }, day179), true);
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentGranted }, true, day179), true);
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentDenied }, true, day179), false);

  // Exactly 180 days
  const day180 = baseTime + 180 * 24 * 60 * 60 * 1000;
  assert.equal(isAnalyticsConsentExpired(consentGranted, day180), false);
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consentGranted }, day180), true);

  // Expired: 181 days later
  const day181 = baseTime + 181 * 24 * 60 * 60 * 1000;
  assert.equal(isAnalyticsConsentExpired(consentGranted, day181), true);
  assert.equal(isAnalyticsConsentExpired(consentDenied, day181), true);

  // Expired choice means hasAnalyticsChoice is false -> prompts again
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consentGranted }, day181), false);
  assert.equal(hasAnalyticsChoice({ analyticsConsent: consentDenied }, day181), false);

  // When expired, telemetry cannot be enabled until user re-consents
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentGranted }, true, day181), false);
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentDenied }, true, day181), false);
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentGranted }, false, day181), false);
  assert.equal(shouldEnableTelemetry({ analyticsConsent: consentDenied }, false, day181), false);
});

test("sanitizeSettings handles empty or non-object input by returning defaultSettings", () => {
  assert.deepEqual(sanitizeSettings(null), defaultSettings);
  assert.deepEqual(sanitizeSettings(undefined), defaultSettings);
  assert.deepEqual(sanitizeSettings("invalid"), defaultSettings);
  assert.deepEqual(sanitizeSettings(42), defaultSettings);
});

test("sanitizeSettings clamps out-of-range dimensions and quality", () => {
  const clamped = sanitizeSettings({
    width: 99999,
    height: 100,
    quality: 0.1,
    sourceCustomRatio: 10,
  });

  assert.equal(clamped.width, 6000);
  assert.equal(clamped.height, 600);
  assert.equal(clamped.quality, 0.6);
  assert.equal(clamped.sourceCustomRatio, 5);

  const clampedLow = sanitizeSettings({
    width: 200,
    height: null,
    quality: 1.5,
    sourceCustomRatio: 0.05,
  });

  assert.equal(clampedLow.width, 800);
  assert.equal(clampedLow.height, null);
  assert.equal(clampedLow.quality, 0.98);
  assert.equal(clampedLow.sourceCustomRatio, 0.2);
});

test("sanitizeSettings validates enhancement mode and fillColor", () => {
  const invalid = sanitizeSettings({
    enhancement: "hyper-saturated",
    fillColor: "invalid-color",
  });
  assert.equal(invalid.enhancement, "original");
  assert.equal(invalid.fillColor, "auto");

  const valid = sanitizeSettings({
    enhancement: "clean",
    fillColor: "#ff0080",
  });
  assert.equal(valid.enhancement, "clean");
  assert.equal(valid.fillColor, "#ff0080");
});

test("sanitizeStoredPreferences validates theme and explicitLocale", () => {
  assert.deepEqual(sanitizeStoredPreferences(null), {});
  assert.deepEqual(sanitizeStoredPreferences("not an object"), {});

  const invalid = sanitizeStoredPreferences({
    theme: "neon",
    explicitLocale: "klingon",
    pdfBaseName: "bad\u0000/name?.pdf",
  });
  assert.equal(invalid.theme, undefined);
  assert.equal(invalid.explicitLocale, null);
  assert.equal(invalid.pdfBaseName, "badname");

  const valid = sanitizeStoredPreferences({
    theme: "dark",
    explicitLocale: "zh-CN",
    pdfBaseName: "my_presentation",
  });
  assert.equal(valid.theme, "dark");
  assert.equal(valid.explicitLocale, "zh-CN");
  assert.equal(valid.pdfBaseName, "my_presentation");

  const autoLocale = sanitizeStoredPreferences({
    explicitLocale: null,
  });
  assert.equal(autoLocale.explicitLocale, null);

  const telemetryFalse = sanitizeStoredPreferences({ telemetry: false });
  assert.equal(telemetryFalse.telemetry, false);

  const telemetryTrue = sanitizeStoredPreferences({ telemetry: true });
  assert.equal(telemetryTrue.telemetry, true);

  const telemetryInvalid = sanitizeStoredPreferences({ telemetry: "false" });
  assert.equal(telemetryInvalid.telemetry, undefined);

  const consent = sanitizeStoredPreferences({ version: 3, analyticsConsent: { version: 1, granted: true, decidedAt: "2026-09-27T00:00:00.000Z" } });
  assert.equal(consent.analyticsConsent.granted, true);
  assert.equal(sanitizeStoredPreferences({ analyticsConsent: { version: 1, granted: true } }).analyticsConsent, undefined);
  assert.equal(sanitizeStoredPreferences({ analyticsConsent: { version: 2, granted: true, decidedAt: "2026-09-27T00:00:00.000Z" } }).analyticsConsent, undefined);
});

test("loadStoredPreferences and saveStoredPreferences round-trip with localStorage", () => {
  const store = {};
  mockLocalStorage(store);

  try {
    assert.equal(loadStoredPreferences(), null);

    const prefs = {
      version: 1,
      theme: "dark",
      explicitLocale: "ja",
      pdfBaseName: "conf_slides",
      telemetry: false,
      settings: sanitizeSettings({
        width: 1920,
        quality: 0.88,
        enhancement: "high-contrast",
      }),
    };

    saveStoredPreferences(prefs);
    assert.ok(store[PREFERENCES_STORAGE_KEY]);

    const loaded = loadStoredPreferences();
    assert.equal(loaded.theme, "dark");
    assert.equal(loaded.explicitLocale, "ja");
    assert.equal(loaded.pdfBaseName, "conf_slides");
    assert.equal(loaded.telemetry, false);
    assert.equal(loaded.settings.width, 1920);
    assert.equal(loaded.settings.quality, 0.88);
    assert.equal(loaded.settings.enhancement, "high-contrast");

    clearStoredPreferences();
    assert.equal(store[PREFERENCES_STORAGE_KEY], undefined);
    assert.equal(loadStoredPreferences(), null);
  } finally {
    restoreWindow();
  }
});

test("loadStoredPreferences returns null on corrupt JSON", () => {
  mockLocalStorage({
    [PREFERENCES_STORAGE_KEY]: "{ corrupt JSON !!!",
  });

  try {
    assert.equal(loadStoredPreferences(), null);
  } finally {
    restoreWindow();
  }
});

test("loadStoredPreferences and saveStoredPreferences handle Storage exceptions gracefully", () => {
  // Simulates Safari Private Browsing SecurityError or quota exceeded
  globalThis.window = {
    get localStorage() {
      throw new Error("SecurityError: The operation is insecure.");
    },
  };

  try {
    assert.doesNotThrow(() => {
      const res = loadStoredPreferences();
      assert.equal(res, null);
    });

    assert.doesNotThrow(() => {
      saveStoredPreferences({ theme: "light" });
    });

    assert.doesNotThrow(() => {
      clearStoredPreferences();
    });
  } finally {
    restoreWindow();
  }
});
