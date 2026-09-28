import { useState } from "react";
import type { Quad } from "../../app/detection/types";
import { InspectorPanel, type MetricItem } from "../../app/components/InspectorPanel";
import { copy, reviewUiCopy } from "../../app/i18n";
import { confidenceSummary } from "../../app/lib/slide-utils";
import type { SlideItem } from "../../app/lib/types";

export function InspectorHarness({
  slide: initialSlide,
  collapsed = false,
  onConfirmSlide,
  onStartReviewMode,
  onCornerChange,
  disabled = false,
}: {
  slide: SlideItem | null;
  collapsed?: boolean;
  onConfirmSlide?: (id: string) => void;
  onStartReviewMode?: () => void;
  onCornerChange?: (cornerIndex: number, coordIndex: 0 | 1, value: number) => void;
  disabled?: boolean;
}) {
  const [slide, setSlide] = useState(initialSlide);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(collapsed);
  const text = copy.en;
  const reviewText = reviewUiCopy.en;

  const handleCornerChange = (cornerIndex: number, coordIndex: 0 | 1, value: number) => {
    onCornerChange?.(cornerIndex, coordIndex, value);
    setSlide((current) => {
      if (!current?.quad) return current;
      const nextQuad = current.quad.map((point) => [point[0], point[1]]) as Quad;
      nextQuad[cornerIndex][coordIndex] = value;
      return {
        ...current,
        quad: nextQuad,
      };
    });
  };

  const confidenceData = slide
    ? confidenceSummary(slide, text, reviewText)
    : { label: "-", tooltip: undefined };

  const metrics: MetricItem[] = slide
    ? [
        ["File", slide.name],
        ["Status", slide.needsReview ? reviewText.reviewSuggested : reviewText.corrected],
        [text.confidence, confidenceData.label, confidenceData.tooltip],
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
      onConfirmSlide={onConfirmSlide}
      onStartReviewMode={onStartReviewMode}
      onCornerChange={handleCornerChange}
      disabled={disabled}
    />
  );
}
