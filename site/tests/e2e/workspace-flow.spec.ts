import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("../../../tests/fixtures/detection/synthetic/light-slide-dark-wall.png", import.meta.url));
const fixture2 = fileURLToPath(new URL("../../../tests/fixtures/detection/synthetic/dark-slide-light-wall.png", import.meta.url));

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


