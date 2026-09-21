import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("../../../tests/fixtures/detection/synthetic/light-slide-dark-wall.png", import.meta.url));
const fixture2 = fileURLToPath(new URL("../../../tests/fixtures/detection/synthetic/dark-slide-light-wall.png", import.meta.url));
const fallbackFixture = fileURLToPath(new URL("../../../tests/fixtures/detection/synthetic/fallback-solid.png", import.meta.url));

test("imports, auto-detects, edits, undoes/redoes, and exports a PDF", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();

  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  const before = await firstCorner.getAttribute("aria-label");
  const box = await firstCorner.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 8);
  await page.mouse.up();
  await expect(firstCorner).not.toHaveAttribute("aria-label", before ?? "");

  await page.keyboard.press("Control+Z");
  await expect(firstCorner).toHaveAttribute("aria-label", before ?? "");
  await page.keyboard.press("Control+Shift+Z");
  await expect(firstCorner).not.toHaveAttribute("aria-label", before ?? "");

  await page.keyboard.press("Control+Enter");
  const downloadLink = page.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toBeVisible({ timeout: 45_000 });
  await expect(downloadLink).toHaveAttribute("download", "flattened_slides.pdf");
  await expect(downloadLink).toHaveAttribute("href", /^blob:/);

  // Adjusting a corner after export marks the download link as stale instead of removing it
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 15);
  await page.mouse.up();

  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).toHaveClass(/sidebarLink--stale/);
  await expect(page.getByText("Settings changed; re-generate to update")).toBeVisible();
  await expect(downloadLink).toHaveAttribute("download", "flattened_slides.pdf");
  await expect(downloadLink).toHaveAttribute("href", /^blob:/);
});

test("secondary file import appends new slide, supports undo, and skips duplicates", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles(fixture);

  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();
  await expect(page.getByText("Add more photos")).toBeVisible();
  await expect(page.locator(".uiCountBadge").first()).toHaveText("1");

  // Secondary file import appends instead of replacing
  await fileInput.setInputFiles(fixture2);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toBeVisible();
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");

  // Undo (Control+Z) removes the appended slide
  await page.keyboard.press("Control+Z");
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toHaveCount(0);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("1");

  // Redo (Control+Shift+Z) restores the appended slide
  await page.keyboard.press("Control+Shift+Z");
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toBeVisible();
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");

  // Duplicate file import is skipped and warned
  await fileInput.setInputFiles(fixture2);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");
  await expect(page.getByRole("alert")).toHaveText("Skipped 1 duplicate file");
});

test("deleting a slide shows toast feedback and status undo, and undo restores the slide", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles([fixture, fixture2]);

  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toBeVisible();
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");

  // Toolbar Undo is initially disabled
  const toolbarUndo = page.locator(".reviewUndoButton");
  await expect(toolbarUndo).toBeDisabled();

  // Delete the second slide using the delete button on the row
  const deleteBtn = page.getByRole("button", { name: /Delete image: dark-slide-light-wall/i });
  await deleteBtn.click();

  // Slide is removed
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toHaveCount(0);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("1");

  // Deletion feedback toast appears with slide name and Undo button
  const toast = page.locator(".toastSnackbar");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Deleted dark-slide-light-wall.png");
  await expect(page.locator(".sidebarStatus")).toContainText("Deleted dark-slide-light-wall.png");

  // Toolbar Undo is now enabled
  await expect(toolbarUndo).toBeEnabled();

  // Click Undo in the toast
  await toast.getByRole("button", { name: "Undo" }).click();

  // Slide is restored and toast disappears
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toBeVisible();
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");
  await expect(toast).toHaveCount(0);

  // Now delete via keyboard Delete key
  await page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" }).click();
  await page.keyboard.press("Delete");

  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toHaveCount(0);
  await expect(toast).toBeVisible();

  // Click toolbar Undo button
  await toolbarUndo.click();
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dark-slide-light-wall.png" })).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test("mobile settings inputs use 16px font-size to prevent mobile browser auto-zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const settingsMenu = page.locator(".settingsMenu");
  expect(await settingsMenu.evaluate((el) => el.tagName.toLowerCase())).toBe("details");

  const settingsToggle = page.locator(".settingsMenuToggle");
  await settingsToggle.click();

  const nameInput = page.locator(".pdfNameSetting input[type='text']");
  await expect(nameInput).toBeVisible();

  const nameFontSize = await nameInput.evaluate((el) => getComputedStyle(el).fontSize);
  const nameHeight = await nameInput.evaluate((el) => getComputedStyle(el).height);
  expect(nameFontSize).toBe("16px");
  expect(nameHeight).toBe("44px");

  const ratioSelect = page.locator(".ratioSetting select");
  const ratioFontSize = await ratioSelect.evaluate((el) => getComputedStyle(el).fontSize);
  const ratioHeight = await ratioSelect.evaluate((el) => getComputedStyle(el).height);
  expect(ratioFontSize).toBe("16px");
  expect(ratioHeight).toBe("44px");

  const enhancementSelect = page.locator(".enhancementSetting select");
  await expect(enhancementSelect).toBeVisible();
  const enhancementFontSize = await enhancementSelect.evaluate((el) => getComputedStyle(el).fontSize);
  const enhancementHeight = await enhancementSelect.evaluate((el) => getComputedStyle(el).height);
  expect(enhancementFontSize).toBe("16px");
  expect(enhancementHeight).toBe("44px");

  const sectionTitles = page.locator(".settingsSectionTitle");
  await expect(sectionTitles).toHaveCount(2);

  // On mobile <= 834px, moreSettings is open by default, but verify input
  const widthInput = page.locator(".morePanel input[type='number']").first();
  await expect(widthInput).toBeVisible();
  const widthFontSize = await widthInput.evaluate((el) => getComputedStyle(el).fontSize);
  const widthHeight = await widthInput.evaluate((el) => getComputedStyle(el).height);
  expect(widthFontSize).toBe("16px");
  expect(widthHeight).toBe("44px");
});

