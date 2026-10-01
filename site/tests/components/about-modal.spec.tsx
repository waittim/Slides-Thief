import { test, expect } from "@playwright/experimental-ct-react";
import { AboutModalHarness } from "./AboutModalHarness";

test("renders split keyboard shortcut keycaps with consistent sizing", async ({ mount }) => {
  const component = await mount(<AboutModalHarness />);
  await component.locator(".modalCard").waitFor();

  const redo = component.locator(".shortcutItem").filter({ hasText: "重做上一步撤销" });
  await expect(redo.locator("kbd")).toHaveText(["⌘", "⇧", "Z", "Ctrl", "Shift", "Z"]);

  const exportShortcut = component.locator(".shortcutItem").filter({ hasText: "一键导出 PDF" });
  await expect(exportShortcut.locator("kbd")).toHaveText(["⌘", "↵", "Ctrl", "Enter"]);

  const fontSizes = await component.locator("kbd").evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).fontSize),
  );
  expect(fontSizes.length).toBeGreaterThan(0);
  expect(new Set(fontSizes)).toEqual(new Set(["13px"]));
});

test("renders privacy statement and interactive telemetry toggle switch", async ({ mount }) => {
  const component = await mount(<AboutModalHarness />);
  await component.locator(".modalCard").waitFor();

  // Privacy text is displayed
  await expect(component.locator(".modalPrivacy")).toContainText("照片与生成的 PDF 仅在您的浏览器本地处理，绝不会上传至任何远程服务器。");
  const disclosure = component.getByRole("button", { name: "使用统计" });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(component.locator(".modalTelemetryDesc")).toBeHidden();
  const telemetrySwitch = component.getByRole("switch", { name: "使用统计" });
  await expect(telemetrySwitch).toBeVisible();
  const disclosureBox = await disclosure.boundingBox();
  const switchBox = await telemetrySwitch.boundingBox();
  expect(disclosureBox && switchBox).toBeTruthy();
  expect(Math.abs((disclosureBox!.y + disclosureBox!.height / 2) - (switchBox!.y + switchBox!.height / 2))).toBeLessThan(8);
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(component.locator(".modalTelemetryDesc")).toContainText("改进产品");

  // Telemetry is on by default and can be disabled.
  await expect(telemetrySwitch).toBeVisible();
  await expect(telemetrySwitch).toBeChecked();
  await expect(telemetrySwitch.locator(".switchLabel")).toHaveText("已启用");

  // Toggle off
  await telemetrySwitch.click();
  await expect(telemetrySwitch).not.toBeChecked();
  await expect(telemetrySwitch.locator(".switchLabel")).toHaveText("已禁用");

  // Toggle back on
  await telemetrySwitch.click();
  await expect(telemetrySwitch).toBeChecked();
  await expect(telemetrySwitch.locator(".switchLabel")).toHaveText("已启用");

  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(telemetrySwitch).toBeVisible();
});

test("navigates into in-app privacy notice and back to about view without navigation", async ({ mount }) => {
  const component = await mount(<AboutModalHarness />);
  await component.locator(".modalCard").waitFor();

  // Expand telemetry disclosure
  const disclosure = component.getByRole("button", { name: "使用统计" });
  await disclosure.click();

  // Find and click the privacy notice trigger button
  const privacyNoticeBtn = component.getByRole("button", { name: "本站隐私说明" });
  await expect(privacyNoticeBtn).toBeVisible();
  await privacyNoticeBtn.click();

  // Verify privacy view is active inside the modal
  await expect(component.locator(".modalPrivacyArticle")).toBeVisible();
  await expect(component.locator(".modalTitle h3")).toHaveText("本站隐私说明");
  await expect(component.locator(".modalPrivacySectionTitle")).toHaveText([
    "运营方与联系方式",
    "照片与 PDF 处理",
    "使用统计",
    "您的选择与保存期限",
    "您的权利",
  ]);

  // Verify external escape hatch link
  const externalLink = component.locator(".modalPrivacyOpenExternal");
  await expect(externalLink).toBeVisible();
  await expect(externalLink).toHaveAttribute("href", "./privacy.html");
  await expect(externalLink).toHaveAttribute("target", "_blank");

  // Verify header back button returns to About view
  const backBtn = component.locator(".modalBackButton");
  await expect(backBtn).toBeVisible();
  await expect(backBtn).toHaveAttribute("aria-label", "返回关于");
  await backBtn.click();

  // Back in About view
  await expect(component.locator(".modalPrivacyArticle")).toBeHidden();
  await expect(component.locator(".modalTitle h3")).toContainText("关于 Slides Thief");
  await expect(component.locator(".shortcutGrid")).toBeVisible();
});
