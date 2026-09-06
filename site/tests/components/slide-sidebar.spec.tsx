import { test, expect } from "@playwright/experimental-ct-react";
import { SidebarHarness } from "./SidebarHarness";

test("file selection, straighten, and export controls follow the user-visible state", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-used-by-this-component-test"),
  });

  await expect(component.getByText("deck.png", { exact: true })).toBeVisible();
  await expect(component.getByRole("button", { name: "Auto straighten" })).toBeEnabled();
  await expect(component.getByRole("button", { name: "Generate PDF" })).toBeDisabled();

  await component.getByRole("button", { name: "Auto straighten" }).click();
  await expect(component.getByTestId("workflow-status")).toHaveText("straightened");
  await expect(component.getByRole("button", { name: "Generate PDF" })).toBeEnabled();

  await component.getByRole("button", { name: "Generate PDF" }).click();
  await expect(component.getByTestId("workflow-status")).toHaveText("exported");
  await expect(component.getByRole("link", { name: "Download PDF" })).toHaveAttribute("download", "deck.pdf");

  await expect(component.getByRole("button", { name: "Export corners" })).toBeEnabled();
  await component.getByRole("button", { name: "Export corners" }).click();
  await expect(component.getByTestId("workflow-status")).toHaveText("manual-exported");

  await component.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({
    name: "manual_quads.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"deck.png":[[12,10],[108,10],[108,70],[12,70]]}'),
  });
  await expect(component.getByTestId("workflow-status")).toHaveText("manual-imported");
});

test("split button toggle opens export menu and exports JPG for single slide with dual links", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-used-by-this-component-test"),
  });

  const exportToggle = component.getByRole("button", { name: "Export options" });
  await expect(exportToggle).toBeDisabled();

  await component.getByRole("button", { name: "Auto straighten" }).click();
  await expect(exportToggle).toBeEnabled();

  // Menu closed initially
  await expect(component.getByRole("menu")).toHaveCount(0);

  // Clicking chevron opens export menu
  await exportToggle.click();
  await expect(component.getByRole("menu")).toBeVisible();
  await expect(component.getByRole("menuitem", { name: /Export JPG images/i })).toBeVisible();

  // Clicking "Export JPG images" calls exportJpg and closes menu
  await component.getByRole("menuitem", { name: /Export JPG images/i }).click();
  await expect(component.getByTestId("workflow-status")).toHaveText("exported-jpg");
  await expect(component.getByRole("menu")).toHaveCount(0);

  // Download JPG link appears with single slide label and download attribute
  const downloadJpgLink = component.getByRole("link", { name: "Download JPG" });
  await expect(downloadJpgLink).toBeVisible();
  await expect(downloadJpgLink).toHaveAttribute("download", "deck.jpg");

  // Clicking Generate PDF enables PDF download as well; both links appear stacked
  await component.getByRole("button", { name: "Generate PDF" }).click();
  const downloadPdfLink = component.getByRole("link", { name: "Download PDF" });
  await expect(downloadPdfLink).toBeVisible();
  await expect(downloadPdfLink).toHaveAttribute("download", "deck.pdf");
  await expect(downloadJpgLink).toBeVisible();
  await expect(downloadJpgLink).toHaveAttribute("download", "deck.jpg");
});

test("export menu supports multiple slides with Download JPGs link and Escape to close", async ({ mount, page }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles([
    {
      name: "slide-1.png",
      mimeType: "image/png",
      buffer: Buffer.from("slide-1"),
    },
    {
      name: "slide-2.png",
      mimeType: "image/png",
      buffer: Buffer.from("slide-2"),
    },
  ]);

  await component.getByRole("button", { name: "Auto straighten" }).click();

  const exportToggle = component.getByRole("button", { name: "Export options" });
  await exportToggle.click();
  await expect(component.getByRole("menu")).toBeVisible();

  // Escape key closes menu
  await page.keyboard.press("Escape");
  await expect(component.getByRole("menu")).toHaveCount(0);

  // Reopen and export JPGs
  await exportToggle.click();
  await expect(component.getByRole("menu")).toBeVisible();
  await component.getByRole("menuitem", { name: /Export JPG images/i }).click();
  await expect(component.getByTestId("workflow-status")).toHaveText("exported-jpg");

  // Multi-slide text is "Download JPGs" and target file is zip
  const downloadJpgsLink = component.getByRole("link", { name: "Download JPGs" });
  await expect(downloadJpgsLink).toBeVisible();
  await expect(downloadJpgsLink).toHaveAttribute("download", "deck-jpgs.zip");
});