test("desktop settings surfaces enhancement mode at top level and groups parameters in moreSettings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  // On desktop, settingsMenu is a semantic div container without fake interactive summary toggle
  await expect(page.locator(".settingsMenuToggle")).toHaveCount(0);
  const settingsMenu = page.locator(".settingsMenu");
  expect(await settingsMenu.evaluate((el) => el.tagName.toLowerCase())).toBe("div");

  // Enhancement control is visible directly in topbar without expanding moreSettings
  const enhancementSelect = page.locator(".settingsMenuBody > .enhancementSetting select");
  await expect(enhancementSelect).toBeVisible();
  await expect(enhancementSelect).toHaveValue("original");

  // Changing enhancement updates the value
  await enhancementSelect.selectOption("clean");
  await expect(enhancementSelect).toHaveValue("clean");

  // More settings panel is closed initially on desktop
  const moreDetails = page.locator(".moreSettings");
  await expect(moreDetails).not.toHaveAttribute("open", "");

  // Click More settings summary to open panel
  await page.locator(".moreSettings summary").click();
  await expect(moreDetails).toHaveAttribute("open", "");

  // Verify section titles inside morePanel
  const sectionTitles = page.locator(".morePanel .settingsSectionTitle");
  await expect(sectionTitles).toHaveCount(2);

  // Quality input is visible under quality section
  const qualityInput = page.locator(".morePanel input[type='number']").nth(1);
  await expect(qualityInput).toBeVisible();
});

test("window-level drag and drop onto canvas displays overlay and imports image", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  // Dispatch dragenter with Files on window
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const file = new File(["fake"], "dragged-slide.png", { type: "image/png" });
    dt.items.add(file);
    window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });

  // Verify overlay is shown
  await expect(page.locator(".windowDragOverlay")).toBeVisible();
  await expect(page.locator(".windowDragOverlayTitle")).toHaveText("Drop images anywhere to import");

  // Read fixture and drop on stage
  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(fixture);
  const base64 = buffer.toString("base64");

  await page.evaluate(({ b64 }) => {
    const byteCharacters = atob(b64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const file = new File([byteArray], "dragged-canvas.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);

    const canvas = document.querySelector("canvas.mainCanvas") || document.querySelector(".stageArea") || window;
    canvas.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { b64: base64 });

  // Overlay should hide
  await expect(page.locator(".windowDragOverlay")).not.toBeVisible();
  // Slide should be imported
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "dragged-canvas.png" })).toBeVisible();
});

