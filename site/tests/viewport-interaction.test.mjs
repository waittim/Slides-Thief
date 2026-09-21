import assert from "node:assert/strict";
import test from "node:test";

const {
  calculateZoomFactor,
  calculateNewZoom,
  calculateScrollAdjustment,
  isMouseWheelEvent,
  calculateAutoPanVelocity,
  isEditableTarget,
  calculateLoupePosition,
} = await import(new URL("../app/lib/viewport-math.ts", import.meta.url).href);

test("calculateZoomFactor computes valid multipliers", () => {
  assert.equal(calculateZoomFactor(0), 1);
  // Negative deltaY (wheel up / pinch out) zooms in (> 1)
  const zoomIn = calculateZoomFactor(-100);
  assert.ok(zoomIn > 1.15 && zoomIn < 1.3, `Expected zoomIn around 1.22, got ${zoomIn}`);

  // Positive deltaY (wheel down / pinch in) zooms out (< 1)
  const zoomOut = calculateZoomFactor(100);
  assert.ok(zoomOut < 0.85 && zoomOut > 0.75, `Expected zoomOut around 0.82, got ${zoomOut}`);

  // Product of reciprocal deltas is approximately 1
  assert.ok(Math.abs(zoomIn * zoomOut - 1) < 0.01);

  // Clamping prevents extreme jumps
  assert.equal(calculateZoomFactor(-5000), 1.6);
  assert.equal(calculateZoomFactor(5000), 0.6);
});

test("calculateNewZoom clamps within bounds", () => {
  assert.equal(calculateNewZoom(1.0, 1.2, 0.5, 3.0), 1.2);
  assert.equal(calculateNewZoom(1.0, 4.0, 0.5, 3.0), 3.0);
  assert.equal(calculateNewZoom(1.0, 0.2, 0.5, 3.0), 0.5);
  assert.equal(calculateNewZoom(0, 1.2, 0.5, 3.0), 0.5);
});

test("calculateScrollAdjustment keeps anchor point stationary", () => {
  // Suppose stage is at (0, 0), client cursor is at (200, 150)
  // Anchor target on canvas is at targetX = 0.5, targetY = 0.5
  // Canvas rect after zoom is at left = 50, top = 50, width = 400, height = 300
  // In new canvas, target point is at 50 + 0.5 * 400 = 250, 50 + 0.5 * 300 = 200
  // Desired client position is viewportX = 200, viewportY = 150
  // So deltaX = 250 - 200 = 50, deltaY = 200 - 150 = 50
  const anchor = {
    viewportX: 200,
    viewportY: 150,
    targetX: 0.5,
    targetY: 0.5,
  };
  const newCanvasRect = {
    left: 50,
    top: 50,
    width: 400,
    height: 300,
  };
  const newStageRect = {
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  };

  const adj = calculateScrollAdjustment(anchor, newCanvasRect, newStageRect);
  assert.deepEqual(adj, { deltaX: 50, deltaY: 50 });
});

test("isMouseWheelEvent distinguishes mouse wheel from trackpad scroll", () => {
  // Non-zero deltaMode is mouse wheel
  assert.equal(
    isMouseWheelEvent({ deltaMode: 1, deltaX: 0, deltaY: -3 }),
    true,
  );

  // Trackpad horizontal scroll with no shiftKey is trackpad
  assert.equal(
    isMouseWheelEvent({ deltaMode: 0, deltaX: 5, deltaY: 10 }),
    false,
  );

  // Non-integer deltaY is trackpad
  assert.equal(
    isMouseWheelEvent({ deltaMode: 0, deltaX: 0, deltaY: 14.5 }),
    false,
  );

  // Discrete multi-step deltaY (e.g. 100 or 120) is mouse wheel
  assert.equal(
    isMouseWheelEvent({ deltaMode: 0, deltaX: 0, deltaY: -100 }),
    true,
  );
  assert.equal(
    isMouseWheelEvent({ deltaMode: 0, deltaX: 0, deltaY: 120 }),
    true,
  );

  // Small integer delta (< 40) is treated as trackpad scroll
  assert.equal(
    isMouseWheelEvent({ deltaMode: 0, deltaX: 0, deltaY: 6 }),
    false,
  );
});

