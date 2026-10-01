import { test, expect } from "./fixtures";

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

test("enables analytics by default and persists an explicit opt-out", async ({ page }) => {
  let tagRequests = 0;
  await page.route(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?.*/, async (route) => {
    tagRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  await page.goto("/");
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(1);
  await expect.poll(() => tagRequests).toBe(1);

  const infoButton = page.locator("button.infoButton:visible").first();
  await expect(infoButton).toBeVisible();
  await infoButton.click();
  const telemetrySwitch = page.getByRole("switch", { name: /Usage analytics|使用统计/i });
  const disclosure = page.getByRole("button", { name: /Usage analytics|使用统计/i });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(telemetrySwitch).toBeVisible();
  await expect(page.locator(".modalTelemetryDesc")).toBeHidden();
  await disclosure.click();
  await expect(telemetrySwitch).toBeVisible();
  await expect(telemetrySwitch).toBeChecked();

  // An explicit opt-out survives reload and prevents the tag from loading.
  await telemetrySwitch.click();
  await expect(telemetrySwitch).not.toBeChecked();
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(0);
  expect(tagRequests).toBe(1);
  const infoButtonAfterReload = page.locator("button.infoButton:visible").first();
  await infoButtonAfterReload.click();
  await page.getByRole("button", { name: /Usage analytics|使用统计/i }).click();
  const telemetrySwitchAfterReload = page.getByRole("switch", { name: /Usage analytics|使用统计/i });
  await expect(telemetrySwitchAfterReload).toBeVisible();
  await expect(telemetrySwitchAfterReload).not.toBeChecked();

  // Re-enabling loads the tag once and is itself persisted.
  await telemetrySwitchAfterReload.click();
  await expect(telemetrySwitchAfterReload).toBeChecked();
  await expect.poll(() => tagRequests).toBe(2);
  await page.reload();
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(1);
  await expect.poll(() => tagRequests).toBe(3);
});

test("consent region blocks Google until acceptance and remembers rejection", async ({ page }) => {
  await page.route("**/v1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ version: 1, defaultAllowed: false }) }),
  );
  let tagRequests = 0;
  await page.route(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?.*/, async (route) => {
    tagRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  await page.goto("/");
  const banner = page.getByRole("region", { name: /Usage analytics|使用统计/i });
  await expect(banner).toBeVisible();
  expect(tagRequests).toBe(0);
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(0);
  await page.locator("label.themeSetting select:visible").first().selectOption("dark");
  await page.reload();
  await expect(banner).toBeVisible();
  expect(tagRequests).toBe(0);
  await expect(banner.getByText(/improve Slides Thief|改进 Slides Thief/i)).toBeVisible();
  await banner.getByRole("button", { name: /View details|查看详情/i }).click();
  await expect(page.getByRole("button", { name: /Usage analytics|使用统计/i })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /Google Privacy Policy|Google 隐私政策/i })).toBeVisible();
  const privacyNoticeBtn = page.getByRole("button", { name: /Site privacy notice|本站隐私说明/i });
  await expect(privacyNoticeBtn).toBeVisible();
  await privacyNoticeBtn.click();
  await expect(page.locator(".modalPrivacyArticle")).toBeVisible();
  await expect(page.locator(".modalPrivacyOpenExternal")).toHaveAttribute("href", "./privacy.html");
  await page.locator(".modalBackButton").click();
  await expect(page.locator(".modalPrivacyArticle")).toBeHidden();
  await expect(page.getByRole("link", { name: /Privacy request contact|隐私请求联系方式/i })).toHaveAttribute("href", "https://www.zekun.blog/about/");
  await page.keyboard.press("Escape");
  await banner.getByRole("button", { name: /Reject|拒绝/i }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-hydrated", "true");
  await expect(banner).toHaveCount(0);
  expect(tagRequests).toBe(0);

  await page.locator("button.infoButton:visible").first().click();
  await page.getByRole("button", { name: /Usage analytics|使用统计/i }).click();
  await page.getByRole("switch", { name: /Usage analytics|使用统计/i }).click();
  await expect.poll(() => tagRequests).toBe(1);
  await page.reload();
  await expect.poll(() => tagRequests).toBe(2);
});

test("Enter accepts analytics from the page, while Enter on details opens About", async ({ page }) => {
  await page.route("**/v1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ version: 1, defaultAllowed: false }) }),
  );
  let tagRequests = 0;
  await page.route(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?.*/, async (route) => {
    tagRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  await page.goto("/");
  const banner = page.getByRole("region", { name: /Usage analytics|使用统计/i });
  await expect(banner).toBeVisible();
  const detailsButton = banner.getByRole("button", { name: /View details|查看详情/i });
  await detailsButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Usage analytics|使用统计/i })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /Google Privacy Policy|Google 隐私政策/i })).toBeVisible();
  expect(tagRequests).toBe(0);
  await page.keyboard.press("Escape");
  await expect(banner).toBeVisible();
  await detailsButton.evaluate((element) => (element as HTMLElement).blur());
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
  await expect.poll(() => tagRequests).toBe(1);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => tagRequests).toBe(2);
});