test("window-level clipboard paste imports image as slide", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(fixture);
  const base64 = buffer.toString("base64");

  await page.evaluate(({ b64 }) => {
    const byteCharacters = atob(b64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const file = new File([byteArray], "image.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);

    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { b64: base64 });

  // Pasted slide should be imported and have unique pasted-* name
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "pasted-" })).toBeVisible();
});

test("slide reordering updates page order with buttons, Alt+Arrow keys, and supports undo/redo", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles([fixture, fixture2]);

  const rows = page.locator(".fileRow");
  await expect(rows).toHaveCount(2);

  // Initial order (sorted by filename: dark-slide-light-wall is 01, light-slide-dark-wall is 02)
  await expect(rows.nth(0).locator(".name")).toHaveText("dark-slide-light-wall.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("light-slide-dark-wall.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // Move the second slide up using button
  const moveUpBtn = page.getByRole("button", { name: /Move image up: light-slide-dark-wall/i });
  await moveUpBtn.click();

  // Order is swapped and page numbers updated
  await expect(rows.nth(0).locator(".name")).toHaveText("light-slide-dark-wall.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("dark-slide-light-wall.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // Select the first slide and use Alt+ArrowDown to move it down
  await rows.nth(0).locator(".slideSelectButton").click();
  await page.keyboard.press("Alt+ArrowDown");

  // Order is swapped back
  await expect(rows.nth(0).locator(".name")).toHaveText("dark-slide-light-wall.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("light-slide-dark-wall.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // Undo (Control+Z) restores light-slide-dark-wall to position 01
  await page.keyboard.press("Control+Z");
  await expect(rows.nth(0).locator(".name")).toHaveText("light-slide-dark-wall.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("dark-slide-light-wall.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // Redo (Control+Shift+Z) re-applies the move down
  await page.keyboard.press("Control+Shift+Z");
  await expect(rows.nth(0).locator(".name")).toHaveText("dark-slide-light-wall.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("light-slide-dark-wall.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");
});

test("clearing all slides opens styled ConfirmModal, cancel keeps slides, and confirm clears slides", async ({
  page,
}) => {
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles([fixture, fixture2]);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");

  // Click Clear all button
  const clearBtn = page.locator(".clearAction");
  await clearBtn.click();

  // Styled ConfirmModal appears
  const modal = page.locator(".confirmModalCard");
  await expect(modal).toBeVisible();
  await expect(modal.locator("#confirm-dialog-title")).toHaveText("Clear all images");
  await expect(modal.locator("#confirm-dialog-desc")).toHaveText("Are you sure you want to clear all 2 images?");

  const cancelBtn = modal.locator(".confirmModalCancelBtn");
  const confirmBtn = modal.locator(".confirmModalConfirmBtn");

  await expect(cancelBtn).toHaveText("Keep images");
  await expect(confirmBtn).toHaveText("Clear all");
  await expect(confirmBtn).toHaveClass(/uiButton--danger/);

  // Clicking cancel dismisses modal and keeps slides
  await cancelBtn.click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("2");

  // Click Clear all again
  await clearBtn.click();
  await expect(modal).toBeVisible();

  // Clicking confirm clears all slides
  await confirmBtn.click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".uiCountBadge").first()).toHaveText("0");
  await expect(page.locator(".fileRow")).toHaveCount(0);
  await expect(page.locator(".clearAction")).toHaveCount(0);
});

test("exporting slides needing review prompts ReviewModal, cancel enters Review Mode, confirming slide resumes export", async ({
  page,
}) => {
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles(fallbackFixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "fallback-solid.png" })).toBeVisible();

  // Run auto straighten
  await page.getByRole("button", { name: "Auto straighten" }).click();

  // Verify slide needs review with warning/fallback badge
  const fallbackBadge = page.locator(".badge.fallback");
  await expect(fallbackBadge).toBeVisible({ timeout: 30_000 });

  // Click Generate PDF button
  const exportBtn = page.getByRole("button", { name: "Generate PDF" });
  await exportBtn.click();

  // Review confirmation modal appears
  const modal = page.locator(".confirmModalCard");
  await expect(modal).toBeVisible();
  await expect(modal.locator("#confirm-dialog-title")).toHaveText("Review before export");

  const cancelBtn = modal.locator(".confirmModalCancelBtn");
  const confirmBtn = modal.locator(".confirmModalConfirmBtn");
  await expect(cancelBtn).toHaveText("Review slides");
  await expect(confirmBtn).toHaveText("Export anyway");

  // Clicking "Review slides" enters dedicated Review Mode
  await cancelBtn.click();
  await expect(modal).toHaveCount(0);

  // Review Mode banner is now visible in workspace
  const reviewBanner = page.locator(".reviewModeBanner");
  await expect(reviewBanner).toBeVisible();
  await expect(reviewBanner.locator(".reviewModeTitle")).toHaveText("Review mode");
  await expect(reviewBanner.locator(".reviewModeProgress")).toHaveText("Slide 1 of 1 to review");

  const confirmSlideBtn = reviewBanner.locator(".reviewConfirmBtn");
  await expect(confirmSlideBtn).toBeVisible();
  await expect(confirmSlideBtn).toHaveText("Looks good");

  // Clicking "Looks good" confirms the slide, completes review mode, and automatically resumes PDF export
  await confirmSlideBtn.click();

  // Review mode finishes and PDF is generated automatically
  const downloadLink = page.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toBeVisible({ timeout: 45_000 });
  await expect(downloadLink).toHaveAttribute("download", "flattened_slides.pdf");
});

