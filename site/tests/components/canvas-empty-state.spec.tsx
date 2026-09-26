import { test, expect } from "@playwright/experimental-ct-react";
import { CanvasEmptyStateHarness } from "./CanvasEmptyStateHarness";

test("renders the 3-step workflow diagram, action buttons, and photography tips", async ({ mount }) => {
  const component = await mount(<CanvasEmptyStateHarness initialLocale="en" />);

  // Title and privacy badge
  await expect(component.getByText("Turn angled slide photos into flat, crystal-clear documents")).toBeVisible();
  await expect(component.getByText(/100% local browser processing/i)).toBeVisible();

  // 3-Step workflow
  await expect(component.getByText("1. Angled Photo")).toBeVisible();
  await expect(component.getByText("Snap slides or whiteboards from any seat in lectures or meetings")).toBeVisible();

  await expect(component.getByText("2. Detect Corners")).toBeVisible();
  await expect(component.getByText("Auto-detects slide boundary with precision loupe handles")).toBeVisible();

  await expect(component.getByText("3. Clean PDF")).toBeVisible();
  await expect(component.getByText("Corrects perspective, optimizes contrast, and exports sharp PDFs")).toBeVisible();

  // Action buttons
  const uploadBtn = component.getByRole("button", { name: /Click or drop images/i });
  const sampleBtn = component.getByRole("button", { name: "Try Sample Image" });
  await expect(uploadBtn).toBeVisible();
  await expect(sampleBtn).toBeVisible();

  // Photography tips
  const tips = component.getByText("Photography Tips for Best Results");
  await expect(tips).toBeVisible();
  await expect(component.getByText("Keep all 4 corners visible")).toBeHidden();
  await tips.click();
  await expect(component.getByText("Keep all 4 corners visible")).toBeVisible();
  await expect(component.getByText("Avoid glare and occlusions")).toBeVisible();
  await expect(component.getByText("Ensure clear edge contrast")).toBeVisible();
});

test("clicking upload and try sample image buttons dispatches actions", async ({ mount }) => {
  const component = await mount(<CanvasEmptyStateHarness initialLocale="en" />);

  const uploadBtn = component.getByRole("button", { name: /Click or drop images/i });
  const sampleBtn = component.getByRole("button", { name: "Try Sample Image" });

  await expect(component.getByTestId("upload-status")).toHaveText("not-uploaded");
  await uploadBtn.click();
  await expect(component.getByTestId("upload-status")).toHaveText("uploaded");

  await expect(component.getByTestId("sample-status")).toHaveText("not-sampled");
  await sampleBtn.click();
  await expect(component.getByTestId("sample-status")).toHaveText("sampled");
});

test("disables action buttons when busy is true", async ({ mount }) => {
  const component = await mount(<CanvasEmptyStateHarness initialLocale="en" initialBusy={true} />);

  const uploadBtn = component.getByRole("button", { name: /Click or drop images/i });
  const sampleBtn = component.getByRole("button", { name: "Try Sample Image" });

  await expect(uploadBtn).toBeDisabled();
  await expect(sampleBtn).toBeDisabled();
});

test("renders localized copy correctly in Simplified Chinese", async ({ mount }) => {
  const component = await mount(<CanvasEmptyStateHarness initialLocale="zh-CN" />);

  await expect(component.getByText("倾斜 PPT 翻拍，一键还原平整清晰")).toBeVisible();
  await expect(component.getByText(/100% 本地处理/i)).toBeVisible();
  await expect(component.getByText("1. 偏角抓拍")).toBeVisible();
  await expect(component.getByText("2. 智能贴边")).toBeVisible();
  await expect(component.getByText("3. 展平生成")).toBeVisible();
  await expect(component.getByRole("button", { name: "尝试示例图片" })).toBeVisible();
  await expect(component.getByText("拍摄小贴士 · 获得最佳校正效果")).toBeVisible();
});