test("analytics waits for the edge decision before default-on loading", async ({ page }) => {
  let releasePolicy: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { releasePolicy = resolve; });
  await page.route("**/v1", async (route) => {
    await pending;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ version: 1, defaultAllowed: true }) });
  });
  await page.goto("/");
  await expect(page.locator(".app")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(0);
  await page.locator("button.infoButton:visible").first().click();
  await page.getByRole("button", { name: /Usage analytics|使用统计/i }).click();
  const pendingSwitch = page.getByRole("switch", { name: /Usage analytics|使用统计/i });
  await expect(pendingSwitch).toBeDisabled();
  releasePolicy?.();
  await expect(pendingSwitch).toBeEnabled();
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(1);
});

test("legacy enabled preference is not treated as consent, and policy failure fails closed", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("slides_thief_user_preferences", JSON.stringify({ version: 2, telemetry: true }));
  });
  await page.route("**/v1", (route) => route.fulfill({ status: 503 }));
  await page.goto("/");
  await expect(page.getByRole("region", { name: /Usage analytics|使用统计/i })).toBeVisible();
  await expect(page.locator('script[data-analytics-id]')).toHaveCount(0);
});

for (const version of [1, 2]) {
  test(`saved version ${version} analytics opt-out prevents tag loading`, async ({ page }) => {
    let tagRequests = 0;
    await page.route(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?.*/, async (route) => {
      tagRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
    });
    await page.addInitScript((storedVersion) => {
      localStorage.setItem("slides_thief_user_preferences", JSON.stringify({ version: storedVersion, telemetry: false }));
    }, version);
    await page.goto("/");
    const infoButton = page.locator("button.infoButton:visible").first();
    await infoButton.click();
    await page.getByRole("button", { name: /Usage analytics|使用统计/i }).click();
    await expect(page.getByRole("switch", { name: /Usage analytics|使用统计/i })).not.toBeChecked();
    expect(tagRequests).toBe(0);
    await expect(page.locator('script[data-analytics-id]')).toHaveCount(0);
  });
}

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
  const telemetryDisclosure = page.getByRole("button", { name: /Usage analytics|使用统计/i });
  const telemetrySwitch = page.getByRole("switch", { name: /Usage analytics|使用统计/i });
  await expect(telemetryDisclosure).toHaveAttribute("aria-expanded", "false");
  await expect(telemetrySwitch).toBeVisible();
  await expect(page.locator(".modalTelemetryDesc")).toBeHidden();
  const disclosureBox = await telemetryDisclosure.boundingBox();
  const switchBox = await telemetrySwitch.boundingBox();
  expect(disclosureBox && switchBox).toBeTruthy();
  expect(Math.abs((disclosureBox!.y + disclosureBox!.height / 2) - (switchBox!.y + switchBox!.height / 2))).toBeLessThan(8);
  await telemetryDisclosure.click();
  await expect(page.locator(".modalTelemetryDesc")).toBeVisible();
  await expect(telemetrySwitch).toBeVisible();
});
