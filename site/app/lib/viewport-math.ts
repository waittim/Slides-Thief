/**
 * Viewport interaction math utilities for canvas zooming, panning, and auto-scrolling.
 */

export interface Point {
  clientX: number;
  clientY: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ContainerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ZoomAnchor {
  viewportX: number;
  viewportY: number;
  targetX: number;
  targetY: number;
}

/**
 * Calculates zoom factor from wheel deltaY.
 * Positive deltaY (wheel down / zoom out) gives factor < 1.
 * Negative deltaY (wheel up / zoom in) gives factor > 1.
 */
export function calculateZoomFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const factor = Math.pow(1.002, -deltaY);
  return Math.max(0.6, Math.min(1.6, factor));
}

/**
 * Clamps and computes the new zoom scale within [minScale, maxScale].
 */
export function calculateNewZoom(
  currentScale: number,
  factor: number,
  minScale: number,
  maxScale: number,
): number {
  if (!Number.isFinite(currentScale) || currentScale <= 0) return minScale;
  const target = currentScale * factor;
  return Math.max(minScale, Math.min(maxScale, target));
}

/**
 * Calculates the required scroll adjustment (deltaX, deltaY) for the scrollable container
 * so that the anchor point on the canvas remains stationary under the client cursor.
 */
export function calculateScrollAdjustment(
  anchor: ZoomAnchor,
  newCanvasRect: Rect,
  newStageRect: Rect,
): { deltaX: number; deltaY: number } {
  const currentClientX = newCanvasRect.left + anchor.targetX * newCanvasRect.width;
  const currentClientY = newCanvasRect.top + anchor.targetY * newCanvasRect.height;
  const desiredClientX = newStageRect.left + anchor.viewportX;
  const desiredClientY = newStageRect.top + anchor.viewportY;
  return {
    deltaX: Math.round(currentClientX - desiredClientX),
    deltaY: Math.round(currentClientY - desiredClientY),
  };
}

/**
 * Determines whether a wheel event originates from a physical mouse wheel
 * as opposed to a trackpad two-finger scroll gesture.
 */
export function isMouseWheelEvent(event: {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
}): boolean {
  // deltaMode !== 0 (DOM_DELTA_LINE or DOM_DELTA_PAGE) is exclusively mouse wheel.
  if (event.deltaMode !== 0) return true;

  const absY = Math.abs(event.deltaY);
  const absX = Math.abs(event.deltaX);

  // If there is horizontal delta without Shift, it's almost certainly trackpad two-finger scroll.
  if (absX > 0 && !event.shiftKey) return false;

  // Trackpad scrolls frequently have non-integer delta values on high-DPI displays.
  if (!Number.isInteger(event.deltaY)) return false;

  // Physical mouse wheel clicks produce distinct large steps (typically multiples of 40, 50, 100, or 120).
  if (absY >= 40 && (absY % 10 === 0 || absY % 12 === 0)) return true;

  return false;
}

/**
 * Calculates auto-pan scroll velocity when dragging a handle near viewport boundaries.
 */
export function calculateAutoPanVelocity(
  pointerPos: Point,
  containerRect: ContainerRect,
  margin = 40,
  maxSpeed = 24,
): { vx: number; vy: number } {
  let vx = 0;
  let vy = 0;

  if (pointerPos.clientX < containerRect.left + margin) {
    const dist = containerRect.left + margin - pointerPos.clientX;
    vx = -Math.min(maxSpeed, Math.max(2, dist * 0.6));
  } else if (pointerPos.clientX > containerRect.right - margin) {
    const dist = pointerPos.clientX - (containerRect.right - margin);
    vx = Math.min(maxSpeed, Math.max(2, dist * 0.6));
  }

  if (pointerPos.clientY < containerRect.top + margin) {
    const dist = containerRect.top + margin - pointerPos.clientY;
    vy = -Math.min(maxSpeed, Math.max(2, dist * 0.6));
  } else if (pointerPos.clientY > containerRect.bottom - margin) {
    const dist = pointerPos.clientY - (containerRect.bottom - margin);
    vy = Math.min(maxSpeed, Math.max(2, dist * 0.6));
  }

  return { vx, vy };
}

/**
 * Checks whether an event target is an interactive text editing element.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };
  const tag = element.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (element.isContentEditable === true) return true;
  if (element.getAttribute && element.getAttribute("role") === "textbox") return true;
  return false;
}

export interface LoupePositionOptions {
  handlePos: { left: number; top: number };
  viewportBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  stageRect?: Rect | ContainerRect | null;
  canvasRect?: Rect | null;
  canvasSize?: { width: number; height: number } | null;
  loupeSize?: number;
  gap?: number;
  margin?: number;
}

export interface LoupePositionResult {
  left: number;
  top: number;
  placement: "top" | "bottom" | "left" | "right";
}

/**
 * Calculates dynamic position for the magnifying loupe overlay.
 * Automatically flips to bottom or side when near viewport/canvas edges
 * and clamps within visible container bounds to prevent clipping.
 */
