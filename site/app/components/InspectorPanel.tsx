import React, { useEffect, useRef, useState } from "react";
import { formatSlideError, type LocaleCopy, type LocaleValue, type ReviewUiCopy } from "../i18n";
import type { SlideItem } from "../lib/types";
import { maxQuadOutside } from "../lib/slide-utils.ts";
import { Button, CountBadge, Icon } from "./ui";

export type MetricItem = [string, React.ReactNode, string?];

export interface CornerCoordinateInputProps {
  value: number;
  min?: number;
  max: number;
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  onChange?: (value: number) => void;
}

export function CornerCoordinateInput({
  value,
  min = 0,
  max,
  ariaLabel,
  title,
  disabled = false,
  onChange,
}: CornerCoordinateInputProps) {
  const roundedValue = Math.round(value);
  const [localText, setLocalText] = useState<string>(String(roundedValue));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const lastCommittedRef = useRef(roundedValue);
  const displayedText = isFocused ? localText : String(roundedValue);

  useEffect(() => {
    lastCommittedRef.current = roundedValue;
  }, [roundedValue]);

  const commit = () => {
    const parsed = parseFloat(localText);
    if (!Number.isFinite(parsed)) {
      setLocalText(String(roundedValue));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setLocalText(String(clamped));
    if (clamped !== lastCommittedRef.current) {
      lastCommittedRef.current = clamped;
      onChange?.(clamped);
    }
  };

  return (
    <input
      type="number"
      className="cornerInput"
      value={displayedText}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => setLocalText(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setLocalText(String(Math.round(value)));
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export interface InspectorPanelProps {
  inspectorCollapsed: boolean;
  setInspectorCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  text: LocaleCopy;
  reviewText: ReviewUiCopy;
  readySlides: SlideItem[];
  metrics: MetricItem[];
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
  onCornerChange?: (cornerIndex: number, coordIndex: 0 | 1, value: number) => void;
  onExtrapolateCorner?: (cornerIndex: number) => void;
  disabled?: boolean;
}

export function InspectorPanel({
  inspectorCollapsed,
  setInspectorCollapsed,
  text,
  reviewText,
  readySlides,
  metrics,
  selectedSlide,
  applyQuadToFollowing,
  applyQuadToAll,
  canApplyFollowing = false,
  canApplyAll = false,
  locale,
  onConfirmSlide,
  onStartReviewMode,
  isReviewMode = false,
  reviewSlideCount = 0,
  onCornerChange,
  onExtrapolateCorner,
  disabled = false,
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
          <Icon name={inspectorCollapsed ? "plus" : "minus"} size={13} />
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
                  <Icon name="checkmark" size={13} />
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
          {metrics.map(([key, value, tooltip]) => (
            <div className="metric" key={key}>
              <div className="key">{key}</div>
              <div className="value" title={tooltip}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="cornerTable" role="group" aria-label={text.adjustCorners}>
          {selectedSlide?.quad ? (
            <>
              <div className="cornerTableHeader" aria-hidden="true">
                <span
                  className="cornerTableColHeader"
                  title={text.cornerPositions.map((pos, i) => `${i + 1}: ${pos}`).join(", ")}
                >
                  #
                </span>
                <span className="cornerTableColHeader">X</span>
                <span className="cornerTableColHeader">Y</span>
                {onExtrapolateCorner ? (
                  <span className="cornerTableColHeader" title={text.snap}>
                    ✨
                  </span>
                ) : null}
              </div>
              {selectedSlide.quad.map(([x, y], index) => {
                const width = selectedSlide.width > 0 ? selectedSlide.width : 10000;
                const height = selectedSlide.height > 0 ? selectedSlide.height : 10000;
                const maxOutsideX = maxQuadOutside(width);
                const maxOutsideY = maxQuadOutside(height);
                const posName = text.cornerPositions[index];
                return (
                  <div className="cornerRow" key={index}>
                    <span
                      className="cornerIndex"
                      aria-hidden="true"
                      title={`${text.cornerHandle} ${index + 1}: ${posName}`}
                    >
                      {index + 1}
                    </span>
                    <CornerCoordinateInput
                      value={x}
                      min={-maxOutsideX}
                      max={width + maxOutsideX}
                      ariaLabel={`${text.cornerHandle} ${index + 1} (${posName}) X`}
                      title={`${text.cornerHandle} ${index + 1} (${posName}) X (${-maxOutsideX} – ${width + maxOutsideX})`}
                      disabled={disabled}
                      onChange={(newVal) => onCornerChange?.(index, 0, newVal)}
                    />
                    <CornerCoordinateInput
                      value={y}
                      min={-maxOutsideY}
                      max={height + maxOutsideY}
                      ariaLabel={`${text.cornerHandle} ${index + 1} (${posName}) Y`}
                      title={`${text.cornerHandle} ${index + 1} (${posName}) Y (${-maxOutsideY} – ${height + maxOutsideY})`}
                      disabled={disabled}
                      onChange={(newVal) => onCornerChange?.(index, 1, newVal)}
                    />
                    {onExtrapolateCorner ? (
                      <Button
                        variant="icon"
                        size="sm"
                        className="cornerExtrapolateBtn"
                        type="button"
                        disabled={disabled}
                        title={`${text.extrapolateCorner(index + 1)} (${posName})`}
                        aria-label={`${text.extrapolateCorner(index + 1)} (${posName})`}
                        onClick={() => onExtrapolateCorner(index)}
                      >
                        <Icon name="sparkles" size={13} />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              <div className="cornerOrderLegend" aria-hidden="true" title={text.adjustCorners}>
                {text.cornerPositions.map((pos, idx) => (
                  <span key={idx} className="cornerLegendItem">
                    <span className="cornerLegendNum">{idx + 1}</span>
                    <span className="cornerLegendPos">{pos}</span>
                    {idx < 3 ? <span className="cornerLegendSep">›</span> : null}
                  </span>
                ))}
              </div>
            </>
          ) : null}
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
