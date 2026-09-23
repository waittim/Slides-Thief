import { test, expect } from "@playwright/experimental-ct-react";
import { ShortcutsModalHarness } from "./ShortcutsModalHarness";

test("renders all shortcut items and keycaps with accessible dialog markup", async ({ mount }) => {
  const component = await mount(<ShortcutsModalHarness />);
  const modal = component.locator(".modalCard.shortcutsModal");
  await modal.waitFor();

  // Dialog semantics
  await expect(modal).toHaveAttribute("role", "dialog");
  await expect(modal).toHaveAttribute("aria-modal", "true");
  await expect(modal.locator(".modalHeader h3")).toHaveText("快捷键指南");

  // Key shortcuts verified
  const navShortcut = component.locator(".shortcutItem").filter({ hasText: "切换上一页 / 下一页" });
  await expect(navShortcut.locator("kbd")).toHaveText(["J", "K"]);

  const reorderShortcut = component.locator(".shortcutItem").filter({ hasText: "上移 / 下移选中的幻灯片" });
  await expect(reorderShortcut.locator("kbd")).toHaveText(["Alt", "↑", "Alt", "↓"]);

  const deleteShortcut = component.locator(".shortcutItem").filter({ hasText: "删除选中的幻灯片" });
  await expect(deleteShortcut.locator("kbd")).toHaveText(["Delete", "Backspace"]);

  const undoShortcut = component.locator(".shortcutItem").filter({ hasText: "撤销角点或页面调整" });
  await expect(undoShortcut.locator("kbd")).toHaveText(["⌘", "Z", "Ctrl", "Z"]);

  const redoShortcut = component.locator(".shortcutItem").filter({ hasText: "重做上一步撤销" });
  await expect(redoShortcut.locator("kbd")).toHaveText(["⌘", "⇧", "Z", "Ctrl", "Shift", "Z"]);

  const exportShortcut = component.locator(".shortcutItem").filter({ hasText: "一键导出 PDF" });
  await expect(exportShortcut.locator("kbd")).toHaveText(["⌘", "↵", "Ctrl", "Enter"]);

  const escShortcut = component.locator(".shortcutItem").filter({ hasText: "关闭弹窗 / 退出复核" });
  await expect(escShortcut.locator("kbd")).toHaveText(["Esc"]);

  const helpShortcut = component.locator(".shortcutItem").filter({ hasText: "打开快捷键指南" });
  await expect(helpShortcut.locator("kbd")).toHaveText(["?"]);
});

test("closes when close button is clicked", async ({ mount }) => {
  const component = await mount(<ShortcutsModalHarness />);
  const modal = component.locator(".modalCard.shortcutsModal");
  await modal.waitFor();

  const closeBtn = modal.locator(".modalCloseButton");
  await closeBtn.click();
  await expect(component.getByTestId("modal-open-status")).toHaveText("closed");
  await expect(modal).toHaveCount(0);
});

test("closes when Escape key is pressed", async ({ mount, page }) => {
  const component = await mount(<ShortcutsModalHarness />);
  const modal = component.locator(".modalCard.shortcutsModal");
  await modal.waitFor();

  await page.keyboard.press("Escape");
  await expect(component.getByTestId("modal-open-status")).toHaveText("closed");
  await expect(modal).toHaveCount(0);
});

test("closes when backdrop overlay is clicked", async ({ mount }) => {
  const component = await mount(<ShortcutsModalHarness />);
  const overlay = component.locator(".modalOverlay");
  await overlay.waitFor();

  // Click outside modalCard
  await overlay.click({ position: { x: 10, y: 10 } });
  await expect(component.getByTestId("modal-open-status")).toHaveText("closed");
});
