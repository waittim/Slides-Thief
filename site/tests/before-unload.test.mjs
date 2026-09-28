import assert from "node:assert/strict";
import test from "node:test";

const {
  shouldWarnOnUnload,
  hasFreshExport,
  handleBeforeUnloadEvent,
} = await import(new URL("../app/lib/before-unload.ts", import.meta.url).href);

test("shouldWarnOnUnload never warns when there are no slides loaded", () => {
  // Empty state should never block reload or navigation
  assert.equal(
    shouldWarnOnUnload({ slideCount: 0, isBusy: false, hasExported: false }),
    false,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: 0, isBusy: true, hasExported: false }),
    false,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: 0, isBusy: false, hasExported: true }),
    false,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: -1, isBusy: false, hasExported: false }),
    false,
  );
});

test("shouldWarnOnUnload warns when application is busy processing slides", () => {
  assert.equal(
    shouldWarnOnUnload({ slideCount: 1, isBusy: true, hasExported: false }),
    true,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: 10, isBusy: true, hasExported: true }),
    true,
  );
});

test("shouldWarnOnUnload warns when slides exist and have not been exported", () => {
  assert.equal(
    shouldWarnOnUnload({ slideCount: 1, isBusy: false, hasExported: false }),
    true,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: 50, isBusy: false, hasExported: false }),
    true,
  );
});

test("shouldWarnOnUnload does not warn when all slides have been exported and are not busy", () => {
  assert.equal(
    shouldWarnOnUnload({ slideCount: 1, isBusy: false, hasExported: true }),
    false,
  );
  assert.equal(
    shouldWarnOnUnload({ slideCount: 25, isBusy: false, hasExported: true }),
    false,
  );
});

test("hasFreshExport correctly evaluates presence and staleness of export artifacts", () => {
  // Undefined / empty
  assert.equal(hasFreshExport(undefined), false);
  assert.equal(hasFreshExport({}), false);

  // Fresh PDF export
  assert.equal(
    hasFreshExport({
      pdf: { isStale: false },
    }),
    true,
  );

  // Stale PDF export
  assert.equal(
    hasFreshExport({
      pdf: { isStale: true },
    }),
    false,
  );

  // Fresh JPG export
  assert.equal(
    hasFreshExport({
      jpg: { isStale: false },
    }),
    true,
  );

  // Stale JPG export
  assert.equal(
    hasFreshExport({
      jpg: { isStale: true },
    }),
    false,
  );

  // One fresh and one stale
  assert.equal(
    hasFreshExport({
      pdf: { isStale: true },
      jpg: { isStale: false },
    }),
    true,
  );

  // Both stale
  assert.equal(
    hasFreshExport({
      pdf: { isStale: true },
      jpg: { isStale: true },
    }),
    false,
  );
});

test("handleBeforeUnloadEvent prevents default, sets returnValue, and returns empty string", () => {
  let preventDefaultCalled = false;
  const mockEvent = {
    returnValue: "initial",
    preventDefault() {
      preventDefaultCalled = true;
    },
  };

  const result = handleBeforeUnloadEvent(mockEvent);

  assert.equal(preventDefaultCalled, true);
  assert.equal(mockEvent.returnValue, "");
  assert.equal(result, "");
});
