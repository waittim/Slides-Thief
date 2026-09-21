import { test, expect } from "@playwright/experimental-ct-react";
import { ConfirmModalHarness } from "./ConfirmModalHarness";

test("renders destructive Clear All modal with danger button and descriptive labels", async ({
  mount,
  page,
}) => {
  const component = await mount(<ConfirmModalHarness mode="clear" initialOpen={true} />);
  const modal = component.locator(".modalCard");
  await modal.waitFor();

  await expect(modal.locator("#confirm-dialog-title")).toHaveText("清空全部图片");
  await expect(modal.locator("#confirm-dialog-desc")).toHaveText("确定要清空全部 5 张图片吗？");

  const confirmBtn = component.locator(".confirmModalConfirmBtn");
  const cancelBtn = component.locator(".confirmModalCancelBtn");

  await expect(confirmBtn).toHaveText("清空全部");
  await expect(confirmBtn).toHaveClass(/uiButton--danger/);
  await expect(cancelBtn).toHaveText("保留照片");
  await expect(cancelBtn).toHaveClass(/uiButton--secondary/);

  // Accessible dialog attributes
  await expect(modal).toHaveAttribute("role", "dialog");
  await expect(modal).toHaveAttribute("aria-modal", "true");
  await expect(modal).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
  await expect(modal).toHaveAttribute("aria-describedby", "confirm-dialog-desc");
});

test("renders review confirmation modal with primary button and informative verbs", async ({
  mount,
}) => {
  const component = await mount(<ConfirmModalHarness mode="review" initialOpen={true} />);
  const modal = component.locator(".modalCard");
  await modal.waitFor();

  await expect(modal.locator("#confirm-dialog-title")).toHaveText("导出前复查");
  await expect(modal.locator("#confirm-dialog-desc")).toHaveText("有 3 张照片建议复查。仍要生成 PDF 吗？");

  const confirmBtn = component.locator(".confirmModalConfirmBtn");
  const cancelBtn = component.locator(".confirmModalCancelBtn");

  await expect(confirmBtn).toHaveText("仍然生成");
  await expect(confirmBtn).toHaveClass(/uiButton--primary/);
  await expect(cancelBtn).toHaveText("先去复查");
  await expect(cancelBtn).toHaveClass(/uiButton--secondary/);
});

test("clicking cancel button closes modal and registers cancel action", async ({ mount }) => {
  const component = await mount(<ConfirmModalHarness mode="clear" initialOpen={true} />);
  await component.locator(".modalCard").waitFor();

  await component.locator(".confirmModalCancelBtn").click();
  await expect(component.locator(".modalCard")).toHaveCount(0);
  await expect(component.locator(".statusCanceled")).toHaveText("canceled");
  await expect(component.locator(".statusConfirmed")).toHaveText("not-confirmed");
});

test("clicking confirm button closes modal and registers confirm action", async ({ mount }) => {
  const component = await mount(<ConfirmModalHarness mode="clear" initialOpen={true} />);
  await component.locator(".modalCard").waitFor();

  await component.locator(".confirmModalConfirmBtn").click();
  await expect(component.locator(".modalCard")).toHaveCount(0);
  await expect(component.locator(".statusConfirmed")).toHaveText("confirmed");
  await expect(component.locator(".statusCanceled")).toHaveText("not-canceled");
});

test("pressing Escape key closes modal", async ({ mount, page }) => {
  const component = await mount(<ConfirmModalHarness mode="clear" initialOpen={true} />);
  await component.locator(".modalCard").waitFor();

  await page.keyboard.press("Escape");
  await expect(component.locator(".modalCard")).toHaveCount(0);
  await expect(component.locator(".statusOpen")).toHaveText("closed");
});
