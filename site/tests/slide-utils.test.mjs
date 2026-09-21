import test from "node:test";
import assert from "node:assert/strict";

const { isIOSUserAgent, triggerDownload } = await import(
  new URL("../app/lib/slide-utils.ts", import.meta.url).href
);

test("isIOSUserAgent accurately identifies iPhone, iPad, and iPod", () => {
  const iPhoneUA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const iPadUA =
    "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
  const iPodUA =
    "Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15";

  assert.equal(isIOSUserAgent(iPhoneUA, "iPhone", 5), true);
  assert.equal(isIOSUserAgent(iPadUA, "iPad", 5), true);
  assert.equal(isIOSUserAgent(iPodUA, "iPod", 5), true);
});

test("isIOSUserAgent identifies iPadOS desktop-class Safari (MacIntel with touch points)", () => {
  const iPadOSDesktopUA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

  // iPadOS reports MacIntel platform but has maxTouchPoints > 1
  assert.equal(isIOSUserAgent(iPadOSDesktopUA, "MacIntel", 5), true);
  assert.equal(isIOSUserAgent(iPadOSDesktopUA, "MacIntel", 2), true);
});

test("isIOSUserAgent returns false for macOS desktop (MacIntel with 0 or 1 touch points)", () => {
  const macDesktopUA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

  assert.equal(isIOSUserAgent(macDesktopUA, "MacIntel", 0), false);
  assert.equal(isIOSUserAgent(macDesktopUA, "MacIntel", 1), false);
});

test("isIOSUserAgent returns false for Android, Windows, and Linux", () => {
  const androidUA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
  const windowsUA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  const linuxUA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  assert.equal(isIOSUserAgent(androidUA, "Linux armv8l", 5), false);
  assert.equal(isIOSUserAgent(windowsUA, "Win32", 0), false);
  assert.equal(isIOSUserAgent(linuxUA, "Linux x86_64", 0), false);
});

test("triggerDownload handles iOS and non-iOS branches", () => {
  let openedUrl = null;
  let openedTarget = null;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  let createdElement = null;
  let appendedChild = null;
  let removed = false;

  try {
    globalThis.window = {
      open: (url, target) => {
        openedUrl = url;
        openedTarget = target;
        return {};
      },
    };

    globalThis.document = {
      body: {
        appendChild: (el) => {
          appendedChild = el;
        },
      },
      createElement: (tag) => {
        createdElement = {
          tagName: tag,
          href: "",
          download: "",
          rel: "",
          remove: () => {
            removed = true;
          },
        };
        return createdElement;
      },
    };

    // On iOS: calls window.open with _blank
    triggerDownload("blob:http://localhost/test.pdf", "test.pdf", true);
    assert.equal(openedUrl, "blob:http://localhost/test.pdf");
    assert.equal(openedTarget, "_blank");

    // On non-iOS: creates <a> element with download attribute and removes it
    triggerDownload("blob:http://localhost/test.pdf", "test.pdf", false);
    assert.ok(createdElement);
    assert.equal(createdElement.download, "test.pdf");
    assert.equal(createdElement.href, "blob:http://localhost/test.pdf");
    assert.equal(createdElement.rel, "noopener noreferrer");
    assert.equal(appendedChild, createdElement);
    assert.equal(removed, true);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
