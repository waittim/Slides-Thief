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

