import React from "react";
import type { LocaleCopy } from "../i18n.ts";
import { Button } from "./ui/Button.tsx";
import { Icon } from "./ui/Icon.tsx";

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
      rx="10"
      className="svgCanvasBg"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.12"
    />
  );
}

function WorkflowArrow() {
  return (
    <div className="workflowConnector" aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
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
          <Icon name="lock.shield" size={14} />
          <span>{text.emptySubtitle}</span>
        </div>
        <h2 className="emptyTitle">{text.emptyTitle}</h2>
      </div>

      {/* Action Stage: Hero Call to Action */}
      <div className="emptyActions">
        <Button
          variant="accent"
          size={isMobile ? "touch" : "md"}
          className="emptyActionBtn emptyUploadBtn"
          disabled={busy}
          onClick={onUpload}
        >
          <Icon name="photo" size={18} />
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
            <Icon name="play.fill" size={15} />
            <span>{text.trySample}</span>
          </Button>
        )}
      </div>

      {/* 3-Step Workflow: Outcome-Driven Visual Strip (hidden on mobile to save screen space) */}
      {!isMobile && (
        <div className="emptyWorkflow" aria-label="Workflow overview">
        {/* Step 1: the slide as photographed, off-axis and low contrast */}
        <div className="workflowStep" data-step="1">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              <defs>
                <filter id="emptyStep1SlideShadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.32" />
                </filter>
              </defs>
              <StepFrame />
              {/* Ambient shadow behind the angled slide */}
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                fill="#000000"
                filter="url(#emptyStep1SlideShadow)"
                opacity="0.32"
              />
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                className="svgSlideRaw"
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.18"
              />
              <SlideContent quad={QUAD_ANGLED} contrast={0.65} />
              {/* Apple Camera-style viewfinder corner brackets */}
              <path
                d="M14 14h9m-9 0v9M146 14h-9m9 0v9M14 86h9m-9 0v-9M146 86h-9m9 0v-9"
                stroke="var(--accent-2)"
                strokeWidth="1.8"
                strokeOpacity="0.78"
                strokeLinecap="round"
              />
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
              <defs>
                <filter id="emptyStep2SlideShadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.25" />
                </filter>
                <filter id="emptyStep2LoupeShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
                </filter>
              </defs>
              <StepFrame />
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                fill="#000000"
                filter="url(#emptyStep2SlideShadow)"
                opacity="0.25"
              />
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                className="svgSlideRaw"
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.12"
              />
              <SlideContent quad={QUAD_ANGLED} contrast={0.3} />
              {/* Precision detected bounding quad */}
              <polygon
                points={quadPoints(QUAD_ANGLED)}
                className="svgDetectedQuad"
                stroke="var(--accent-2)"
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />
              {/* Corner handles with Apple-style frosted outer ring + crisp pip */}
              {QUAD_ANGLED.map(([x, y]) => (
                <g key={`${x}-${y}`}>
                  <circle cx={x} cy={y} r="5.5" fill="var(--panel)" stroke="var(--accent-2)" strokeWidth="1.5" />
                  <circle cx={x} cy={y} r="2.8" className="svgCornerHandle" />
                </g>
              ))}
              {/* Apple precision magnifying loupe hint on the top-left handle */}
              <g filter="url(#emptyStep2LoupeShadow)">
                <circle
                  cx="32"
                  cy="26"
                  r="13"
                  fill="var(--panel)"
                  stroke="var(--line)"
                  strokeWidth="1.2"
                />
                <circle
                  cx="32"
                  cy="26"
                  r="11"
                  fill="none"
                  stroke="var(--accent-2)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.75"
                />
                <line x1="32" y1="16" x2="32" y2="36" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
                <line x1="22" y1="26" x2="42" y2="26" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
                <circle cx="32" cy="26" r="2.5" fill="var(--handle)" stroke="var(--panel)" strokeWidth="1" />
              </g>
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
              <defs>
                <filter id="emptyStep3SlideShadow" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.12" />
                  <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.22" />
                </filter>
                <filter id="emptyStep3BadgeShadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#30d158" floodOpacity="0.4" />
                </filter>
                <linearGradient id="emptyStep3BadgeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34c759" />
                  <stop offset="100%" stopColor="#24a644" />
                </linearGradient>
              </defs>
              <StepFrame />
              <rect
                x="24"
                y="20"
                width="112"
                height="60"
                rx="4.5"
                className="svgSlideClean"
                stroke="light-dark(rgba(0,0,0,0.06), rgba(255,255,255,0.12))"
                strokeWidth="1"
                filter="url(#emptyStep3SlideShadow)"
              />
              <SlideContent quad={QUAD_FLAT} contrast={1} />
              {/* Apple-style floating success badge */}
              <g filter="url(#emptyStep3BadgeShadow)">
                <circle cx="132" cy="76" r="9" fill="url(#emptyStep3BadgeGrad)" stroke="var(--panel)" strokeWidth="2" />
                <path
                  d="m128.5 76 2.5 2.5 5-5"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep3Title}</span>
            <p className="workflowStepDetails">{text.workflowStep3Desc}</p>
          </div>
        </div>
      </div>
    )}

      {/* Photography Tips Card */}
      <details className="emptyTipsCard">
        <summary className="emptyTipsTitleRow">
          <Icon name="info.circle" size={16} className="emptyTipsIcon" />
          <span className="emptyTipsTitle">{text.tipsHeading}</span>
          <Icon name="chevron.down" size={14} className="emptyTipsChevron" />
        </summary>

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
      </details>
    </div>
  );
}
