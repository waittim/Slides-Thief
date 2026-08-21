import type { Quad } from "../detection/types";
import type { SlideItem } from "./types";

function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
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
