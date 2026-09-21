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

test("direct export buttons export JPG and PDF for single slide with dual links", async ({ mount }) => {
  const component = await mount(<SidebarHarness />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-used-by-this-component-test"),
  });

  const exportJpgBtn = component.getByRole("button", { name: "Export JPG" });
  const generatePdfBtn = component.getByRole("button", { name: "Generate PDF" });
  await expect(exportJpgBtn).toBeDisabled();
  await expect(generatePdfBtn).toBeDisabled();

  await component.getByRole("button", { name: "Auto straighten" }).click();
  await expect(exportJpgBtn).toBeEnabled();
  await expect(generatePdfBtn).toBeEnabled();

  // Clicking "Export JPG" directly calls exportJpg
  await exportJpgBtn.click();
  await expect(component.getByTestId("workflow-status")).toHaveText("exported-jpg");

  // Download JPG link appears with single slide label and download attribute
  const downloadJpgLink = component.getByRole("link", { name: "Download JPG" });
  await expect(downloadJpgLink).toBeVisible();
  await expect(downloadJpgLink).toHaveAttribute("download", "deck.jpg");

  // Clicking Generate PDF enables PDF download as well; both links appear stacked
  await generatePdfBtn.click();
  const downloadPdfLink = component.getByRole("link", { name: "Download PDF" });
  await expect(downloadPdfLink).toBeVisible();
  await expect(downloadPdfLink).toHaveAttribute("download", "deck.pdf");
  await expect(downloadJpgLink).toBeVisible();
  await expect(downloadJpgLink).toHaveAttribute("download", "deck.jpg");
});

test("direct JPG export supports multiple slides with Download JPGs zip link", async ({ mount }) => {
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

  const exportJpgBtn = component.getByRole("button", { name: "Export JPG" });
  await expect(exportJpgBtn).toBeDisabled();

  await component.getByRole("button", { name: "Auto straighten" }).click();
  await expect(exportJpgBtn).toBeEnabled();

  // Clicking "Export JPG" directly calls exportJpg
  await exportJpgBtn.click();
  await expect(component.getByTestId("workflow-status")).toHaveText("exported-jpg");

  // Multi-slide text is "Download JPGs" and target file is zip
  const downloadJpgsLink = component.getByRole("link", { name: "Download JPGs" });
  await expect(downloadJpgsLink).toBeVisible();
  await expect(downloadJpgsLink).toHaveAttribute("download", "deck-jpgs.zip");
});

test("iOS export flow renders Open PDF link without download attribute and shows share instruction", async ({ mount }) => {
  const component = await mount(<SidebarHarness isIOS={true} />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "slide-1.png",
    mimeType: "image/png",
    buffer: Buffer.from("slide-1"),
  });

  await component.getByRole("button", { name: "Auto straighten" }).click();
  const generatePdfBtn = component.getByRole("button", { name: "Generate PDF" });
  await generatePdfBtn.click();

  // Desktop "Download PDF" should not exist
  await expect(component.getByRole("link", { name: "Download PDF" })).toHaveCount(0);

  // iOS "Open PDF" link exists, has target="_blank", and does not have download attribute
  const openPdfLink = component.getByRole("link", { name: /Open PDF/i });
  await expect(openPdfLink).toBeVisible();
  await expect(openPdfLink).toHaveAttribute("target", "_blank");
  await expect(openPdfLink).not.toHaveAttribute("download");

  // Instructions for iOS Safari are visible
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toBeVisible();
});

test("iOS export flow for single JPG renders Open JPG with share instruction", async ({ mount }) => {
  const component = await mount(<SidebarHarness isIOS={true} />);
  const fileInput = component.locator('input[type="file"]').first();

  await fileInput.setInputFiles({
    name: "slide-1.png",
    mimeType: "image/png",
    buffer: Buffer.from("slide-1"),
  });

  await component.getByRole("button", { name: "Auto straighten" }).click();
  const exportJpgBtn = component.getByRole("button", { name: "Export JPG" });
  await exportJpgBtn.click();

  // Desktop "Download JPG" should not exist
  await expect(component.getByRole("link", { name: "Download JPG" })).toHaveCount(0);

  // iOS "Open JPG" link exists, has target="_blank", and does not have download attribute
  const openJpgLink = component.getByRole("link", { name: /Open JPG/i });
  await expect(openJpgLink).toBeVisible();
  await expect(openJpgLink).toHaveAttribute("target", "_blank");
  await expect(openJpgLink).not.toHaveAttribute("download");

  // Instructions for iOS Safari are visible
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toBeVisible();
});

