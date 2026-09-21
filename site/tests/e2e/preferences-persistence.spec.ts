import { test, expect } from "@playwright/test";

test("persists theme preference across page reload", async ({ page }) => {
  await page.goto("/");

  const themeSelect = page.locator("label.themeSetting select:visible").first();
  await expect(themeSelect).toBeVisible();

  // Select dark theme
  await themeSelect.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Reload page
  await page.reload();

  // Theme should remain dark after reload
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("label.themeSetting select:visible").first()).toHaveValue("dark");
});

test("persists explicit user locale choice across reload without being overwritten", async ({ page }) => {
  await page.goto("/");

  const langSelect = page.locator("label.languageSetting select:visible").first();
  await expect(langSelect).toBeVisible();

  // Explicitly select Simplified Chinese
  await langSelect.selectOption("zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("button", { name: "自动校正" })).toBeVisible();

  // Reload page
  await page.reload();

  // Language should remain zh-CN after reload
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("label.languageSetting select:visible").first()).toHaveValue("zh-CN");
  await expect(page.getByRole("button", { name: "自动校正" })).toBeVisible();
});

test("persists export settings, enhancement mode, and target filename across reload", async ({ page }) => {
  await page.goto("/");

  // 1. Modify PDF base name
  const pdfNameInput = page.locator("label.pdfNameSetting input");
  await expect(pdfNameInput).toBeVisible();
  await pdfNameInput.fill("my_custom_presentation");

  // 2. Open More settings if not open
  const moreDetails = page.locator("details.moreSettings");
  await expect(moreDetails).toBeAttached();
  const isOpen = await moreDetails.evaluate((el: HTMLDetailsElement) => el.open);
  if (!isOpen) {
    await moreDetails.locator("summary").click();
  }

  // 3. Select enhancement mode "clean"
  const enhancementSelect = page.locator("label.enhancementSetting select");
  await expect(enhancementSelect).toBeVisible();
  await enhancementSelect.selectOption("clean");

  // 4. Modify width
  const widthInput = page.locator('label:has(span:text-matches("Width|宽度", "i")) input').first();
  await expect(widthInput).toBeVisible();
  await widthInput.fill("1920");

  // 5. Modify quality
  const qualityInput = page.locator('label:has(span:text-matches("Export quality|导出质量", "i")) input').first();
  await expect(qualityInput).toBeVisible();
  await qualityInput.fill("88");

  // 6. Reload page
  await page.reload();

  // Verify all modified preferences were persisted
  await expect(page.locator("label.pdfNameSetting input")).toHaveValue("my_custom_presentation");

  const moreAfterReload = page.locator("details.moreSettings");
  const isStillOpen = await moreAfterReload.evaluate((el: HTMLDetailsElement) => el.open);
  if (!isStillOpen) {
    await moreAfterReload.locator("summary").click();
  }

  await expect(page.locator("label.enhancementSetting select")).toHaveValue("clean");
  await expect(page.locator('label:has(span:text-matches("Width|宽度", "i")) input').first()).toHaveValue("1920");
  await expect(page.locator('label:has(span:text-matches("Export quality|导出质量", "i")) input').first()).toHaveValue("88");
});
