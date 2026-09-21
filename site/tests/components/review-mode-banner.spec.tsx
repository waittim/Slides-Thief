import { test, expect } from "@playwright/experimental-ct-react";
import { ReviewModeBannerHarness } from "./ReviewModeBannerHarness";

test("renders review mode banner with title, progress counter, and navigation buttons", async ({
  mount,
}) => {
  const component = await mount(
    <ReviewModeBannerHarness initialIndex={0} initialTotal={3} pendingFormat="pdf" />,
  );

  const banner = component.locator(".reviewModeBanner");
  await expect(banner).toBeVisible();

  await expect(banner.locator(".reviewModeTitle")).toHaveText("复查模式");
  await expect(banner.locator(".reviewModeProgress")).toHaveText("第 1 / 3 张待复查");

  const prevBtn = banner.locator(".reviewNavPrevBtn");
  const nextBtn = banner.locator(".reviewNavNextBtn");
  const confirmBtn = banner.locator(".reviewConfirmBtn");
  const exportNowBtn = banner.locator(".reviewExportNowBtn");
  const exitBtn = banner.locator(".reviewExitBtn");

  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();
  await expect(confirmBtn).toHaveText("确认无误");
  await expect(confirmBtn).toHaveClass(/uiButton--primary/);
  await expect(exportNowBtn).toHaveText("生成 PDF");
  await expect(exitBtn).toHaveText("退出复查");
});

test("navigating with next and prev buttons updates review index and disabled states", async ({
  mount,
}) => {
  const component = await mount(
    <ReviewModeBannerHarness initialIndex={0} initialTotal={3} pendingFormat="pdf" />,
  );

  const prevBtn = component.locator(".reviewNavPrevBtn");
  const nextBtn = component.locator(".reviewNavNextBtn");
  const progress = component.locator(".reviewModeProgress");

  await expect(prevBtn).toBeDisabled();
  await expect(nextBtn).toBeEnabled();
  await expect(progress).toHaveText("第 1 / 3 张待复查");

  // Click next -> index 1
  await nextBtn.click();
  await expect(prevBtn).toBeEnabled();
  await expect(nextBtn).toBeEnabled();
  await expect(progress).toHaveText("第 2 / 3 张待复查");

  // Click next -> index 2 (last)
  await nextBtn.click();
  await expect(prevBtn).toBeEnabled();
  await expect(nextBtn).toBeDisabled();
  await expect(progress).toHaveText("第 3 / 3 张待复查");

  // Click prev -> index 1
  await prevBtn.click();
  await expect(prevBtn).toBeEnabled();
  await expect(nextBtn).toBeEnabled();
  await expect(progress).toHaveText("第 2 / 3 张待复查");
});

test("clicking confirm button confirms slide and updates count", async ({ mount }) => {
  const component = await mount(
    <ReviewModeBannerHarness initialIndex={0} initialTotal={2} pendingFormat="pdf" />,
  );

  const confirmBtn = component.locator(".reviewConfirmBtn");
  const statusConfirmed = component.locator(".statusConfirmedCount");

  await expect(statusConfirmed).toHaveText("0");
  await confirmBtn.click();
  await expect(statusConfirmed).toHaveText("1");
  await expect(component.locator(".statusTotal")).toHaveText("1");

  // Confirm last remaining slide
  await confirmBtn.click();
  await expect(statusConfirmed).toHaveText("2");
  await expect(component.locator(".statusTotal")).toHaveText("0");

  // When total is 0, banner shows all confirmed and primary export button
  await expect(component.locator(".reviewModeAllDone")).toHaveText("全部待复查照片已确认");
  await expect(component.locator(".reviewExportNowBtn")).toHaveClass(/uiButton--primary/);
});

test("clicking export now and exit buttons trigger respective actions", async ({ mount }) => {
  const component = await mount(
    <ReviewModeBannerHarness initialIndex={0} initialTotal={2} pendingFormat="pdf" />,
  );

  const exportBtn = component.locator(".reviewExportNowBtn");
  const exitBtn = component.locator(".reviewExitBtn");

  await exportBtn.click();
  await expect(component.locator(".statusExported")).toHaveText("pdf");

  await exitBtn.click();
  await expect(component.locator(".statusExited")).toHaveText("exited");
});
