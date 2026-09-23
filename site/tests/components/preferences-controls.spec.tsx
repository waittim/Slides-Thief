import { test, expect } from "@playwright/experimental-ct-react";
import { PreferencesControlsHarness } from "./PreferencesControlsHarness";

test("renders desktop preference bar inside semantic nav with accessible label and privacy badge", async ({ mount }) => {
  const component = await mount(
    <PreferencesControlsHarness placement="bar" initialLocale="zh-CN" initialTheme="auto" />
  );

  const nav = component.locator("nav.prefsBar");
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("aria-label", "偏好设置");

  // Privacy badge is present in bar mode
  const privacyBadge = nav.locator(".privacyBadge");
  await expect(privacyBadge).toBeVisible();
  await expect(privacyBadge).toContainText("浏览器本地处理");

  // Info button is present with accessible label
  const infoButton = nav.locator(".infoButton");
  await expect(infoButton).toBeVisible();
  await expect(infoButton).toHaveAttribute("aria-label", "关于 Slides Thief · PPT捕手");
  await infoButton.click();
  await expect(component.getByTestId("info-status")).toHaveText("open");

  // Shortcuts button is present with accessible label and opens shortcuts
  const shortcutsButton = nav.locator(".shortcutsButton");
  await expect(shortcutsButton).toBeVisible();
  await expect(shortcutsButton).toHaveAttribute("aria-label", "快捷键指南 (?)");
  await expect(shortcutsButton).toHaveAttribute("title", "快捷键指南 (?)");
  await shortcutsButton.click();
  await expect(component.getByTestId("shortcuts-status")).toHaveText("open");

  // Theme select
  const themeSelect = nav.locator(".themeSetting select");
  await expect(themeSelect).toBeVisible();
  await expect(themeSelect).toHaveValue("auto");
  await themeSelect.selectOption("dark");
  await expect(component.getByTestId("theme-status")).toHaveText("dark");

  // Language select
  const langSelect = nav.locator(".languageSetting select");
  await expect(langSelect).toBeVisible();
  await expect(langSelect).toHaveValue("zh-CN");
  await langSelect.selectOption("en");
  await expect(component.getByTestId("locale-status")).toHaveText("en");
});

test("renders mobile menu placement without privacy badge and with menu layout classes", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const component = await mount(
    <PreferencesControlsHarness placement="menu" initialLocale="en" initialTheme="light" />
  );

  // Privacy badge should NOT be rendered in menu placement
  await expect(component.locator(".privacyBadge")).toHaveCount(0);

  // Info button has menu styling classes and is visible in mobile viewport
  const infoButton = component.locator(".infoButton.settingsMenuInfoRow.settingsMenuInfo");
  await expect(infoButton).toBeVisible();
  await expect(infoButton).toHaveAttribute("aria-label", "About Slides Thief");
  await infoButton.click();
  await expect(component.getByTestId("info-status")).toHaveText("open");

  // Shortcuts button has menu styling classes and is visible in mobile viewport
  const shortcutsButton = component.locator(".shortcutsButton.settingsMenuInfoRow.settingsMenuShortcuts");
  await expect(shortcutsButton).toBeVisible();
  await expect(shortcutsButton).toHaveAttribute("aria-label", "Keyboard Shortcuts (?)");
  await expect(shortcutsButton).toHaveAttribute("title", "Keyboard Shortcuts (?)");
  await shortcutsButton.click();
  await expect(component.getByTestId("shortcuts-status")).toHaveText("open");

  // Theme select has menu styling class
  const themeLabel = component.locator(".themeSetting.settingsMenuTheme");
  await expect(themeLabel).toBeVisible();
  const themeSelect = themeLabel.locator("select");
  await expect(themeSelect).toHaveValue("light");
  await themeSelect.selectOption("dark");
  await expect(component.getByTestId("theme-status")).toHaveText("dark");

  // Language select has menu styling class
  const langLabel = component.locator(".languageSetting.settingsMenuLanguage");
  await expect(langLabel).toBeVisible();
  const langSelect = langLabel.locator("select");
  await expect(langSelect).toHaveValue("en");
  await langSelect.selectOption("ja");
  await expect(component.getByTestId("locale-status")).toHaveText("ja");
});
