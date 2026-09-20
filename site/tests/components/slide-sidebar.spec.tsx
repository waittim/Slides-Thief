import { test, expect } from "@playwright/experimental-ct-react";
import { SidebarHarness } from "./SidebarHarness";
import { makeTestSlide } from "./slide-test-helpers";

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

test("dropzone shows Add more photos and appends subsequent file uploads", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"][accept*="image"]');

  await expect(component.getByText("Click or drop images")).toBeVisible();

  await fileInput.setInputFiles({
    name: "first.png",
    mimeType: "image/png",
    buffer: Buffer.from("first"),
  });

  await expect(component.getByText("first.png", { exact: true })).toBeVisible();
  await expect(component.getByText("Add more photos")).toBeVisible();

  await fileInput.setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: Buffer.from("second"),
  });

  await expect(component.getByText("first.png", { exact: true })).toBeVisible();
  await expect(component.getByText("second.png", { exact: true })).toBeVisible();
  await expect(component.locator(".uiCountBadge")).toHaveText("2");
});

test("marks export artifact as stale with visual indicator and notice instead of removing download link", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from("test"),
  });

  await component.getByRole("button", { name: "Auto straighten" }).click();
  await component.getByRole("button", { name: "Generate PDF" }).click();

  const downloadLink = component.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).not.toHaveClass(/sidebarLink--stale/);
  await expect(component.getByRole("button", { name: "Re-generate PDF" })).toBeVisible();
  await expect(component.getByText("deck.pdf")).toBeVisible();
  await expect(component.getByText("1.0 KB")).toBeVisible();
  await expect(component.getByText("Outdated")).toHaveCount(0);
  await expect(component.getByText("Settings changed; re-generate to update")).toHaveCount(0);

  // Trigger stale state (e.g. user adjusted settings or corners)
  await component.getByTestId("mark-stale").click();

  // Download link remains visible, but is marked as stale with badge and notice
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).toHaveClass(/sidebarLink--stale/);
  await expect(downloadLink).toHaveAttribute("download", "deck.pdf");
  await expect(downloadLink).toHaveAttribute("href", "blob:http://localhost/test-pdf");
  await expect(component.getByText("Outdated")).toBeVisible();
  await expect(component.getByText("Settings changed; re-generate to update")).toBeVisible();

  // Re-generating clears stale state
  await component.getByRole("button", { name: "Re-generate PDF" }).click();
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).not.toHaveClass(/sidebarLink--stale/);
  await expect(component.getByText("Outdated")).toHaveCount(0);
  await expect(component.getByText("Settings changed; re-generate to update")).toHaveCount(0);
});

test("slide delete button is disabled while busy and enabled otherwise", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from("test"),
  });

  const deleteButton = component.getByRole("button", { name: /delete image: deck.png/i });
  await expect(deleteButton).toBeEnabled();

  await component.getByTestId("toggle-busy").click();
  await expect(deleteButton).toBeDisabled();

  await component.getByTestId("toggle-busy").click();
  await expect(deleteButton).toBeEnabled();
});

