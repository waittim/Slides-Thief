import { useState } from "react";
import { InspectorPanel } from "../../app/components/InspectorPanel";
import { copy, reviewUiCopy } from "../../app/i18n";
import type { SlideItem } from "../../app/lib/types";

export function InspectorHarness({
  slide,
  collapsed = false,
}: {
  slide: SlideItem | null;
  collapsed?: boolean;
}) {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(collapsed);
  const text = copy.en;
  const reviewText = reviewUiCopy.en;

  const metrics: Array<[string, string]> = slide
    ? [
        ["File", slide.name],
        ["Status", slide.needsReview ? reviewText.reviewSuggested : reviewText.corrected],
      ]
    : [];

  return (
    <InspectorPanel
      inspectorCollapsed={inspectorCollapsed}
      setInspectorCollapsed={setInspectorCollapsed}
      text={text}
      reviewText={reviewText}
      readySlides={slide ? [slide] : []}
      metrics={metrics}
      selectedSlide={slide}
      workerError=""
    />
  );
}
