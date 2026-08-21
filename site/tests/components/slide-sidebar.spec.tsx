import { test, expect } from "@playwright/experimental-ct-react";
import { SidebarHarness } from "./SidebarHarness";

test("file selection, straighten, and export controls follow the user-visible state", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]');

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
