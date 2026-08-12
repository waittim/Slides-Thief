import { useRef, useState } from "react";
import { copy, reviewUiCopy } from "../../app/i18n";
import { SlideSidebar } from "../../app/components/SlideSidebar";
import type { SlideItem } from "../../app/lib/types";

const QUAD = [[12, 10], [108, 10], [108, 70], [12, 70]] as const;

function queuedSlide(file: File): SlideItem {
  return {
    id: file.name,
    file,
    name: file.name,
    url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    width: 100,
    height: 70,
    quad: null,
    autoDetection: null,
    method: null,
    confidence: 0,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
    status: "queued",
  };
}

function readySlide(slide: SlideItem): SlideItem {
  return {
    ...slide,
    quad: QUAD.map(([x, y]) => [x, y]) as [number, number][],
    method: "contrast-lines",
    confidence: 0.95,
    needsReview: false,
    status: "ready",
  } as SlideItem;
}

export function SidebarHarness() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [exported, setExported] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const text = copy.en;
  const reviewText = reviewUiCopy.en;
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);

  return (
    <>
      <SlideSidebar
        busy={false}
        slides={slides}
        readySlides={readySlides}
        runAuto={() => {
          setHasRun(true);
          setSlides((current) => current.map(readySlide));
        }}
        exportPdf={() => setExported(true)}
        text={text}
        reviewText={reviewText}
        statusTone={hasRun ? "good" : "default"}
        statusText={exported ? text.generated : hasRun ? text.reviewReady : text.ready}
        exportUrl={exported ? "blob:http://localhost/test-pdf" : null}
        exportName="deck.pdf"
        isIOS={false}
        clearAllSlides={() => setSlides([])}
        inputRef={inputRef}
        loadFiles={(files) => {
          const file = Array.from(files)[0];
          if (!file) return;
          setSlides([queuedSlide(file)]);
          setSelectedId(file.name);
          setHasRun(false);
          setExported(false);
        }}
        dragActive={dragActive}
        setDragActive={setDragActive}
        isMobile={false}
        selectedId={selectedId}
        hasRun={hasRun}
        selectAt={(index) => setSelectedId(slides[index]?.id ?? null)}
        slideStatusText={(slide) => (slide.status === "ready" ? reviewText.corrected : text.pending)}
        deleteSlide={(id) => setSlides((current) => current.filter((slide) => slide.id !== id))}
      />
      <output data-testid="workflow-status">{exported ? "exported" : hasRun ? "straightened" : "waiting"}</output>
    </>
  );
}