test("iOS export flow for multiple JPGs renders Download JPGs zip without tab share instruction", async ({ mount }) => {
  const component = await mount(<SidebarHarness isIOS={true} />);
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
  const exportJpgBtn = component.getByRole("button", { name: "Export JPG" });
  await exportJpgBtn.click();

  // Multi-slide ZIP on iOS keeps Download JPGs title, removes download attribute for Safari compatibility
  const downloadJpgsLink = component.getByRole("link", { name: "Download JPGs" });
  await expect(downloadJpgsLink).toBeVisible();
  await expect(downloadJpgsLink).not.toHaveAttribute("download");

  // ZIP does not open as an inline viewable page, so the tab share instruction is not shown
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toHaveCount(0);
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

test("batch operations: checkbox selection, select all, batch redetect, and select review needed", async ({ mount }) => {
  const slide1 = makeTestSlide({ id: "s1", name: "slide-1.png", status: "ready" });
  const slide2 = makeTestSlide({ id: "s2", name: "slide-2.png", status: "ready", needsReview: true, reviewReasons: ["low_confidence"] });
  const slide3 = makeTestSlide({ id: "s3", name: "slide-3.png", status: "ready" });

  const component = await mount(
    <SidebarHarness initialSlides={[slide1, slide2, slide3]} initialHasRun={true} />,
  );

  const rows = component.locator(".slideRow");
  await expect(rows).toHaveCount(3);

  // Batch action bar should not be visible initially
  await expect(component.locator(".batchActionBar")).toHaveCount(0);
  await expect(component.getByTestId("batch-selected-count")).toHaveText("0");

  // Review needed quick-select button should be visible in header because slide2 needs review
  const reviewNeededBtn = component.locator(".selectReviewNeededAction");
  await expect(reviewNeededBtn).toBeVisible();

  // Clicking reviewNeededBtn selects slide2
  await reviewNeededBtn.click();
  await expect(component.getByTestId("batch-selected-count")).toHaveText("1");
  await expect(component.locator(".batchActionBar")).toBeVisible();
  await expect(component.locator(".batchActionCount")).toHaveText("1 selected");

  // Check that row2 has selected class
  await expect(rows.nth(1)).toHaveClass(/selectedBatchRow/);
  await expect(rows.nth(0)).not.toHaveClass(/selectedBatchRow/);

  // Toggle checkbox on slide1
  const cb0 = rows.nth(0).locator(".slideCheckbox");
  await cb0.click();
  await expect(component.getByTestId("batch-selected-count")).toHaveText("2");
  await expect(component.locator(".batchActionCount")).toHaveText("2 selected");

  // Select all batch button
  const selectAllBtn = component.locator(".batchSelectAllButton");
  await selectAllBtn.click();
  await expect(component.getByTestId("batch-selected-count")).toHaveText("3");
  await expect(component.locator(".batchActionCount")).toHaveText("3 selected");

  // Batch re-detect button
  const redetectBtn = component.locator(".batchRedetectButton");
  await expect(redetectBtn).toBeVisible();
  await redetectBtn.click();
  await expect(component.getByTestId("batch-redetected-count")).toHaveText("3");

  // Clear batch selection button
  const clearBtn = component.locator(".batchClearButton");
  await clearBtn.click();
  await expect(component.getByTestId("batch-selected-count")).toHaveText("0");
  await expect(component.locator(".batchActionBar")).toHaveCount(0);
});

test("renders persistent error alert banner with message, retry, copy, and dismiss controls", async ({ mount }) => {
  const component = await mount(
    <SidebarHarness
      initialSlides={[makeTestSlide({ name: "slide-1.png", status: "ready" })]}
      initialErrorMessage="Failed to export PDF: Out of memory"
      initialErrorDetails="Detailed stack trace: Memory limit exceeded at processSlide (worker.ts:42)"
    />,
  );

  const banner = component.locator(".sidebarErrorBanner");
  await expect(banner).toBeVisible();

  const message = component.locator(".sidebarErrorMessage");
  await expect(message).toHaveText("Failed to export PDF: Out of memory");

  const retryBtn = component.getByRole("button", { name: "Retry" });
  await expect(retryBtn).toBeVisible();
  await expect(retryBtn).toBeEnabled();

  const detailsBtn = component.getByRole("button", { name: "Details" });
  await expect(detailsBtn).toBeVisible();

  const copyBtn = component.getByRole("button", { name: "Copy error" });
  await expect(copyBtn).toBeVisible();

  const dismissBtn = component.getByRole("button", { name: "Dismiss alert" });
  await expect(dismissBtn).toBeVisible();

  // Status line remains clean and independent
  const statusLine = component.locator(".statusLine");
  await expect(statusLine).toBeVisible();
  await expect(statusLine).toHaveText("Ready");
});

test("clicking dismiss button removes the error banner while keeping workflow status line intact", async ({ mount }) => {
  const component = await mount(
    <SidebarHarness
      initialSlides={[makeTestSlide({ name: "slide-1.png", status: "ready" })]}
      initialErrorMessage="Import error occurred"
    />,
  );

  const banner = component.locator(".sidebarErrorBanner");
  await expect(banner).toBeVisible();

  await component.getByRole("button", { name: "Dismiss alert" }).click();
  await expect(banner).toHaveCount(0);

  // Status line remains present and valid
  const statusLine = component.locator(".statusLine");
  await expect(statusLine).toBeVisible();
  await expect(statusLine).toHaveText("Ready");
});

test("clicking retry button triggers retry action and clears error banner", async ({ mount }) => {
  const component = await mount(
    <SidebarHarness
      initialSlides={[makeTestSlide({ name: "slide-1.png", status: "ready" })]}
      initialErrorMessage="Auto straighten failed"
    />,
  );

  const banner = component.locator(".sidebarErrorBanner");
  await expect(banner).toBeVisible();

  await component.getByRole("button", { name: "Retry" }).click();
  await expect(component.getByTestId("retry-status")).toHaveText("retried");
  await expect(banner).toHaveCount(0);
});

test("toggling details button displays and hides detailed error text", async ({ mount }) => {
  const component = await mount(
    <SidebarHarness
      initialSlides={[makeTestSlide({ name: "slide-1.png", status: "ready" })]}
      initialErrorMessage="Conversion failed"
      initialErrorDetails="HEIC decoding error code: 404"
    />,
  );

  const detailsBtn = component.getByRole("button", { name: "Details" });
  await expect(detailsBtn).toBeVisible();

  // Initially hidden
  await expect(component.locator(".sidebarErrorDetails")).toHaveCount(0);

  // Click to expand
  await detailsBtn.click();
  const details = component.locator(".sidebarErrorDetails");
  await expect(details).toBeVisible();
  await expect(details).toHaveText("HEIC decoding error code: 404");

  // Button changes to Collapse
  const collapseBtn = component.getByRole("button", { name: "Collapse details" });
  await expect(collapseBtn).toBeVisible();

  // Click to collapse
  await collapseBtn.click();
  await expect(component.locator(".sidebarErrorDetails")).toHaveCount(0);
});

test("slide selection exposes aria-current for active slide instead of aria-pressed toggle", async ({ mount }) => {
  const slide1 = makeTestSlide({ id: "s1", name: "slide-1.png", status: "ready" });
  const slide2 = makeTestSlide({ id: "s2", name: "slide-2.png", status: "ready" });

  const component = await mount(
    <SidebarHarness initialSlides={[slide1, slide2]} initialHasRun={true} />,
  );

  const selectButtons = component.locator(".slideSelectButton");
  await expect(selectButtons).toHaveCount(2);

  // Initially, first slide is active (has aria-current="true", no aria-pressed)
  await expect(selectButtons.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(selectButtons.nth(0)).not.toHaveAttribute("aria-pressed");

  // Second slide is inactive (no aria-current, no aria-pressed)
  await expect(selectButtons.nth(1)).not.toHaveAttribute("aria-current");
  await expect(selectButtons.nth(1)).not.toHaveAttribute("aria-pressed");

  // Clicking second slide makes it active and updates aria-current
  await selectButtons.nth(1).click();
  await expect(selectButtons.nth(0)).not.toHaveAttribute("aria-current");
  await expect(selectButtons.nth(1)).toHaveAttribute("aria-current", "true");
});

test("sidebar displays middle-truncated filenames for long names while preserving title and aria-label with full name", async ({ mount }) => {
  const longName1 = "presentation_deck_slide_01.jpg";
  const longName2 = "presentation_deck_slide_02.jpg";
  const slide1 = makeTestSlide({ id: "s1", name: longName1, status: "ready" });
  const slide2 = makeTestSlide({ id: "s2", name: longName2, status: "ready" });

  const component = await mount(
    <SidebarHarness initialSlides={[slide1, slide2]} initialHasRun={true} />,
  );

  const names = component.locator(".slideSelectButton .name");
  await expect(names).toHaveCount(2);

  // Desktop middle truncation retains distinguishing ending
  await expect(names.nth(0)).toHaveText("presentati..._slide_01.jpg");
  await expect(names.nth(1)).toHaveText("presentati..._slide_02.jpg");

  // Full name preserved on aria-label and title
  await expect(names.nth(0)).toHaveAttribute("aria-label", longName1);
  await expect(names.nth(0)).toHaveAttribute("title", longName1);
  await expect(names.nth(1)).toHaveAttribute("aria-label", longName2);
  await expect(names.nth(1)).toHaveAttribute("title", longName2);
});

test("sidebar on mobile applies compact middle-truncation preserving distinguishing serial numbers", async ({ mount }) => {
  const cameraPhoto1 = "IMG_20260921_143001.jpg";
  const cameraPhoto2 = "IMG_20260921_143002.jpg";
  const slide1 = makeTestSlide({ id: "s1", name: cameraPhoto1, status: "ready" });
  const slide2 = makeTestSlide({ id: "s2", name: cameraPhoto2, status: "ready" });

  const component = await mount(
    <SidebarHarness initialSlides={[slide1, slide2]} initialHasRun={true} isMobile={true} />,
  );

  const names = component.locator(".slideSelectButton .name");
  await expect(names).toHaveCount(2);

  // Mobile middle truncation retains timestamp/sequence number
  await expect(names.nth(0)).toHaveText("IMG_..._143001.jpg");
  await expect(names.nth(1)).toHaveText("IMG_..._143002.jpg");

  // Full name preserved on aria-label
  await expect(names.nth(0)).toHaveAttribute("aria-label", cameraPhoto1);
  await expect(names.nth(1)).toHaveAttribute("aria-label", cameraPhoto2);
});

