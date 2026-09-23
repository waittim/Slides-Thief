import React from "react";
import type { LocaleCopy } from "../i18n.ts";
import { Button } from "./ui/Button.tsx";

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
        {/* Step 1: Angled Photo */}
        <div className="workflowStep" data-step="1">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              {/* Outer photo canvas/background */}
              <rect x="6" y="6" width="148" height="88" rx="8" className="svgCanvasBg" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" />
              {/* Camera corner brackets */}
              <path d="M16 16h8m-8 0v8M144 16h-8m8 0v8M16 84h8m-8 0v-8M144 84h-8m8 0v-8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
              {/* Skewed / perspective slide */}
              <polygon points="32,26 136,18 126,78 26,72" className="svgSlideBg" stroke="currentColor" strokeWidth="1.5" />
              {/* Tilted content lines */}
              <line x1="38" y1="36" x2="74" y2="33" className="svgTealAccent" strokeWidth="3" strokeLinecap="round" />
              <line x1="38" y1="46" x2="108" y2="42" className="svgTextLine" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
              <line x1="38" y1="54" x2="98" y2="50" className="svgTextLine" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
              <line x1="36" y1="62" x2="102" y2="58" className="svgTextLine" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep1Title}</span>
            <p className="workflowStepDetails">{text.workflowStep1Desc}</p>
          </div>
        </div>

        {/* Step Connector 1 -> 2 */}
        <div className="workflowConnector" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </div>

        {/* Step 2: Detect Corners & Quad */}
        <div className="workflowStep" data-step="2">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              {/* Canvas backdrop */}
              <rect x="6" y="6" width="148" height="88" rx="8" className="svgCanvasBg" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" />
              {/* Detected quad shape */}
              <polygon points="32,26 136,18 126,78 26,72" className="svgDetectedQuad" stroke="var(--accent-teal)" strokeWidth="2" strokeDasharray="3 3" />
              {/* Connecting diagonal grid hint */}
              <line x1="32" y1="26" x2="126" y2="78" stroke="var(--accent-teal)" strokeWidth="0.8" strokeOpacity="0.2" />
              <line x1="136" y1="18" x2="26" y2="72" stroke="var(--accent-teal)" strokeWidth="0.8" strokeOpacity="0.2" />
              {/* Corner handles (Order: TL, TR, BR, BL) */}
              <circle cx="32" cy="26" r="4.5" className="svgCornerHandle" />
              <circle cx="136" cy="18" r="4.5" className="svgCornerHandle" />
              <circle cx="126" cy="78" r="4.5" className="svgCornerHandle" />
              <circle cx="26" cy="72" r="4.5" className="svgCornerHandle" />
              {/* Loupe hint on top-left handle */}
              <circle cx="32" cy="26" r="11" fill="none" stroke="var(--handle)" strokeWidth="1.2" strokeDasharray="2 2" strokeOpacity="0.8" />
              <line x1="32" y1="18" x2="32" y2="34" stroke="var(--handle)" strokeWidth="1" strokeOpacity="0.5" />
              <line x1="24" y1="26" x2="40" y2="26" stroke="var(--handle)" strokeWidth="1" strokeOpacity="0.5" />
            </svg>
          </div>
          <div className="workflowStepInfo">
            <span className="workflowStepHeading">{text.workflowStep2Title}</span>
            <p className="workflowStepDetails">{text.workflowStep2Desc}</p>
          </div>
        </div>

        {/* Step Connector 2 -> 3 */}
        <div className="workflowConnector" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </div>

        {/* Step 3: Straightened & Rectified PDF */}
        <div className="workflowStep" data-step="3">
          <div className="workflowStepVisual" aria-hidden="true">
            <svg viewBox="0 0 160 100" fill="none" className="workflowSvg">
              {/* Canvas backdrop */}
              <rect x="6" y="6" width="148" height="88" rx="8" className="svgCanvasBg" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" />
              {/* Perfectly flat rectified slide rectangle */}
              <rect x="22" y="18" width="116" height="64" rx="4" className="svgRectifiedSlide" stroke="var(--accent-teal)" strokeWidth="2" />
              {/* Header banner */}
              <rect x="28" y="25" width="38" height="6" rx="2" className="svgTealFill" />
              {/* Clean structured content */}
              <line x1="28" y1="38" x2="74" y2="38" className="svgTextLine" strokeWidth="2" strokeLinecap="round" />
              <line x1="28" y1="46" x2="68" y2="46" className="svgTextLine" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
              <line x1="28" y1="54" x2="60" y2="54" className="svgTextLine" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
              {/* Mini chart card */}
              <rect x="84" y="32" width="46" height="36" rx="3" className="svgChartBg" stroke="var(--accent-teal)" strokeWidth="0.8" strokeOpacity="0.4" />
              <line x1="92" y1="60" x2="92" y2="44" stroke="var(--accent-teal)" strokeWidth="3" strokeLinecap="round" />
              <line x1="100" y1="60" x2="100" y2="38" stroke="var(--handle)" strokeWidth="3" strokeLinecap="round" />
              <line x1="108" y1="60" x2="108" y2="48" stroke="var(--accent-teal)" strokeWidth="3" strokeLinecap="round" />
              <line x1="116" y1="60" x2="116" y2="40" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
              {/* Teal checkmark badge */}
              <circle cx="132" cy="74" r="8" className="svgTealFill" stroke="var(--panel)" strokeWidth="2" />
              <path d="m129 74 2 2 4-4" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