test("renders fallback badge with distinct urgency level, label, and tooltip", async ({ mount }) => {
  const fallbackSlide = makeTestSlide({
    name: "slide-fallback.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["fallback_used"],
    method: "fallback-frame",
  });

  const component = await mount(
    <SidebarHarness initialSlides={[fallbackSlide]} initialHasRun={true} />,
  );

  const badge = component.locator(".badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/badge fallback/);
  await expect(badge).toHaveText("! Fallback frame");
  await expect(badge).toHaveAttribute(
    "title",
    "No slide boundary detected; fallback frame used. Please adjust corners manually.",
  );
});

test("renders low-confidence badge with review suggested label and explanatory tooltip", async ({ mount }) => {
  const reviewSlide = makeTestSlide({
    name: "slide-low.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["low_confidence"],
  });

  const component = await mount(
    <SidebarHarness initialSlides={[reviewSlide]} initialHasRun={true} />,
  );

  const badge = component.locator(".badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/badge low/);
  await expect(badge).not.toHaveClass(/fallback/);
  await expect(badge).toHaveText("! Review suggested");
  await expect(badge).toHaveAttribute(
    "title",
    "Low detection confidence; please verify corner positions.",
  );
});

test("renders multi-reason review badge with multi-line tooltip", async ({ mount }) => {
  const multiSlide = makeTestSlide({
    name: "slide-multi.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["low_confidence", "weak_edge_support"],
  });

  const component = await mount(
    <SidebarHarness initialSlides={[multiSlide]} initialHasRun={true} />,
  );

  const badge = component.locator(".badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/badge low/);
  await expect(badge).toHaveText("! Review suggested");
  await expect(badge).toHaveAttribute(
    "title",
    "Review suggested:\n• Low detection confidence; please verify corner positions.\n• Weak edge contrast or continuity; please verify slide boundaries.",
  );
});

test("renders progress bar and cancel button during auto detection and cancels when clicked", async ({ mount }) => {
  const component = await mount(
    <SidebarHarness
      initialBusy={true}
      initialDetecting={true}
      initialProgress={{ current: 2, total: 5 }}
      initialSlides={[
        makeTestSlide({ name: "slide-1.png", status: "ready" }),
        makeTestSlide({ name: "slide-2.png", status: "detecting" }),
        makeTestSlide({ name: "slide-3.png", status: "queued" }),
      ]}
      initialHasRun={true}
    />,
  );

  const progressBar = component.getByRole("progressbar");
  await expect(progressBar).toBeVisible();
  await expect(progressBar).toHaveAttribute("aria-valuenow", "2");
  await expect(progressBar).toHaveAttribute("aria-valuemax", "5");

  const progressFill = component.locator(".sidebarProgressFill");
  await expect(progressFill).toBeVisible();

  const cancelButton = component.getByRole("button", { name: "Cancel" });
  await expect(cancelButton).toBeVisible();

  await cancelButton.click();
  await expect(component.getByTestId("detection-cancelled")).toHaveText("cancelled");
  await expect(progressBar).toHaveCount(0);
  await expect(cancelButton).toHaveCount(0);
});

test("thumbnail list distinguishes completed, processing, and queued states", async ({ mount }) => {
  const slideReady = makeTestSlide({ id: "s1", name: "ready.png", status: "ready" });
  const slideDetecting = makeTestSlide({ id: "s2", name: "detecting.png", status: "detecting" });
  const slideQueued = makeTestSlide({ id: "s3", name: "queued.png", status: "queued" });

  const component = await mount(
    <SidebarHarness
      initialSlides={[slideReady, slideDetecting, slideQueued]}
      initialHasRun={true}
    />,
  );

  const badges = component.locator(".badge");
  await expect(badges).toHaveCount(3);

  // Ready slide (completed)
  await expect(badges.nth(0)).toHaveText("✓ Automatically detected");
  await expect(badges.nth(0)).not.toHaveClass(/processing/);
  await expect(badges.nth(0)).not.toHaveClass(/queued/);

  // Detecting slide (processing)
  await expect(badges.nth(1)).toHaveClass(/badge processing/);
  await expect(badges.nth(1)).toHaveText("Straightening");
  await expect(badges.nth(1)).toHaveAttribute("title", "Straightening");

  // Queued slide (waiting in queue)
  await expect(badges.nth(2)).toHaveClass(/badge queued/);
  await expect(badges.nth(2)).toHaveText("Waiting for auto straighten");
  await expect(badges.nth(2)).toHaveAttribute("title", "Waiting for auto straighten");
});

test("slide move up and move down buttons reorder slides and update page indexes", async ({ mount }) => {
  const slide1 = makeTestSlide({ id: "s1", name: "page-1.png", status: "ready" });
  const slide2 = makeTestSlide({ id: "s2", name: "page-2.png", status: "ready" });

  const component = await mount(
    <SidebarHarness initialSlides={[slide1, slide2]} initialHasRun={true} />,
  );

  const rows = component.locator(".slideRow");
  await expect(rows).toHaveCount(2);

  // Initial order
  await expect(rows.nth(0).locator(".name")).toHaveText("page-1.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("page-2.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // First slide move up is disabled, move down is enabled
  const row0MoveUp = rows.nth(0).getByRole("button", { name: /move image up/i });
  const row0MoveDown = rows.nth(0).getByRole("button", { name: /move image down/i });
  await expect(row0MoveUp).toBeDisabled();
  await expect(row0MoveDown).toBeEnabled();

  // Second slide move up is enabled, move down is disabled
  const row1MoveUp = rows.nth(1).getByRole("button", { name: /move image up/i });
  const row1MoveDown = rows.nth(1).getByRole("button", { name: /move image down/i });
  await expect(row1MoveUp).toBeEnabled();
  await expect(row1MoveDown).toBeDisabled();

  // Generate PDF initially
  await component.getByRole("button", { name: "Generate PDF" }).click();
  const downloadLink = component.getByRole("link", { name: "Download PDF" });
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).not.toHaveClass(/sidebarLink--stale/);

  // Clicking move up on second slide moves it to position 0
  await row1MoveUp.click();

  // New order is swapped and indexes updated
  await expect(rows.nth(0).locator(".name")).toHaveText("page-2.png");
  await expect(rows.nth(0).locator(".idx")).toHaveText("01");
  await expect(rows.nth(1).locator(".name")).toHaveText("page-1.png");
  await expect(rows.nth(1).locator(".idx")).toHaveText("02");

  // Reordering marks export stale
  await expect(downloadLink).toHaveClass(/sidebarLink--stale/);
  await expect(component.locator("text=Settings changed; re-generate to update")).toBeVisible();

  // While busy, move buttons are disabled
  await component.getByTestId("toggle-busy").click();
  await expect(rows.nth(0).getByRole("button", { name: /move image down/i })).toBeDisabled();
  await expect(rows.nth(1).getByRole("button", { name: /move image up/i })).toBeDisabled();
});



