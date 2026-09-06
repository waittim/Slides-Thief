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
