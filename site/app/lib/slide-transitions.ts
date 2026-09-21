import type { Quad } from "../detection/types";
import type { SlideItem } from "./types";

export function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
}

/** Check whether two quads have approximately identical corner coordinates. */
export function isQuadEqual(q1: Quad | null | undefined, q2: Quad | null | undefined, tolerance = 0.01): boolean {
  if (!q1 || !q2) return q1 === q2;
  if (q1.length !== q2.length) return false;
  return q1.every(([x1, y1], i) => {
    const p2 = q2[i];
    return p2 !== undefined && Math.abs(x1 - p2[0]) <= tolerance && Math.abs(y1 - p2[1]) <= tolerance;
  });
}

/**
 * Checks whether a slide has an automatic detection snapshot that differs
 * from its current state, meaning it can be restored.
 */
export function canRestoreAutoDetection(slide: SlideItem | null | undefined): boolean {
  if (!slide || slide.status !== "ready" || !slide.autoDetection) return false;
  const snapshot = slide.autoDetection;
  const quadChanged = !isQuadEqual(slide.quad, snapshot.quad);
  const methodChanged = slide.method !== snapshot.method;
  const reviewChanged = slide.needsReview !== snapshot.needsReview;
  return quadChanged || methodChanged || reviewChanged;
}

/** Restore the last automatic result, including the metadata that drives review UI. */
export function restoreAutoDetection(slide: SlideItem): SlideItem {
  const snapshot = slide.autoDetection;
  if (!snapshot) return slide;

  return {
    ...slide,
    quad: cloneQuad(snapshot.quad),
    method: snapshot.method,
    confidence: snapshot.confidence,
    needsReview: snapshot.needsReview,
    reviewReasons: [...snapshot.reviewReasons],
    sourceRatio: snapshot.sourceRatio,
    status: "ready",
    error: undefined,
  };
}

/**
 * Adapts a quad from a source image coordinate system to a target image coordinate system
 * using normalized percentage ratios, and clamps each corner safely to [0, targetWidth] and [0, targetHeight].
 * Preserves corner order: top-left (0), top-right (1), bottom-right (2), bottom-left (3).
 */
export function adaptQuadToDimensions(
  quad: Quad,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Quad {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return cloneQuad(quad);
  }
  return quad.map(([x, y]) => {
    const u = Math.max(0, Math.min(1, x / sourceWidth));
    const v = Math.max(0, Math.min(1, y / sourceHeight));
    const targetX = Math.max(0, Math.min(targetWidth, Math.round(u * targetWidth * 100) / 100));
    const targetY = Math.max(0, Math.min(targetHeight, Math.round(v * targetHeight * 100) / 100));
    return [targetX, targetY];
  }) as Quad;
}

/**
 * Applies a manual quad to a slide item, setting status to ready and clearing review flags.
 */
export function applyQuadToSlide(
  slide: SlideItem,
  quad: Quad,
  width?: number,
  height?: number,
): SlideItem {
  return {
    ...slide,
    width: width && width > 0 ? width : slide.width,
    height: height && height > 0 ? height : slide.height,
    quad: cloneQuad(quad),
    method: "manual",
    confidence: 1,
    needsReview: false,
    reviewReasons: [],
    status: "ready",
    error: undefined,
  };
}
