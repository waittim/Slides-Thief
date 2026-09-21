import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { copy, reviewUiCopy } from "../app/i18n.ts";

async function readAppFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("no native window.confirm calls remain in the codebase", async () => {
  const [slideDeck, app] = await Promise.all([
    readAppFile("app/hooks/useSlideDeck.ts"),
    readAppFile("app/SlidesThiefApp.tsx"),
  ]);

  assert.doesNotMatch(slideDeck, /window\.confirm/);
  assert.doesNotMatch(app, /window\.confirm/);
});

test("all 9 locales contain required confirmation modal copy", () => {
  const expectedLocales = ["zh-CN", "zh-TW", "en", "es", "fr", "de", "ja", "ko", "pt-BR"];

  for (const locale of expectedLocales) {
    const localeCopy = copy[locale];
    const reviewCopy = reviewUiCopy[locale];

    assert.ok(localeCopy, `copy missing for locale ${locale}`);
    assert.ok(reviewCopy, `reviewUiCopy missing for locale ${locale}`);

    // Clear all confirmation texts
    assert.equal(typeof localeCopy.clearAllTitle, "string");
    assert.ok(localeCopy.clearAllTitle.length > 0);
    assert.equal(typeof localeCopy.clearAllAction, "string");
    assert.ok(localeCopy.clearAllAction.length > 0);
    assert.equal(typeof localeCopy.keepSlidesAction, "string");
    assert.ok(localeCopy.keepSlidesAction.length > 0);
    assert.equal(typeof localeCopy.clearAllConfirm, "function");
    assert.ok(localeCopy.clearAllConfirm(3).length > 0);

    // Review confirmation texts
    assert.equal(typeof reviewCopy.reviewModalTitle, "string");
    assert.ok(reviewCopy.reviewModalTitle.length > 0);
    assert.equal(typeof reviewCopy.reviewModalConfirm, "string");
    assert.ok(reviewCopy.reviewModalConfirm.length > 0);
    assert.equal(typeof reviewCopy.reviewModalCancel, "string");
    assert.ok(reviewCopy.reviewModalCancel.length > 0);
    assert.equal(typeof reviewCopy.reviewConfirmation, "function");
    assert.ok(reviewCopy.reviewConfirmation(2).length > 0);
  }
});

test("ConfirmModal component adheres to accessible design system standards", async () => {
  const [modalShell, confirmModal, css] = await Promise.all([
    readAppFile("app/components/ui/ModalShell.tsx"),
    readAppFile("app/components/ui/ConfirmModal.tsx"),
    readAppFile("app/globals.css"),
  ]);

  // ModalShell has ARIA dialog attributes, focus trap, and Escape key handling
  assert.match(modalShell, /role="dialog"/);
  assert.match(modalShell, /aria-modal="true"/);
  assert.match(modalShell, /aria-labelledby=\{titleId\}/);
  assert.match(modalShell, /aria-describedby=\{describedById\}/);
  assert.match(modalShell, /event\.key === "Escape"/);
  assert.match(modalShell, /"Tab"/);

  // ConfirmModal uses ModalShell and semantic Button variants
  assert.match(confirmModal, /<ModalShell/);
  assert.match(confirmModal, /className="confirmModalCancelBtn"/);
  assert.match(confirmModal, /className="confirmModalConfirmBtn"/);
  assert.match(confirmModal, /destructive \? "danger" : "primary"/);

  // CSS design tokens and responsive classes
  assert.match(css, /\.confirmModalCard\s*\{/);
  assert.match(css, /\.confirmModalActions\s*\{/);
  assert.match(css, /\.confirmModalMessage\s*\{/);
  assert.match(css, /flex-direction:\s*column-reverse/);
});