test("calculateAutoPanVelocity responds to edge proximity", () => {
  const container = {
    left: 100,
    top: 100,
    right: 900,
    bottom: 700,
  };

  // Center: zero velocity
  const center = calculateAutoPanVelocity({ clientX: 500, clientY: 400 }, container, 40, 24);
  assert.deepEqual(center, { vx: 0, vy: 0 });

  // Left edge: negative vx
  const left = calculateAutoPanVelocity({ clientX: 120, clientY: 400 }, container, 40, 24);
  assert.ok(left.vx < 0);
  assert.equal(left.vy, 0);

  // Beyond right edge: clamped to maxSpeed
  const farRight = calculateAutoPanVelocity({ clientX: 1000, clientY: 400 }, container, 40, 24);
  assert.equal(farRight.vx, 24);
  assert.equal(farRight.vy, 0);

  // Top-left corner: negative vx and vy
  const corner = calculateAutoPanVelocity({ clientX: 90, clientY: 90 }, container, 40, 24);
  assert.ok(corner.vx < 0);
  assert.ok(corner.vy < 0);
});

test("isEditableTarget identifies input and textarea elements", () => {
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", getAttribute: (k) => (k === "role" ? "textbox" : null) }), true);
});

test("calculateLoupePosition places loupe above handle by default when space is ample", () => {
  const result = calculateLoupePosition({
    handlePos: { left: 400, top: 300 },
    viewportBounds: { minX: 10, minY: 10, maxX: 800, maxY: 600 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  assert.equal(result.placement, "top");
  // top = hy - gap - loupeSize = 300 - 16 - 120 = 164
  assert.equal(result.top, 164);
  // left = hx - loupeSize / 2 = 400 - 60 = 340
  assert.equal(result.left, 340);
});

test("calculateLoupePosition dynamically flips to bottom when handle is near top boundary", () => {
  // Near top boundary: hy = 30, topAbove = 30 - 16 - 120 = -106 < minY (10)
  const result = calculateLoupePosition({
    handlePos: { left: 400, top: 30 },
    viewportBounds: { minX: 10, minY: 10, maxX: 800, maxY: 600 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  assert.equal(result.placement, "bottom");
  // top = hy + gap = 30 + 16 = 46
  assert.equal(result.top, 46);
  assert.equal(result.left, 340);
  // Ensure the loupe bottom is well within maxY
  assert.ok(result.top + 120 <= 600);
});

test("calculateLoupePosition clamps horizontally to margins near viewport edges", () => {
  // Near top-left corner (like Corner 1)
  const topLeft = calculateLoupePosition({
    handlePos: { left: 20, top: 20 },
    viewportBounds: { minX: 10, minY: 10, maxX: 800, maxY: 600 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  assert.equal(topLeft.placement, "bottom");
  assert.equal(topLeft.top, 36); // 20 + 16
  // Left: 20 - 60 = -40, clamped to minX = 10
  assert.equal(topLeft.left, 10);
  assert.ok(topLeft.left >= 10);
  assert.ok(topLeft.left + 120 <= 800);

  // Near top-right corner (like Corner 2)
  const topRight = calculateLoupePosition({
    handlePos: { left: 780, top: 20 },
    viewportBounds: { minX: 10, minY: 10, maxX: 800, maxY: 600 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  assert.equal(topRight.placement, "bottom");
  assert.equal(topRight.top, 36);
  // Left: 780 - 60 = 720, clamped to maxX - 120 = 800 - 120 = 680
  assert.equal(topRight.left, 680);
  assert.ok(topRight.left + 120 <= 800);
});

test("calculateLoupePosition flips to side when vertical space is severely constrained", () => {
  // Height is only 100px (minY = 10, maxY = 90) -> neither above nor below fits loupeSize (120)
  const result = calculateLoupePosition({
    handlePos: { left: 200, top: 50 },
    viewportBounds: { minX: 10, minY: 10, maxX: 800, maxY: 90 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  assert.equal(result.placement, "right");
  // Left = hx + gap = 200 + 16 = 216
  assert.equal(result.left, 216);
  // Vertical clamped within [minY, maxY - loupeSize] -> minX
  assert.equal(result.top, 10);
});

test("calculateLoupePosition derives viewport bounds from stageRect and canvasRect", () => {
  const result = calculateLoupePosition({
    handlePos: { left: 30, top: 30 },
    stageRect: { left: 100, top: 50, width: 800, height: 600 },
    canvasRect: { left: 100, top: 50, width: 800, height: 600 },
    canvasSize: { width: 800, height: 600 },
    loupeSize: 120,
    gap: 16,
    margin: 8,
  });

  // Stage rect and canvas rect match (0 offset).
  // Near top (top = 30), so it should flip to bottom and clamp to left margin.
  assert.equal(result.placement, "bottom");
  assert.equal(result.top, 46); // 30 + 16
  assert.equal(result.left, 8);  // 30 - 60 = -30 clamped to margin 8
  assert.ok(result.top >= 8);
  assert.ok(result.top + 120 <= 600);
});

