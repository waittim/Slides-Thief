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
  const [exportedJpg, setExportedJpg] = useState(false);
  const [manualExported, setManualExported] = useState(false);
  const [manualImported, setManualImported] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const text = copy.en;
  const reviewText = reviewUiCopy.en;
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);

  const exportArtifacts = {
    ...(exported
      ? {
          pdf: {
            format: "pdf" as const,
            url: "blob:http://localhost/test-pdf",
            filename: "deck.pdf",
            byteLength: 1024,
          },
        }
      : {}),
    ...(exportedJpg
      ? {
          jpg: {
            format: "jpg" as const,
            url: "blob:http://localhost/test-jpg",
            filename: readySlides.length === 1 ? "deck.jpg" : "deck-jpgs.zip",
            byteLength: 2048,
          },
        }
      : {}),
  };

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
        exportJpg={() => setExportedJpg(true)}
        exportArtifacts={exportArtifacts}
        importManualQuads={() => setManualImported(true)}
        exportManualQuads={() => setManualExported(true)}
        text={text}
        reviewText={reviewText}
        statusTone={hasRun ? "good" : "default"}
        statusText={exportedJpg ? text.generatedJpg : exported ? text.generated : hasRun ? text.reviewReady : text.ready}
        exportUrl={exported ? "blob:http://localhost/test-pdf" : null}
        exportName="deck.pdf"
        isIOS={false}
        clearAllSlides={() => {
          setSlides([]);
          setHasRun(false);
          setExported(false);
          setExportedJpg(false);
        }}
        inputRef={inputRef}
        manualInputRef={manualInputRef}
        loadFiles={(files) => {
          const fileList = Array.from(files);
          if (!fileList.length) return;
          setSlides(fileList.map(queuedSlide));
          setSelectedId(fileList[0].name);
          setHasRun(false);
          setExported(false);
          setExportedJpg(false);
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
      <output data-testid="workflow-status">
        {manualImported
          ? "manual-imported"
          : manualExported
            ? "manual-exported"
            : exportedJpg
              ? "exported-jpg"
              : exported
                ? "exported"
                : hasRun
                  ? "straightened"
                  : "waiting"}
      </output>
    </>
  );
}
