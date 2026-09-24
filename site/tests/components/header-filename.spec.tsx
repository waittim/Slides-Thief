import { test, expect } from "@playwright/experimental-ct-react";
import { HeaderHarness } from "./HeaderHarness";

test("displays fallback placeholder when filename is empty", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialPdfBaseName="" initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute("placeholder", "flattened_slides");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toHaveCount(0);
});

test("preserves raw input without swallowing characters and shows inline error message", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await expect(input).toBeVisible();

  // Type characters with illegal symbol ":"
  await input.fill("报告:第一场");

  // Verify the colon was NOT swallowed
  await expect(input).toHaveValue("报告:第一场");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", "pdf-name-error");

  const errorDiv = component.locator("#pdf-name-error");
  await expect(errorDiv).toBeVisible();
  await expect(errorDiv).toContainText("文件名不能包含 / \\ : * ? \" < > | 等字符");
});

test("clears validation error when user fixes the invalid characters", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await input.fill("报告:第一场");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toBeVisible();

  // User corrects the text
  await input.fill("报告第一场");
  await expect(input).toHaveValue("报告第一场");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toHaveCount(0);
});

test("shows invalid extension error when typing .pdf and normalizes on blur", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await input.fill("quarterly_report.pdf");

  // Shows warning for typing .pdf
  await expect(input).toHaveValue("quarterly_report.pdf");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const errorDiv = component.locator("#pdf-name-error");
  await expect(errorDiv).toBeVisible();
  await expect(errorDiv).toContainText("无需输入 .pdf 后缀");

  // Blur by clicking outside
  await component.getByTestId("outside-button").click();

  // Should normalize on blur
  await expect(input).toHaveValue("quarterly_report");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toHaveCount(0);
});

test("normalizes invalid characters on blur", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await input.fill("报告:第一场");
  await expect(input).toHaveValue("报告:第一场");

  // Blur by clicking outside
  await component.getByTestId("outside-button").click();

  // Should sanitize on blur
  await expect(input).toHaveValue("报告第一场");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toHaveCount(0);
});

test("displays trailing period or space warning and trims on blur", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="zh-CN" />);

  const input = component.locator("label.pdfNameSetting input");
  await input.fill("presentation ");

  await expect(input).toHaveAttribute("aria-invalid", "true");
  const errorDiv = component.locator("#pdf-name-error");
  await expect(errorDiv).toBeVisible();
  await expect(errorDiv).toContainText("文件名末尾不能包含空格或句点");

  // Blur trims trailing space
  await component.getByTestId("outside-button").click();

  await expect(input).toHaveValue("presentation");
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(component.locator("#pdf-name-error")).toHaveCount(0);
});

test("supports English locale error messages", async ({ mount }) => {
  const component = await mount(<HeaderHarness initialLocale="en" />);

  const input = component.locator("label.pdfNameSetting input");
  await input.fill("invalid:name");

  await expect(input).toHaveAttribute("aria-invalid", "true");
  const errorDiv = component.locator("#pdf-name-error");
  await expect(errorDiv).toBeVisible();
  await expect(errorDiv).toContainText("Filename cannot contain");
});
