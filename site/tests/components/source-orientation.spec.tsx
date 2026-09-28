import { test, expect } from "@playwright/experimental-ct-react";
import { SourceOrientationHarness } from "./SourceOrientationHarness";
import { localeOptions, copy, ratioUiCopy } from "../../app/i18n";

test("Switch accessible name remains stable as '方向' when toggled in zh-CN", async ({ mount }) => {
  const component = await mount(<SourceOrientationHarness locale="zh-CN" initialOrientation="landscape" />);

  // Switch should have accessible name "方向"
  const switchControl = component.getByRole("switch", { name: "方向" });
  await expect(switchControl).toBeVisible();
  await expect(switchControl).not.toBeChecked();

  // The visual label and accessible description reflect current state "横向"
  await expect(switchControl.locator(".switchLabel")).toHaveText("横向");
  const describedById = await switchControl.getAttribute("aria-describedby");
  expect(describedById).toBeTruthy();
  const descElement = component.locator(`#${describedById}`);
  await expect(descElement).toHaveText("横向");

  // Toggle to portrait
  await switchControl.click();

  // Accessible name MUST STILL BE "方向", NOT changed to "纵向"
  await expect(component.getByRole("switch", { name: "方向" })).toBeVisible();
  await expect(switchControl).toBeChecked();
  await expect(switchControl.locator(".switchLabel")).toHaveText("纵向");
  await expect(descElement).toHaveText("纵向");

  // Toggle back to landscape
  await switchControl.click();
  await expect(component.getByRole("switch", { name: "方向" })).toBeVisible();
  await expect(switchControl).not.toBeChecked();
  await expect(switchControl.locator(".switchLabel")).toHaveText("横向");
});

test("Switch accessible name remains stable as 'Orientation' when toggled in en", async ({ mount }) => {
  const component = await mount(<SourceOrientationHarness locale="en" initialOrientation="landscape" />);

  const switchControl = component.getByRole("switch", { name: "Orientation" });
  await expect(switchControl).toBeVisible();
  await expect(switchControl).not.toBeChecked();
  await expect(switchControl.locator(".switchLabel")).toHaveText("Landscape");

  await switchControl.click();
  await expect(component.getByRole("switch", { name: "Orientation" })).toBeVisible();
  await expect(switchControl).toBeChecked();
  await expect(switchControl.locator(".switchLabel")).toHaveText("Portrait");
});

test("Switch accessible name matches text.orientation across all 9 locales", async ({ mount }) => {
  for (const { value: locale } of localeOptions) {
    const expectedName = copy[locale].orientation;
    const expectedLandscape = ratioUiCopy[locale].landscape;
    const expectedPortrait = ratioUiCopy[locale].portrait;

    const component = await mount(
      <SourceOrientationHarness locale={locale} initialOrientation="landscape" />,
    );

    const switchControl = component.getByRole("switch", { name: expectedName });
    await expect(switchControl).toBeVisible();
    await expect(switchControl).not.toBeChecked();
    await expect(switchControl.locator(".switchLabel")).toHaveText(expectedLandscape);

    await switchControl.click();
    await expect(component.getByRole("switch", { name: expectedName })).toBeVisible();
    await expect(switchControl).toBeChecked();
    await expect(switchControl.locator(".switchLabel")).toHaveText(expectedPortrait);

    await component.unmount();
  }
});
