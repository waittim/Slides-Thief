import React from "react";
import type { LocaleCopy } from "../i18n.ts";
import { Button } from "./ui/Button.tsx";

type Point = readonly [number, number];

/** Quad corners in the canonical order: top-left, top-right, bottom-right, bottom-left. */
type Quad = readonly [Point, Point, Point, Point];

/** The slide as shot from a seat. The right edge is taller, so that side reads as nearer the lens. */
const QUAD_ANGLED: Quad = [
  [32, 26],
  [136, 18],
  [126, 78],
  [26, 72],
];

/** The same slide after perspective correction. */
const QUAD_FLAT: Quad = [
  [24, 20],
  [136, 20],
  [136, 80],
  [24, 80],
];

interface SlideBar {
  /** Horizontal span across the slide, 0 at the left edge and 1 at the right edge. */
  u0: number;
  u1: number;
  /** Vertical span down the slide, 0 at the top edge and 1 at the bottom edge. */
  v0: number;
  v1: number;
  accent?: boolean;
  opacity: number;
}

/**
 * Slide content in normalized slide space. Every step draws this same table, so the three
 * frames read as one slide moving through the pipeline instead of three unrelated pictures.
 */
const SLIDE_BARS: readonly SlideBar[] = [
  { u0: 0.075, u1: 0.42, v0: 0.1, v1: 0.175, accent: true, opacity: 1 },
  { u0: 0.075, u1: 0.88, v0: 0.3, v1: 0.355, opacity: 0.5 },
  { u0: 0.075, u1: 0.8, v0: 0.435, v1: 0.49, opacity: 0.38 },
  { u0: 0.075, u1: 0.85, v0: 0.57, v1: 0.625, opacity: 0.38 },
  { u0: 0.075, u1: 0.48, v0: 0.705, v1: 0.76, opacity: 0.38 },
];

/**
 * Bilinear map from normalized slide space onto a quad. Interpolating down both side edges
 * before interpolating across keeps every row parallel to the slide's own converging edges.
 */
function mapToQuad([tl, tr, br, bl]: Quad, u: number, v: number): Point {
  const leftX = tl[0] + (bl[0] - tl[0]) * v;
  const leftY = tl[1] + (bl[1] - tl[1]) * v;
  const rightX = tr[0] + (br[0] - tr[0]) * v;
  const rightY = tr[1] + (br[1] - tr[1]) * v;
  return [leftX + (rightX - leftX) * u, leftY + (rightY - leftY) * u];
}

/**
 * A bar is drawn as a mapped polygon rather than a stroked line so it tapers toward the
 * far edge of the quad on its own, instead of keeping one flat stroke width.
 */
function barPoints(quad: Quad, bar: SlideBar): string {
  const corners: Point[] = [
    mapToQuad(quad, bar.u0, bar.v0),
    mapToQuad(quad, bar.u1, bar.v0),
    mapToQuad(quad, bar.u1, bar.v1),
    mapToQuad(quad, bar.u0, bar.v1),
  ];
  return corners.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ");
}

function quadPoints(quad: Quad): string {
  return quad.map(([x, y]) => `${x},${y}`).join(" ");
}

/** `contrast` carries the enhancement story: washed out in the photo, full strength once corrected. */
function SlideContent({ quad, contrast }: { quad: Quad; contrast: number }) {
  return (
    <g opacity={contrast}>
      {SLIDE_BARS.map((bar) => (
        <polygon
          key={`${bar.v0}-${bar.u1}`}
          points={barPoints(quad, bar)}
          className={bar.accent ? "svgTealFill" : "svgTextFill"}
          opacity={bar.opacity}
        />
      ))}
    </g>
  );
}

function StepFrame() {
  return (
    <rect
      x="6"
      y="6"
      width="148"
      height="88"
      rx="8"
      className="svgCanvasBg"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeOpacity="0.25"
    />
  );
}

function WorkflowArrow() {
  return (
    <div className="workflowConnector" aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </div>
  );
}

export interface CanvasEmptyStateProps {
  text: LocaleCopy;
  isMobile?: boolean;
  onUpload?: () => void;
  onLoadSample?: () => void;
  busy?: boolean;
}

