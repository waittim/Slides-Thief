import React from "react";
import { formatSlideError, type LocaleCopy, type LocaleValue, type ReviewUiCopy } from "../i18n";
import type { SlideItem } from "../lib/types";
import { Button, CountBadge } from "./ui";

interface InspectorPanelProps {
  inspectorCollapsed: boolean;
  setInspectorCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  text: LocaleCopy;
  reviewText: ReviewUiCopy;
  readySlides: SlideItem[];
  metrics: Array<[string, string]>;
  selectedSlide: SlideItem | null;
  workerError?: string;
  applyQuadToFollowing?: () => void;
  applyQuadToAll?: () => void;
  canApplyFollowing?: boolean;
  canApplyAll?: boolean;
  locale?: LocaleValue;
  onConfirmSlide?: (id: string) => void;
  onStartReviewMode?: () => void;
  isReviewMode?: boolean;
  reviewSlideCount?: number;
}

export function InspectorPanel({
  inspectorCollapsed,
  setInspectorCollapsed,
  text,
  reviewText,
  readySlides,
  metrics,
  selectedSlide,
  workerError,
  applyQuadToFollowing,
  applyQuadToAll,
  canApplyFollowing = false,
  canApplyAll = false,
  locale,
  onConfirmSlide,
  onStartReviewMode,
  isReviewMode = false,
  reviewSlideCount = 0,
}: InspectorPanelProps) {
  return (
    <aside className={`inspector ${inspectorCollapsed ? "collapsed" : ""}`}>
      <div className="sectionHead">
        <h2>{text.details}</h2>
        <CountBadge count={readySlides.length} />
        <Button
          variant="icon"
          size="sm"
          className="inspectorToggle"
          type="button"
          title={inspectorCollapsed ? text.expand : text.collapse}
          aria-label={inspectorCollapsed ? text.expand : text.collapse}
          aria-expanded={!inspectorCollapsed}
          aria-controls="inspectorDetails"
          onClick={() => setInspectorCollapsed((value) => !value)}
        >
          {inspectorCollapsed ? "+" : "−"}
        </Button>
      </div>
      <div className="inspectorBody" id="inspectorDetails">
        {selectedSlide?.status === "ready" && selectedSlide.needsReview && selectedSlide.reviewReasons.length > 0 ? (
          <div
            className={`reviewCard ${selectedSlide.reviewReasons.includes("fallback_used") ? "fallback" : "warning"}`}
            role="status"
            aria-live="polite"
          >
            <div className="reviewCardHeader">
              <span className="reviewCardIcon" aria-hidden="true">
                {selectedSlide.reviewReasons.includes("fallback_used") ? "⚠" : "!"}
              </span>
              <strong className="reviewCardTitle">
                {selectedSlide.reviewReasons.includes("fallback_used")
                  ? reviewText.reviewFallbackTitle
                  : reviewText.reviewSuggested}
              </strong>
            </div>
            <ul className="reviewCardList">
              {selectedSlide.reviewReasons.map((reason) => (
                <li key={reason} className="reviewCardItem">
                  {reviewText.reviewReasons[reason] ?? reason}
                </li>
              ))}
            </ul>
            {onConfirmSlide ? (
              <div className="reviewCardActions">
                <Button
                  variant="secondary"
                  size="sm"
                  className="reviewCardConfirmBtn"
                  onClick={() => onConfirmSlide(selectedSlide.id)}
                  title={reviewText.reviewConfirmSlide}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {reviewText.reviewConfirmSlide}
                </Button>
                {!isReviewMode && onStartReviewMode && reviewSlideCount > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="reviewCardEnterModeBtn"
                    onClick={onStartReviewMode}
                    title={reviewText.startReview}
                  >
                    {reviewText.startReview}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="metrics">
          {metrics.map(([key, value]) => (
            <div className="metric" key={key}>
              <div className="key">{key}</div>
              <div className="value">{value}</div>
            </div>
          ))}
        </div>
        <div className="cornerTable">
          {selectedSlide?.quad
            ? selectedSlide.quad.map(([x, y], index) => (
                <div className="cornerRow" key={index}>
                  <span>{index + 1}</span>
                  <code>{Math.round(x * 100) / 100}</code>
                  <code>{Math.round(y * 100) / 100}</code>
                </div>
              ))
            : null}
        </div>
        {selectedSlide?.quad && (applyQuadToFollowing || applyQuadToAll) ? (
          <div className="inspectorBatchActions">
            {applyQuadToFollowing ? (
              <Button
                variant="secondary"
                size="sm"
                className="inspectorApplyFollowingButton"
                disabled={!canApplyFollowing}
                title={text.applyToFollowing}
                onClick={applyQuadToFollowing}
              >
                {text.applyToFollowing}
              </Button>
            ) : null}
            {applyQuadToAll ? (
              <Button
                variant="secondary"
                size="sm"
                className="inspectorApplyAllButton"
                disabled={!canApplyAll}
                title={text.applyToAll}
                onClick={applyQuadToAll}
              >
                {text.applyToAll}
              </Button>
            ) : null}
          </div>
        ) : null}
        {selectedSlide?.error ? (
          <p className="errorText" role="alert">
            {formatSlideError(selectedSlide.error, locale, text)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
