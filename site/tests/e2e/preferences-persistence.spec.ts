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
  await expect(page.getByRole("button", { name: "点击或拖拽上传", exact: true })).toBeVisible();

  // Reload page
  await page.reload();

  // Language should remain zh-CN after reload
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("label.languageSetting select:visible").first()).toHaveValue("zh-CN");
  await expect(page.getByRole("button", { name: "点击或拖拽上传", exact: true })).toBeVisible();
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

test("persists telemetry opt-out across page reload and sets ga-disable flag", async ({ page }) => {
  await page.goto("/");

  // 1. Open the About modal
  const infoButton = page.locator("button.infoButton:visible").first();
  await expect(infoButton).toBeVisible();
  await infoButton.click();

  const modalCard = page.locator(".modalCard");
  await expect(modalCard).toBeVisible();

  // 2. Find telemetry switch inside modal, verify it starts enabled
  const telemetrySwitch = page.getByRole("switch", { name: /Anonymous Usage Analytics|匿名使用统计/i });
  await expect(telemetrySwitch).toBeVisible();
  await expect(telemetrySwitch).toBeChecked();

  // 3. Toggle off telemetry
  await telemetrySwitch.click();
  await expect(telemetrySwitch).not.toBeChecked();

  // 4. Verify ga-disable flag is set on window
  const isOptedOutBeforeReload = await page.evaluate(() => {
    return (window as unknown as Record<string, unknown>)["ga-disable-G-74RGGMV3PH"] === true;
  });
  expect(isOptedOutBeforeReload).toBe(true);

  // 5. Reload page
  await page.reload();

  // 6. Verify window ga-disable flag is set immediately on reload (from pre-load script)
  const isOptedOutAfterReload = await page.evaluate(() => {
    return (window as unknown as Record<string, unknown>)["ga-disable-G-74RGGMV3PH"] === true;
  });
  expect(isOptedOutAfterReload).toBe(true);

  // 7. Open About modal again and verify switch remains unchecked
  const infoButtonAfterReload = page.locator("button.infoButton:visible").first();
  await infoButtonAfterReload.click();
  const telemetrySwitchAfterReload = page.getByRole("switch", { name: /Anonymous Usage Analytics|匿名使用统计/i });
  await expect(telemetrySwitchAfterReload).toBeVisible();
  await expect(telemetrySwitchAfterReload).not.toBeChecked();
});

test("desktop renders preferences in semantic nav while mobile unifies them in settings menu", async ({ page }) => {
  // 1. Desktop viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  // Semantic nav landmark is present with aria-label
  const prefsNav = page.locator("nav.prefsBar");
  await expect(prefsNav).toBeVisible();
  await expect(prefsNav).toHaveAttribute("aria-label", /Preferences|偏好设置/);

  // No footer used for prefsBar
  await expect(page.locator("footer.prefsBar")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);

  // Desktop preference bar controls are visible
  await expect(prefsNav.locator(".infoButton")).toBeVisible();
  await expect(prefsNav.locator(".themeSetting select")).toBeVisible();
  await expect(prefsNav.locator(".languageSetting select")).toBeVisible();

  // Desktop duplicate menu controls inside topbar are hidden
  await expect(page.locator(".settingsMenuBody > .settingsMenuTheme")).toBeHidden();
  await expect(page.locator(".settingsMenuBody > .settingsMenuLanguage")).toBeHidden();
  await expect(page.locator(".settingsMenuBody > .settingsMenuInfo")).toBeHidden();

  // 2. Switch to Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });

  // On mobile, prefsBar is hidden
  await expect(prefsNav).toBeHidden();

  // Open the mobile settings dropdown menu
  const settingsToggle = page.locator(".settingsMenuToggle");
  await settingsToggle.click();

  // Unified preferences controls in settings menu are now visible
  const mobileThemeSelect = page.locator(".settingsMenuBody > .settingsMenuTheme select");
  const mobileLangSelect = page.locator(".settingsMenuBody > .settingsMenuLanguage select");
  const mobileInfoButton = page.locator(".settingsMenuBody > .settingsMenuInfo");

  await expect(mobileThemeSelect).toBeVisible();
  await expect(mobileLangSelect).toBeVisible();
  await expect(mobileInfoButton).toBeVisible();

  // Changing theme from mobile menu updates html theme attribute
  await mobileThemeSelect.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Clicking mobile info button opens the About modal
  await mobileInfoButton.click();
  await expect(page.locator(".modalCard")).toBeVisible();
  await expect(page.getByRole("button", { name: /Close|关闭/i })).toBeVisible();
});