test("supports wheel zoom, space-drag pan, and middle-click pan on canvas stage", async ({ page }) => {
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles(fixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();

  const stage = page.locator(".stage");
  await expect(stage).toBeVisible();

  const zoomValue = page.locator(".zoomValue");
  const initialZoomText = await zoomValue.textContent();
  expect(initialZoomText).not.toBeNull();

  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;

  const centerX = stageBox.x + stageBox.width / 2;
  const centerY = stageBox.y + stageBox.height / 2;

  // 1. Wheel zoom in with mouse wheel / pinch (negative deltaY)
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, -200);

  // Zoom percentage should increase
  await expect(async () => {
    const currentText = await zoomValue.textContent();
    expect(currentText).not.toEqual(initialZoomText);
  }).toPass({ timeout: 5000 });

  // Zoom in further to make stage scrollable
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -200);
  }

  // 2. Space pan: Pressing spacebar adds .isSpacePressed to stage
  await page.keyboard.down("Space");
  await expect(stage).toHaveClass(/isSpacePressed/);

  // Left click and drag with Space held down
  const initialScroll = await stage.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
  await page.mouse.down({ button: "left" });
  await expect(stage).toHaveClass(/isPanning/);

  await page.mouse.move(centerX - 80, centerY - 80);
  await page.mouse.up({ button: "left" });
  await expect(stage).not.toHaveClass(/isPanning/);

  const afterSpaceScroll = await stage.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
  expect(afterSpaceScroll.left).toBeGreaterThanOrEqual(initialScroll.left);
  expect(afterSpaceScroll.top).toBeGreaterThanOrEqual(initialScroll.top);

  // Release Space
  await page.keyboard.up("Space");
  await expect(stage).not.toHaveClass(/isSpacePressed/);

  // 3. Middle-click drag pan (button: "middle")
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: "middle" });
  await expect(stage).toHaveClass(/isPanning/);

  await page.mouse.move(centerX + 60, centerY + 60);
  await page.mouse.up({ button: "middle" });
  await expect(stage).not.toHaveClass(/isPanning/);

  const afterMiddleScroll = await stage.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
  expect(afterMiddleScroll.left).toBeLessThanOrEqual(afterSpaceScroll.left);

  // 4. Clicking "Fit" resets zoom back to fit
  await page.locator(".reviewFitButton").click();
  await expect(zoomValue).toHaveText(initialZoomText ?? "");
});

test("auto-pans canvas viewport when dragging corner handle near stage edges", async ({ page }) => {
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles(fixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();

  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  const stage = page.locator(".stage");
  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;

  // Zoom in multiple times to ensure the content overflows the stage
  const zoomInBtn = page.getByRole("button", { name: "Zoom in" });
  for (let i = 0; i < 8; i++) {
    await zoomInBtn.click();
  }
  await expect(page.getByText("300%")).toBeVisible();
  await page.waitForTimeout(100);

  // Set scroll offset so there is room to scroll towards top-left
  await stage.evaluate((el) => {
    el.scrollLeft = 200;
    el.scrollTop = 200;
  });

  const cornerBox = await firstCorner.boundingBox();
  expect(cornerBox).not.toBeNull();
  if (!cornerBox) return;

  // Start dragging corner
  await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2);
  await page.mouse.down();

  const initialScroll = await stage.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));

  // Move pointer near the top-left boundary of the stage
  await page.mouse.move(stageBox.x + 10, stageBox.y + 10);

  // Auto-pan should continuously scroll stage left and top
  await expect(async () => {
    const currentScroll = await stage.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
    expect(currentScroll.left).toBeLessThan(initialScroll.left);
    expect(currentScroll.top).toBeLessThan(initialScroll.top);
  }).toPass({ timeout: 5000 });

  await page.mouse.up();
});

