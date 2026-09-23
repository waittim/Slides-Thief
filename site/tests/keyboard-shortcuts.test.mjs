import assert from "node:assert/strict";
import test from "node:test";

const { createGlobalKeyDownHandler } = await import(
  new URL("../app/keyboard-shortcuts.ts", import.meta.url).href,
);

class TestKeyboardEvent extends Event {
  constructor(type, { key, metaKey = false, ctrlKey = false, shiftKey = false, altKey = false }) {
    super(type, { cancelable: true });
    Object.defineProperties(this, {
      key: { value: key },
      metaKey: { value: metaKey },
      ctrlKey: { value: ctrlKey },
      shiftKey: { value: shiftKey },
      altKey: { value: altKey },
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

test("Delete and Backspace invoke deleteSlide for selected slide", () => {
  let deletedId = null;
  const current = actions({
    slidesRef: { current: [readySlide()] },
    selectedIdRef: { current: "slide-1" },
    deleteSlide(id) {
      deletedId = id;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const event1 = new TestKeyboardEvent("keydown", { key: "Delete" });
  target.dispatchEvent(event1);
  assert.equal(deletedId, "slide-1");
  assert.equal(event1.defaultPrevented, true);

  deletedId = null;
  const event2 = new TestKeyboardEvent("keydown", { key: "Backspace" });
  target.dispatchEvent(event2);
  assert.equal(deletedId, "slide-1");
  assert.equal(event2.defaultPrevented, true);
});

test("Delete and Backspace are ignored while the app is busy", () => {
  let deletedId = null;
  const current = actions({
    busy: true,
    slidesRef: { current: [readySlide()] },
    selectedIdRef: { current: "slide-1" },
    deleteSlide(id) {
      deletedId = id;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const event1 = new TestKeyboardEvent("keydown", { key: "Delete" });
  target.dispatchEvent(event1);
  assert.equal(deletedId, null);
  assert.equal(event1.defaultPrevented, true);

  const event2 = new TestKeyboardEvent("keydown", { key: "Backspace" });
  target.dispatchEvent(event2);
  assert.equal(deletedId, null);
  assert.equal(event2.defaultPrevented, true);
});

test("Cmd+Z and Ctrl+Z are ignored while the app is busy", () => {
  let undoCount = 0;
  const current = actions({
    busy: true,
    handleUndo() {
      undoCount += 1;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const cmdZ = new TestKeyboardEvent("keydown", { key: "z", metaKey: true });
  target.dispatchEvent(cmdZ);
  assert.equal(undoCount, 0);
  assert.equal(cmdZ.defaultPrevented, true);

  const ctrlZ = new TestKeyboardEvent("keydown", { key: "z", ctrlKey: true });
  target.dispatchEvent(ctrlZ);
  assert.equal(undoCount, 0);
  assert.equal(ctrlZ.defaultPrevented, true);
});

test("Cmd+Shift+Z and Ctrl+Y are ignored while the app is busy", () => {
  let redoCount = 0;
  const current = actions({
    busy: true,
    handleRedo() {
      redoCount += 1;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const cmdShiftZ = new TestKeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true });
  target.dispatchEvent(cmdShiftZ);
  assert.equal(redoCount, 0);
  assert.equal(cmdShiftZ.defaultPrevented, true);

  const ctrlY = new TestKeyboardEvent("keydown", { key: "y", ctrlKey: true });
  target.dispatchEvent(ctrlY);
  assert.equal(redoCount, 0);
  assert.equal(ctrlY.defaultPrevented, true);
});

test("Cmd+Z and Ctrl+Z trigger handleUndo", () => {
  let undoCount = 0;
  const current = actions({
    handleUndo() {
      undoCount += 1;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const cmdZ = new TestKeyboardEvent("keydown", { key: "z", metaKey: true });
  target.dispatchEvent(cmdZ);
  assert.equal(undoCount, 1);
  assert.equal(cmdZ.defaultPrevented, true);

  const ctrlZ = new TestKeyboardEvent("keydown", { key: "z", ctrlKey: true });
  target.dispatchEvent(ctrlZ);
  assert.equal(undoCount, 2);
  assert.equal(ctrlZ.defaultPrevented, true);
});

test("Cmd+Shift+Z and Ctrl+Y trigger handleRedo", () => {
  let redoCount = 0;
  const current = actions({
    handleRedo() {
      redoCount += 1;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const cmdShiftZ = new TestKeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true });
  target.dispatchEvent(cmdShiftZ);
  assert.equal(redoCount, 1);
  assert.equal(cmdShiftZ.defaultPrevented, true);

  const ctrlY = new TestKeyboardEvent("keydown", { key: "y", ctrlKey: true });
  target.dispatchEvent(ctrlY);
  assert.equal(redoCount, 2);
  assert.equal(ctrlY.defaultPrevented, true);
});

test("Alt+ArrowUp and Alt+ArrowDown trigger moveSlideUp and moveSlideDown for selected slide", () => {
  let movedUpId = null;
  let movedDownId = null;
  const current = actions({
    slidesRef: { current: [readySlide()] },
    selectedIdRef: { current: "slide-1" },
    moveSlideUp(id) {
      movedUpId = id;
    },
    moveSlideDown(id) {
      movedDownId = id;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const altUp = new TestKeyboardEvent("keydown", { key: "ArrowUp", altKey: true });
  target.dispatchEvent(altUp);
  assert.equal(movedUpId, "slide-1");
  assert.equal(altUp.defaultPrevented, true);

  const altDown = new TestKeyboardEvent("keydown", { key: "ArrowDown", altKey: true });
  target.dispatchEvent(altDown);
  assert.equal(movedDownId, "slide-1");
  assert.equal(altDown.defaultPrevented, true);
});

test("Alt+ArrowUp and Alt+ArrowDown are ignored while the app is busy", () => {
  let movedUpId = null;
  let movedDownId = null;
  const current = actions({
    busy: true,
    slidesRef: { current: [readySlide()] },
    selectedIdRef: { current: "slide-1" },
    moveSlideUp(id) {
      movedUpId = id;
    },
    moveSlideDown(id) {
      movedDownId = id;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const altUp = new TestKeyboardEvent("keydown", { key: "ArrowUp", altKey: true });
  target.dispatchEvent(altUp);
  assert.equal(movedUpId, null);
  assert.equal(altUp.defaultPrevented, true);

  const altDown = new TestKeyboardEvent("keydown", { key: "ArrowDown", altKey: true });
  target.dispatchEvent(altDown);
  assert.equal(movedDownId, null);
  assert.equal(altDown.defaultPrevented, true);
});

test("? triggers openShortcuts", () => {
  let shortcutsOpened = false;
  const current = actions({
    openShortcuts() {
      shortcutsOpened = true;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const event = new TestKeyboardEvent("keydown", { key: "?" });
  target.dispatchEvent(event);
  assert.equal(shortcutsOpened, true);
  assert.equal(event.defaultPrevented, true);
});

test("? is ignored when isInfoOpen is true", () => {
  let shortcutsOpened = false;
  const current = actions({
    isInfoOpen: true,
    openShortcuts() {
      shortcutsOpened = true;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const event = new TestKeyboardEvent("keydown", { key: "?" });
  target.dispatchEvent(event);
  assert.equal(shortcutsOpened, false);
});

test("? with modifiers (Cmd/Ctrl/Alt) is ignored", () => {
  let shortcutsOpened = false;
  const current = actions({
    openShortcuts() {
      shortcutsOpened = true;
    },
  });
  const handler = createGlobalKeyDownHandler(current);
  const target = new EventTarget();
  target.addEventListener("keydown", handler);

  const metaEvent = new TestKeyboardEvent("keydown", { key: "?", metaKey: true });
  target.dispatchEvent(metaEvent);
  assert.equal(shortcutsOpened, false);

  const ctrlEvent = new TestKeyboardEvent("keydown", { key: "?", ctrlKey: true });
  target.dispatchEvent(ctrlEvent);
  assert.equal(shortcutsOpened, false);

  const altEvent = new TestKeyboardEvent("keydown", { key: "?", altKey: true });
  target.dispatchEvent(altEvent);
  assert.equal(shortcutsOpened, false);
});

test("? is ignored when focus is on an input or textarea target", () => {
  let shortcutsOpened = false;
  const current = actions({
    openShortcuts() {
      shortcutsOpened = true;
    },
  });
  const handler = createGlobalKeyDownHandler(current);

  const eventInput = new TestKeyboardEvent("keydown", { key: "?" });
  Object.defineProperty(eventInput, "target", { value: { tagName: "INPUT" } });
  handler(eventInput);
  assert.equal(shortcutsOpened, false);

  const eventTextarea = new TestKeyboardEvent("keydown", { key: "?" });
  Object.defineProperty(eventTextarea, "target", { value: { tagName: "TEXTAREA" } });
  handler(eventTextarea);
  assert.equal(shortcutsOpened, false);
});