export function calculateLoupePosition(options: LoupePositionOptions): LoupePositionResult {
  const {
    handlePos,
    viewportBounds,
    stageRect,
    canvasRect,
    canvasSize,
    loupeSize = 120,
    gap = 16,
    margin = 8,
  } = options;

  let minX = margin;
  let minY = margin;
  let maxX = 2000;
  let maxY = 2000;

  if (viewportBounds) {
    minX = viewportBounds.minX;
    minY = viewportBounds.minY;
    maxX = viewportBounds.maxX;
    maxY = viewportBounds.maxY;
  } else if (stageRect && canvasRect) {
    const sLeft = stageRect.left;
    const sTop = stageRect.top;
    const sRight = "right" in stageRect ? stageRect.right : stageRect.left + stageRect.width;
    const sBottom = "bottom" in stageRect ? stageRect.bottom : stageRect.top + stageRect.height;

    const winWidth = typeof window !== "undefined" ? window.innerWidth : Infinity;
    const winHeight = typeof window !== "undefined" ? window.innerHeight : Infinity;

    const visibleLeft = Math.max(0, sLeft);
    const visibleTop = Math.max(0, sTop);
    const visibleRight = Math.min(winWidth, sRight);
    const visibleBottom = Math.min(winHeight, sBottom);

    const cLeft = canvasRect.left;
    const cTop = canvasRect.top;

    minX = visibleLeft - cLeft + margin;
    minY = visibleTop - cTop + margin;
    maxX = visibleRight - cLeft - margin;
    maxY = visibleBottom - cTop - margin;

    const canvasW = canvasSize?.width ?? ("width" in canvasRect ? canvasRect.width : 0);
    const canvasH = canvasSize?.height ?? ("height" in canvasRect ? canvasRect.height : 0);

    minX = Math.max(minX, margin);
    minY = Math.max(minY, margin);
    if (canvasW > 0) {
      maxX = Math.min(maxX, canvasW - margin);
    }
    if (canvasH > 0) {
      maxY = Math.min(maxY, canvasH - margin);
    }
  } else if (canvasSize) {
    minX = margin;
    minY = margin;
    maxX = canvasSize.width - margin;
    maxY = canvasSize.height - margin;
  }

  if (maxX < minX) maxX = minX + loupeSize;
  if (maxY < minY) maxY = minY + loupeSize;

  const hx = handlePos.left;
  const hy = handlePos.top;

  const topAbove = hy - gap - loupeSize;
  const bottomBelow = hy + gap + loupeSize;

  const canFitAbove = topAbove >= minY;
  const canFitBelow = bottomBelow <= maxY;

  let placement: "top" | "bottom" | "left" | "right" = "top";
  let chosenLeft = hx - loupeSize / 2;
  let chosenTop = topAbove;

  if (canFitAbove) {
    placement = "top";
    chosenTop = topAbove;
  } else if (canFitBelow) {
    placement = "bottom";
    chosenTop = hy + gap;
  } else {
    // Neither vertical position fits fully. Check horizontal sides.
    const leftRight = hx + gap;
    const rightRight = leftRight + loupeSize;
    const leftLeft = hx - gap - loupeSize;
    const canFitRight = rightRight <= maxX;
    const canFitLeft = leftLeft >= minX;

    if (canFitRight) {
      placement = "right";
      chosenLeft = leftRight;
      chosenTop = hy - loupeSize / 2;
    } else if (canFitLeft) {
      placement = "left";
      chosenLeft = leftLeft;
      chosenTop = hy - loupeSize / 2;
    } else {
      // Neither side fits completely either; pick vertical side with more room
      const spaceAbove = hy - minY;
      const spaceBelow = maxY - hy;
      if (spaceBelow > spaceAbove) {
        placement = "bottom";
        chosenTop = hy + gap;
      } else {
        placement = "top";
        chosenTop = topAbove;
      }
    }
  }

  // Clamping within visible boundaries
  if (maxX >= minX + loupeSize) {
    chosenLeft = Math.max(minX, Math.min(maxX - loupeSize, chosenLeft));
  } else {
    chosenLeft = minX;
  }

  if (maxY >= minY + loupeSize) {
    chosenTop = Math.max(minY, Math.min(maxY - loupeSize, chosenTop));
  } else {
    chosenTop = minY;
  }

  return {
    left: Math.round(chosenLeft),
    top: Math.round(chosenTop),
    placement,
  };
}
