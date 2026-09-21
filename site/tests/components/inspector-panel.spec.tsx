import { test, expect } from "@playwright/experimental-ct-react";
import { InspectorHarness } from "./InspectorHarness";
import { makeTestSlide } from "./slide-test-helpers";

test("renders fallback urgency review card with human-readable reason in details panel", async ({ mount }) => {
  const fallbackSlide = makeTestSlide({
    name: "slide-fallback.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["fallback_used"],
    method: "fallback-frame",
  });

  const component = await mount(<InspectorHarness slide={fallbackSlide} />);

  const reviewCard = component.locator(".reviewCard");
  await expect(reviewCard).toBeVisible();
  await expect(reviewCard).toHaveClass(/reviewCard fallback/);
  await expect(reviewCard.locator(".reviewCardIcon")).toHaveText("⚠");
  await expect(reviewCard.locator(".reviewCardTitle")).toHaveText("Manual corner adjustment required");
  await expect(reviewCard.locator(".reviewCardItem")).toHaveText(
    "No slide boundary detected; fallback frame used. Please adjust corners manually.",
  );
});

test("renders warning urgency review card with multiple human-readable reasons", async ({ mount }) => {
  const multiSlide = makeTestSlide({
    name: "slide-multi.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["low_confidence", "weak_edge_support"],
    method: "contrast-lines",
  });

  const component = await mount(<InspectorHarness slide={multiSlide} />);

  const reviewCard = component.locator(".reviewCard");
  await expect(reviewCard).toBeVisible();
  await expect(reviewCard).toHaveClass(/reviewCard warning/);
  await expect(reviewCard.locator(".reviewCardIcon")).toHaveText("!");
  await expect(reviewCard.locator(".reviewCardTitle")).toHaveText("Review suggested");

  const items = reviewCard.locator(".reviewCardItem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveText("Low detection confidence; please verify corner positions.");
  await expect(items.nth(1)).toHaveText("Weak edge contrast or continuity; please verify slide boundaries.");
});

test("does not render review card when slide does not need review", async ({ mount }) => {
  const cleanSlide = makeTestSlide({
    name: "slide-clean.png",
    status: "ready",
    needsReview: false,
    reviewReasons: [],
    method: "contrast-lines",
  });

  const component = await mount(<InspectorHarness slide={cleanSlide} />);
  await expect(component.locator(".reviewCard")).toHaveCount(0);
});

test("renders review card with confirm button and clicking it calls onConfirmSlide", async ({ mount }) => {
  let confirmedId: string | null = null;
  const reviewSlide = makeTestSlide({
    id: "test-review-slide-1",
    name: "slide-review.png",
    status: "ready",
    needsReview: true,
    reviewReasons: ["low_confidence"],
    method: "contrast-lines",
  });

  const component = await mount(
    <InspectorHarness
      slide={reviewSlide}
      onConfirmSlide={(id) => {
        confirmedId = id;
      }}
    />,
  );

  const confirmBtn = component.locator(".reviewCardConfirmBtn");
  await expect(confirmBtn).toBeVisible();
  await expect(confirmBtn).toHaveText("Looks good");

  await confirmBtn.click();
  expect(confirmedId).toBe("test-review-slide-1");
});

test("renders actionable confidence metric for review-suggested slide", async ({ mount }) => {
  const reviewSlide = makeTestSlide({
    name: "slide-review.png",
    status: "ready",
    needsReview: true,
    confidence: 0.65,
    reviewReasons: ["low_confidence"],
  });

  const component = await mount(<InspectorHarness slide={reviewSlide} />);
  const metricValues = component.locator(".metric .value");
  const confidenceValue = metricValues.nth(2);
  await expect(confidenceValue).toHaveText("Review suggested");
  await expect(confidenceValue).toHaveAttribute("title", "Confidence: 0.65");
});

test("renders actionable confidence metric for clean slide", async ({ mount }) => {
  const cleanSlide = makeTestSlide({
    name: "slide-clean.png",
    status: "ready",
    needsReview: false,
    confidence: 0.92,
    reviewReasons: [],
  });

  const component = await mount(<InspectorHarness slide={cleanSlide} />);
  const cleanConfidenceValue = component.locator(".metric .value").nth(2);
  await expect(cleanConfidenceValue).toHaveText("Looks good");
  await expect(cleanConfidenceValue).toHaveAttribute("title", "Confidence: 0.92");
});

test("renders editable numeric inputs for corner coordinates and clamps to boundaries", async ({ mount }) => {
  const cornerChanges: Array<{ cornerIndex: number; coordIndex: number; value: number }> = [];
  const slide = makeTestSlide({
    name: "slide-corners.png",
    status: "ready",
    width: 1000,
    height: 800,
    quad: [
      [100, 120],
      [900, 130],
      [880, 750],
      [110, 740],
    ],
  });

  const component = await mount(
    <InspectorHarness
      slide={slide}
      onCornerChange={(cornerIndex, coordIndex, value) => {
        cornerChanges.push({ cornerIndex, coordIndex, value });
      }}
    />,
  );

  const cornerRows = component.locator(".cornerRow");
  await expect(cornerRows).toHaveCount(4);

  const cornerInputs = component.locator(".cornerInput");
  await expect(cornerInputs).toHaveCount(8);

  // Corner 1 X
  const c1x = cornerInputs.nth(0);
  await expect(c1x).toHaveValue("100");
  await c1x.fill("160");
  await c1x.press("Enter");

  expect(cornerChanges.length).toBe(1);
  expect(cornerChanges[0]).toEqual({ cornerIndex: 0, coordIndex: 0, value: 160 });

  // Out of bounds high (exceeding width 1000)
  await c1x.fill("1500");
  await c1x.press("Enter");
  expect(cornerChanges[1]).toEqual({ cornerIndex: 0, coordIndex: 0, value: 1000 });
  await expect(c1x).toHaveValue("1000");

  // Out of bounds low (negative value)
  const c1y = cornerInputs.nth(1);
  await c1y.fill("-80");
  await c1y.press("Enter");
  expect(cornerChanges[2]).toEqual({ cornerIndex: 0, coordIndex: 1, value: 0 });
  await expect(c1y).toHaveValue("0");
});

test("disables corner inputs when disabled prop is true", async ({ mount }) => {
  const slide = makeTestSlide({
    name: "slide-disabled.png",
    status: "ready",
    width: 1000,
    height: 800,
    quad: [
      [100, 120],
      [900, 130],
      [880, 750],
      [110, 740],
    ],
  });

  const component = await mount(<InspectorHarness slide={slide} disabled={true} />);
  const cornerInputs = component.locator(".cornerInput");
  await expect(cornerInputs).toHaveCount(8);
  for (let i = 0; i < 8; i++) {
    await expect(cornerInputs.nth(i)).toBeDisabled();
  }
});


