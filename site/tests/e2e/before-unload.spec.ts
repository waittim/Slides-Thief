import { test, expect, openApp } from "./fixtures";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(
  new URL("../../../tests/fixtures/detection/synthetic/light-slide-dark-wall.png", import.meta.url),
);

test("does not warn on reload when no slides are loaded", async ({ page }) => {
  let dialogCount = 0;
  page.on("dialog", (dialog) => {
    if (dialog.type() === "beforeunload") {
      dialogCount++;
      void dialog.accept();
    }
  });

  await openApp(page);
  await expect(page.locator(".app")).not.toHaveAttribute("data-has-unsaved-work");

  await page.reload();
  expect(dialogCount).toBe(0);
});

test("warns on reload when unexported slides exist and keeps work when cancelled", async ({ page }) => {
  let beforeUnloadTriggered = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      beforeUnloadTriggered = true;
      await dialog.dismiss();
    }
  });

  await openApp(page);
  await page.locator('input[type="file"]').setInputFiles(fixture);

  await expect(
    page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" }),
  ).toBeVisible();
  await expect(page.locator(".app")).toHaveAttribute("data-has-unsaved-work", "true");

  // Attempting to reload triggers the beforeunload dialog; dismissing it cancels navigation
  try {
    await page.reload({ timeout: 2000 });
  } catch {
    // Dismissing beforeunload in Chromium aborts the reload navigation
  }

  expect(beforeUnloadTriggered).toBe(true);
  // Slides are preserved because reload was cancelled
  await expect(
    page.locator("button.slideSelectButton").filter({ hasText: "light-slide-dark-wall.png" }),
  ).toBeVisible();
});

test("clearing all slides removes unsaved work flag and allows clean reload", async ({ page }) => {
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      dialogCount++;
      await dialog.accept();
    }
  });

  await openApp(page);
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator(".app")).toHaveAttribute("data-has-unsaved-work", "true");

  // Click Clear All button
  const clearAllButton = page.getByRole("button", { name: "Clear all" });
  await expect(clearAllButton).toBeVisible();
  await clearAllButton.click();

  // Confirm modal opens
  const confirmButton = page.getByRole("dialog").getByRole("button", { name: /Clear|确定|清除/ });
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();

  // Unsaved flag is gone
  await expect(page.locator(".app")).not.toHaveAttribute("data-has-unsaved-work");

  // Reload without dialog
  await page.reload();
  expect(dialogCount).toBe(0);
});

test("exporting slides removes unsaved work flag, and modifying quads afterwards restores warning", async ({ page }) => {
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      dialogCount++;
      await dialog.dismiss();
    }
  });

  await openApp(page);
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator(".app")).toHaveAttribute("data-has-unsaved-work", "true");

  // Run auto straighten
  await page.getByRole("button", { name: "Auto straighten" }).click();
  const firstCorner = page.getByRole("button", { name: /Corner 1:/ });
  await expect(firstCorner).toBeVisible({ timeout: 30_000 });

  // Export PDF
  await page.keyboard.press("Control+Enter");
  const downloadLink = page.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toBeVisible({ timeout: 45_000 });

  // Unsaved work flag is now false because output was exported
  await expect(page.locator(".app")).not.toHaveAttribute("data-has-unsaved-work");

  // Reload does not trigger dialog
  await page.reload();
  expect(dialogCount).toBe(0);
});
