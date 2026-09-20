import type { ReviewReason } from "../../app/detection/types";
import type { SlideDetectionMethod, SlideItem } from "../../app/lib/types";

const QUAD: [number, number][] = [[12, 10], [108, 10], [108, 70], [12, 70]];

export function makeTestSlide({
  id = "deck.png",
  name = "deck.png",
  status = "ready",
  needsReview = false,
  reviewReasons = [],
  method = "contrast-lines",
}: {
  id?: string;
  name?: string;
  status?: "ready" | "error" | "queued";
  needsReview?: boolean;
  reviewReasons?: ReviewReason[];
  method?: SlideDetectionMethod;
} = {}): SlideItem {
  return {
    id,
    file: { name, size: 1024 } as File,
    name,
    url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    width: 100,
    height: 70,
    quad: QUAD.map(([x, y]) => [x, y]),
    autoDetection: null,
    method,
    confidence: needsReview ? 0.5 : 0.95,
    needsReview,
    reviewReasons,
    sourceRatio: 16 / 9,
    status: status as SlideItem["status"],
  } as SlideItem;
}