test("dynamically flips loupe below handle and clamps within viewport when dragging top corner handle", async ({ page }) => {
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles(fixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();

  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  const stage = page.locator(".stage");
  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;

  const cornerBox = await firstCorner.boundingBox();
  expect(cornerBox).not.toBeNull();
  if (!cornerBox) return;

  // Press down on Corner 1 (top-left corner)
  await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2);
  await page.mouse.down();

  const loupe = page.locator(".loupeOverlay");
  await expect(loupe).toBeVisible();

  // The top-left corner is near the top of the canvas, so the loupe must flip below the handle
  await expect(loupe).toHaveAttribute("data-placement", "bottom");

  const loupeBox = await loupe.boundingBox();
  expect(loupeBox).not.toBeNull();
  if (!loupeBox) return;

  // Verify loupe is positioned below the corner handle (its top is below the handle center)
  expect(loupeBox.y).toBeGreaterThan(cornerBox.y);

  // Verify loupe is completely inside the visible stage bounds (no clipping on top or left)
  expect(loupeBox.y).toBeGreaterThanOrEqual(stageBox.y);
  expect(loupeBox.x).toBeGreaterThanOrEqual(stageBox.x);
  expect(loupeBox.x + loupeBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 1);

  await page.mouse.up();
  await expect(loupe).not.toBeVisible();
});

test("canvas quad stroke aligns with Teal Precision tokens and adapts across themes", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__canvasStrokeStyles = [];
    const origStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function () {
      (window as any).__canvasStrokeStyles.push(this.strokeStyle);
      return origStroke.apply(this, arguments as any);
    };
  });

  await page.goto("/");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(fixture);
  await expect(page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" })).toBeVisible();

  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  // 1. Verify in light theme, strokeStyle matches Teal Precision light (#0f766e) and NOT terracotta (#c84535)
  const lightStrokes: string[] = await page.evaluate(() => (window as any).__canvasStrokeStyles);
  expect(lightStrokes.some((s) => s === "#0f766e" || s === "rgb(15, 118, 110)")).toBe(true);
  expect(lightStrokes.some((s) => s.includes("200, 69, 53") || s.toLowerCase() === "#c84535")).toBe(false);

  // 2. Switch theme to Dark
  await page.evaluate(() => ((window as any).__canvasStrokeStyles = []));
  const themeSelect = page.locator("label.themeSetting select").first();
  if (await themeSelect.isVisible()) {
    await themeSelect.selectOption("dark");
  } else {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
  }

  // Wait for canvas repaint in dark theme
  await expect
    .poll(
      async () => {
        const darkStrokes: string[] = await page.evaluate(() => (window as any).__canvasStrokeStyles);
        return darkStrokes.some((s) => s === "#32c8ba" || s === "rgb(50, 200, 186)");
      },
      { timeout: 5000 },
    )
    .toBe(true);
});