export function CanvasEmptyState({
  text,
  isMobile = false,
  onUpload,
  onLoadSample,
  busy = false,
}: CanvasEmptyStateProps) {
  return (
    <div className="canvasEmptyState" role="region" aria-label={text.emptyTitle}>
      {/* Header Banner */}
      <div className="emptyHeader">
        <div className="emptyPrivacyBadge">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{text.emptySubtitle}</span>
        </div>
        <h2 className="emptyTitle">{text.emptyTitle}</h2>
      </div>

      {/* 3-Step Workflow Vector Diagram */}
      <div className="emptyWorkflow" aria-label="Workflow overview">
        {/* Step 1: the slide as photographed, off-axis and low contrast */}
        <div className="workflowStep" data-step="1">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              <StepFrame />
              {/* Camera corner brackets */}
              <path
                d="M16 16h8m-8 0v8M144 16h-8m8 0v8M16 84h8m-8 0v-8M144 84h-8m8 0v-8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                className="svgSlideRaw"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeOpacity="0.45"
              />
              <SlideContent quad={QUAD_ANGLED} contrast={0.62} />
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep1Title}</span>
            <p className="workflowStepDetails">{text.workflowStep1Desc}</p>
          </div>
        </div>

        <WorkflowArrow />

        {/* Step 2: the same frame with the detected boundary and draggable corners on top */}
        <div className="workflowStep" data-step="2">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              <StepFrame />
              <polygon points={quadPoints(QUAD_ANGLED)} className="svgSlideRaw" />
              <SlideContent quad={QUAD_ANGLED} contrast={0.3} />
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                className="svgDetectedQuad"
                stroke="var(--accent-2)"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              {QUAD_ANGLED.map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" className="svgCornerHandle" />
              ))}
              {/* Loupe hint on the top-left handle */}
              <circle
                cx="32"
                cy="26"
                r="11"
                fill="none"
                stroke="var(--handle)"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                strokeOpacity="0.8"
              />
              <line x1="32" y1="18" x2="32" y2="34" stroke="var(--handle)" strokeWidth="1" strokeOpacity="0.5" />
              <line x1="24" y1="26" x2="40" y2="26" stroke="var(--handle)" strokeWidth="1" strokeOpacity="0.5" />
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep2Title}</span>
            <p className="workflowStepDetails">{text.workflowStep2Desc}</p>
          </div>
        </div>

        <WorkflowArrow />

        {/* Step 3: the same content rectified and at full contrast */}
        <div className="workflowStep" data-step="3">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              <StepFrame />
              <rect
                x="24"
                y="20"
                width="112"
                height="60"
                rx="3"
                className="svgSlideClean"
                stroke="var(--accent-2)"
                strokeWidth="1.5"
              />
              <SlideContent quad={QUAD_FLAT} contrast={1} />
              {/* Completion badge */}
              <circle cx="132" cy="76" r="8" className="svgTealFill" stroke="var(--panel)" strokeWidth="2" />
              <path
                d="m129 76 2 2 4-4"
                stroke="var(--accent-2-text)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep3Title}</span>
            <p className="workflowStepDetails">{text.workflowStep3Desc}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="emptyActions">
        <Button
          variant="primary"
          size={isMobile ? "touch" : "md"}
          className="emptyActionBtn emptyUploadBtn"
          disabled={busy}
          onClick={onUpload}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{isMobile ? text.uploadTitle : text.dropTitle}</span>
        </Button>

        {onLoadSample && (
          <Button
            variant="secondary"
            size={isMobile ? "touch" : "md"}
            className="emptyActionBtn emptySampleBtn"
            disabled={busy}
            onClick={onLoadSample}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>{text.trySample}</span>
          </Button>
        )}
      </div>

      {/* Photography Tips Card */}
      <div className="emptyTipsCard" role="complementary" aria-label={text.tipsHeading}>
        <div className="emptyTipsTitleRow">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="emptyTipsIcon"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="emptyTipsTitle">{text.tipsHeading}</span>
        </div>

        <div className="emptyTipsGrid">
          <div className="emptyTipItem">
            <div className="emptyTipBadge" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2m-10 0H5a2 2 0 0 1-2-2v-2" />
              </svg>
            </div>
            <div className="emptyTipContent">
              <strong className="emptyTipName">{text.tipCornersTitle}</strong>
              <p className="emptyTipExplain">{text.tipCornersDesc}</p>
            </div>
          </div>

          <div className="emptyTipItem">
            <div className="emptyTipBadge" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14-1.41 1.41" />
              </svg>
            </div>
            <div className="emptyTipContent">
              <strong className="emptyTipName">{text.tipOcclusionTitle}</strong>
              <p className="emptyTipExplain">{text.tipOcclusionDesc}</p>
            </div>
          </div>

          <div className="emptyTipItem">
            <div className="emptyTipBadge" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 0 0 20z" />
              </svg>
            </div>
            <div className="emptyTipContent">
              <strong className="emptyTipName">{text.tipContrastTitle}</strong>
              <p className="emptyTipExplain">{text.tipContrastDesc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
