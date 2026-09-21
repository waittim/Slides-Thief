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
