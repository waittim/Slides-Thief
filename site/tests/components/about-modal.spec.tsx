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
  expect(new Set(fontSizes)).toEqual(new Set(["12px"]));
});

test("renders privacy statement and interactive telemetry toggle switch", async ({ mount }) => {
  const component = await mount(<AboutModalHarness />);
  await component.locator(".modalCard").waitFor();

  // Privacy text is displayed
  await expect(component.locator(".modalPrivacy")).toContainText("照片与生成的 PDF 仅在您的浏览器本地处理，绝不会上传至任何远程服务器。");

  // Telemetry switch is displayed and initially checked
  const telemetrySwitch = component.getByRole("switch", { name: "匿名使用统计" });
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
});