test("preserves page indicator, filename, and mobile floating navigation controls on narrow screens", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles([fixture, fixture2]);

  // Review bar title and page indicator are visible on mobile
  const title = page.locator(".reviewBar .title");
  await expect(title).toBeVisible();

  const pageIndicator = page.locator(".reviewBar .title .reviewPageIndicator");
  await expect(pageIndicator).toBeVisible();
  await expect(pageIndicator).toHaveText("01 / 02");

  const fileName = page.locator(".reviewBar .title .reviewFileName");
  await expect(fileName).toBeVisible();
  await expect(fileName).toHaveText("dark-slid...ght-wall.png");

  // Tapping the filename opens the full-name popover (touch friendly)
  await fileName.click();
  const popover = page.locator(".reviewFileNamePopover");
  await expect(popover).toBeVisible();
  await expect(popover).toHaveText("dark-slide-light-wall.png");

  // Pressing Escape dismisses the popover
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);

  // In mobile review bar, inline prev/next buttons are hidden
  await expect(page.locator(".reviewPrevious")).toBeHidden();
  await expect(page.locator(".reviewNext")).toBeHidden();

  // Mobile floating navigation buttons on stage are visible
  const prevFloating = page.locator(".stageFloatingNav--prev");
  const nextFloating = page.locator(".stageFloatingNav--next");
  await expect(prevFloating).toBeVisible();
  await expect(nextFloating).toBeVisible();

  // Verify touch target dimensions are at least 44x44px
  const prevBox = await prevFloating.boundingBox();
  expect(prevBox).not.toBeNull();
  if (prevBox) {
    expect(prevBox.width).toBeGreaterThanOrEqual(44);
    expect(prevBox.height).toBeGreaterThanOrEqual(44);
  }

  const nextBox = await nextFloating.boundingBox();
  expect(nextBox).not.toBeNull();
  if (nextBox) {
    expect(nextBox.width).toBeGreaterThanOrEqual(44);
    expect(nextBox.height).toBeGreaterThanOrEqual(44);
  }

  // On first slide: prev is disabled, next is enabled
  await expect(prevFloating).toBeDisabled();
  await expect(nextFloating).toBeEnabled();

  // Click next floating button to go to slide 2
  await nextFloating.click();
  await expect(pageIndicator).toHaveText("02 / 02");
  await expect(fileName).toHaveText("light-sli...ark-wall.png");

  // On second slide: next is disabled, prev is enabled
  await expect(nextFloating).toBeDisabled();
  await expect(prevFloating).toBeEnabled();

  // Click prev floating button to return to slide 1
  await prevFloating.click();
  await expect(pageIndicator).toHaveText("01 / 02");
  await expect(fileName).toHaveText("dark-slid...ght-wall.png");

  // Auto straighten and test pointer-events during corner drag
  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  const cornerBox = await firstCorner.boundingBox();
  expect(cornerBox).not.toBeNull();
  if (cornerBox) {
    await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2);
    await page.mouse.down();
    // While dragging handle, stageArea has isDraggingHandle and stageFloatingNav has pointer-events: none
    const stageArea = page.locator(".stageArea");
    await expect(stageArea).toHaveClass(/isDraggingHandle/);
    const pointerEvents = await nextFloating.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");

    await page.mouse.move(cornerBox.x + cornerBox.width / 2 + 10, cornerBox.y + cornerBox.height / 2 + 5);
    await page.mouse.up();
    await expect(stageArea).not.toHaveClass(/isDraggingHandle/);
  }
});

test("desktop review bar retains previous/next buttons and page indicator without floating controls", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles([fixture, fixture2]);

  // On desktop, stage floating navigation is hidden
  await expect(page.locator(".stageFloatingNav--prev")).toBeHidden();
  await expect(page.locator(".stageFloatingNav--next")).toBeHidden();

  // Desktop review bar buttons are visible
  const desktopPrev = page.locator(".reviewPrevious");
  const desktopNext = page.locator(".reviewNext");
  await expect(desktopPrev).toBeVisible();
  await expect(desktopNext).toBeVisible();

  // Page indicator and full file name are displayed
  const pageIndicator = page.locator(".reviewBar .title .reviewPageIndicator");
  const fileName = page.locator(".reviewBar .title .reviewFileName");
  await expect(pageIndicator).toBeVisible();
  await expect(pageIndicator).toHaveText("01 / 02");
  await expect(fileName).toBeVisible();
  await expect(fileName).toHaveText("dark-slide-light-wall.png");

  // On first slide, previous is disabled and next is enabled
  await expect(desktopPrev).toBeDisabled();
  await expect(desktopNext).toBeEnabled();

  // Navigate using desktop next button
  await desktopNext.click();
  await expect(pageIndicator).toHaveText("02 / 02");
  await expect(fileName).toHaveText("light-slide-dark-wall.png");
  await expect(desktopNext).toBeDisabled();
  await expect(desktopPrev).toBeEnabled();

  // Navigate back using desktop previous button
  await desktopPrev.click();
  await expect(pageIndicator).toHaveText("01 / 02");
  await expect(fileName).toHaveText("dark-slide-light-wall.png");
});







