import assert from "node:assert/strict";
import test from "node:test";

const { createGlobalKeyDownHandler } = await import(
  new URL("../app/keyboard-shortcuts.ts", import.meta.url).href,
);

class TestKeyboardEvent extends Event {
  constructor(type, { key, metaKey = false, ctrlKey = false, shiftKey = false }) {
    super(type, { cancelable: true });
    Object.defineProperties(this, {
      key: { value: key },
      metaKey: { value: metaKey },
      ctrlKey: { value: ctrlKey },
      shiftKey: { value: shiftKey },
    });
  }
}

function readySlide() {
  return { id: "slide-1", status: "ready", quad: [[0, 0], [1, 0], [1, 1], [0, 1]] };
}

function actions(overrides = {}) {
  return {
    busy: false,
    isInfoOpen: false,
    slidesRef: { current: [] },
    selectedIdRef: { current: null },
    handleUndo() {},
    handleRedo() {},
    selectNextSlide() {},
    selectPrevSlide() {},
    deleteSlide() {},
    exportPdf() {},
    ...overrides,
  };
}

test("Ctrl+Enter dispatched after the initial empty render exports with the refreshed handler", () => {
  let exports = 0;
  const slidesRef = { current: [] };
  const windowTarget = new EventTarget();
  const initialReadyCount = slidesRef.current.length;
  const initialHandler = createGlobalKeyDownHandler(actions({
    slidesRef,
    exportPdf() {
      if (initialReadyCount > 0) exports += 1;
    },
  }));
  windowTarget.addEventListener("keydown", initialHandler);
  windowTarget.dispatchEvent(new TestKeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));

  slidesRef.current = [readySlide()];
  windowTarget.removeEventListener("keydown", initialHandler);
  const currentReadyCount = slidesRef.current.length;
  windowTarget.addEventListener("keydown", createGlobalKeyDownHandler(actions({
    slidesRef,
    exportPdf() {
      if (currentReadyCount > 0) exports += 1;
    },
  })));
  const event = new TestKeyboardEvent("keydown", { key: "Enter", ctrlKey: true });
  windowTarget.dispatchEvent(event);

  assert.equal(exports, 1);
  assert.equal(event.defaultPrevented, true);
});

test("Cmd+Enter is ignored while the app is busy", () => {
  let exports = 0;
  const current = actions({
    busy: true,
    slidesRef: { current: [readySlide()] },
    exportPdf() {
      exports += 1;
    },
  });
  const windowTarget = new EventTarget();
  windowTarget.addEventListener("keydown", createGlobalKeyDownHandler(current));

  windowTarget.dispatchEvent(new TestKeyboardEvent("keydown", { key: "Enter", metaKey: true }));

  assert.equal(exports, 0);
});
