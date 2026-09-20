import assert from "node:assert/strict";
import test from "node:test";

const {
  isEditableTarget,
  hasDragFiles,
  createPastedImageFile,
  extractClipboardImageFiles,
  createWindowDragDropHandlers,
  createWindowPasteHandler,
} = await import(new URL("../app/window-import.ts", import.meta.url).href);

class MockFile {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified || Date.now();
    this.size = bits.reduce((acc, b) => acc + (typeof b === "string" ? b.length : (b.length || 0)), 0);
  }
}

// Ensure global File exists or fall back to MockFile in test environment
const FileClass = typeof File !== "undefined" ? File : MockFile;

test("hasDragFiles correctly identifies files in drag event dataTransfer", () => {
  assert.equal(hasDragFiles(null), false);
  assert.equal(hasDragFiles({ types: [] }), false);
  assert.equal(hasDragFiles({ types: ["text/plain", "text/html"] }), false);
  assert.equal(hasDragFiles({ types: ["Files"] }), true);
  assert.equal(hasDragFiles({ types: ["text/plain", "Files"] }), true);

  // Test array-like object without .includes
  const arrayLike = { 0: "text/plain", 1: "Files", length: 2 };
  assert.equal(hasDragFiles({ types: arrayLike }), true);
});

test("isEditableTarget identifies form controls and contentEditable elements", () => {
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
  assert.equal(isEditableTarget({ tagName: "CANVAS" }), false);

  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
});

test("createPastedImageFile preserves distinct names and generates unique names for generic pastes", () => {
  const customFile = new FileClass(["data"], "custom-slide.png", { type: "image/png" });
  const fixedDate = new Date("2026-09-20T12:00:00Z");

  // Non-generic name not in existingNames is preserved
  const preserved = createPastedImageFile(customFile, new Set(), 0, fixedDate);
  assert.equal(preserved.name, "custom-slide.png");

  // Generic name "image.png" is renamed with timestamp
  const genericFile = new FileClass(["data"], "image.png", { type: "image/png" });
  const renamed1 = createPastedImageFile(genericFile, new Set(), 0, fixedDate);
  assert.match(renamed1.name, /^pasted-\d{8}-\d{6}\.png$/);

  // If already existing in set, suffix increment is added
  const existingNames = new Set([renamed1.name]);
  const renamed2 = createPastedImageFile(genericFile, existingNames, 0, fixedDate);
  assert.equal(renamed2.name, `${renamed1.name.replace(".png", "")}-1.png`);

  // Multiple items in sequence get sequence index
  const seqItem = createPastedImageFile(genericFile, new Set(), 2, fixedDate);
  assert.match(seqItem.name, /^pasted-\d{8}-\d{6}-3\.png$/);
});

test("extractClipboardImageFiles extracts supported images and generates unique filenames", () => {
  // Empty or null
  assert.deepEqual(extractClipboardImageFiles(null, new Set()), []);
  assert.deepEqual(extractClipboardImageFiles({ items: [] }, new Set()), []);

  // Clipboard with text only
  const textClipboard = {
    items: [
      { kind: "string", type: "text/plain", getAsFile: () => null },
    ],
  };
  assert.deepEqual(extractClipboardImageFiles(textClipboard, new Set()), []);

  // Clipboard with image item
  const pngFile = new FileClass(["fake png"], "image.png", { type: "image/png" });
  const imageClipboard = {
    items: [
      { kind: "file", type: "image/png", getAsFile: () => pngFile },
    ],
  };
  const extracted = extractClipboardImageFiles(imageClipboard, new Set());
  assert.equal(extracted.length, 1);
  assert.match(extracted[0].name, /^pasted-.*\.png$/);

  // Clipboard with files list fallback
  const filesClipboard = {
    files: [
      new FileClass(["fake jpg"], "photo.jpg", { type: "image/jpeg" }),
      new FileClass(["unsupported"], "doc.txt", { type: "text/plain" }),
    ],
  };
  const extractedFiles = extractClipboardImageFiles(filesClipboard, new Set());
  assert.equal(extractedFiles.length, 1);
  assert.equal(extractedFiles[0].name, "photo.jpg");
});

