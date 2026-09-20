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