test("createWindowDragDropHandlers manages dragActive state and file drop", () => {
  let dragActive = false;
  let loadedFiles = null;

  const actionsRef = {
    current: {
      busy: false,
      isInfoOpen: false,
      slidesRef: { current: [] },
      loadFiles: (files) => {
        loadedFiles = files;
      },
      setDragActive: (active) => {
        dragActive = active;
      },
    },
  };
  const dragDepthRef = { current: 0 };

  const { onDragEnter, onDragOver, onDragLeave, onDrop, onReset } =
    createWindowDragDropHandlers(actionsRef, dragDepthRef);

  // Dragging non-files does nothing
  let enterDefaultPrevented = false;
  onDragEnter({
    dataTransfer: { types: ["text/plain"] },
    preventDefault: () => { enterDefaultPrevented = true; },
  });
  assert.equal(enterDefaultPrevented, false);
  assert.equal(dragActive, false);
  assert.equal(dragDepthRef.current, 0);

  // Dragging files enters window
  onDragEnter({
    dataTransfer: { types: ["Files"] },
    preventDefault: () => { enterDefaultPrevented = true; },
  });
  assert.equal(enterDefaultPrevented, true);
  assert.equal(dragActive, true);
  assert.equal(dragDepthRef.current, 1);

  // Child element enter increments depth
  onDragEnter({
    dataTransfer: { types: ["Files"] },
    preventDefault: () => {},
  });
  assert.equal(dragDepthRef.current, 2);
  assert.equal(dragActive, true);

  // Drag over sets dropEffect
  const dragOverEvent = {
    dataTransfer: { types: ["Files"], dropEffect: "" },
    preventDefault: () => {},
  };
  onDragOver(dragOverEvent);
  assert.equal(dragOverEvent.dataTransfer.dropEffect, "copy");

  // Child leave decrements depth but stays active
  onDragLeave({
    dataTransfer: { types: ["Files"] },
  });
  assert.equal(dragDepthRef.current, 1);
  assert.equal(dragActive, true);

  // Drop clears state and calls loadFiles
  let dropDefaultPrevented = false;
  const fakeFiles = [new FileClass(["data"], "test.png", { type: "image/png" })];
  onDrop({
    dataTransfer: { types: ["Files"], files: fakeFiles },
    preventDefault: () => { dropDefaultPrevented = true; },
  });
  assert.equal(dropDefaultPrevented, true);
  assert.equal(dragActive, false);
  assert.equal(dragDepthRef.current, 0);
  assert.equal(loadedFiles, fakeFiles);

  // Reset clears state
  dragDepthRef.current = 3;
  dragActive = true;
  onReset();
  assert.equal(dragDepthRef.current, 0);
  assert.equal(dragActive, false);
});

test("createWindowDragDropHandlers prevents default on drop when busy without loading files", () => {
  let loadedFiles = null;
  const actionsRef = {
    current: {
      busy: true,
      isInfoOpen: false,
      slidesRef: { current: [] },
      loadFiles: (files) => {
        loadedFiles = files;
      },
      setDragActive: () => {},
    },
  };
  const dragDepthRef = { current: 1 };
  const { onDragOver, onDrop } = createWindowDragDropHandlers(actionsRef, dragDepthRef);

  const overEvent = {
    dataTransfer: { types: ["Files"], dropEffect: "" },
    preventDefault: () => {},
  };
  onDragOver(overEvent);
  assert.equal(overEvent.dataTransfer.dropEffect, "none");

  let dropPrevented = false;
  onDrop({
    dataTransfer: { types: ["Files"], files: ["file"] },
    preventDefault: () => { dropPrevented = true; },
  });
  assert.equal(dropPrevented, true);
  assert.equal(loadedFiles, null);
});

test("createWindowPasteHandler ignores editable targets, busy states, and non-image paste", () => {
  let loadedFiles = null;
  const actionsRef = {
    current: {
      busy: false,
      isInfoOpen: false,
      slidesRef: { current: [] },
      loadFiles: (files) => {
        loadedFiles = files;
      },
      setDragActive: () => {},
    },
  };

  const onPaste = createWindowPasteHandler(actionsRef);

  // Ignored when editing an input
  let pastePrevented = false;
  onPaste({
    target: { tagName: "INPUT" },
    clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => new FileClass(["data"], "test.png", { type: "image/png" }) }],
    },
    preventDefault: () => { pastePrevented = true; },
  });
  assert.equal(pastePrevented, false);
  assert.equal(loadedFiles, null);

  // Ignored when busy
  actionsRef.current.busy = true;
  onPaste({
    target: { tagName: "DIV" },
    clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => new FileClass(["data"], "test.png", { type: "image/png" }) }],
    },
    preventDefault: () => { pastePrevented = true; },
  });
  assert.equal(pastePrevented, false);
  assert.equal(loadedFiles, null);

  // Ignored when isInfoOpen
  actionsRef.current.busy = false;
  actionsRef.current.isInfoOpen = true;
  onPaste({
    target: { tagName: "DIV" },
    clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => new FileClass(["data"], "test.png", { type: "image/png" }) }],
    },
    preventDefault: () => { pastePrevented = true; },
  });
  assert.equal(pastePrevented, false);
  assert.equal(loadedFiles, null);

  // When not busy and pasting image: prevents default and calls loadFiles
  actionsRef.current.isInfoOpen = false;
  onPaste({
    target: { tagName: "DIV" },
    clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => new FileClass(["data"], "screenshot.png", { type: "image/png" }) }],
    },
    preventDefault: () => { pastePrevented = true; },
  });
  assert.equal(pastePrevented, true);
  assert.ok(Array.isArray(loadedFiles) && loadedFiles.length === 1);
});
