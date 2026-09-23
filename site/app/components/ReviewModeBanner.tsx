import type { ReviewUiCopy } from "../i18n";
import { Button } from "./ui/Button";

export type ReviewModeBannerProps = {
  currentIndex: number;
  totalCount: number;
  isCurrentSlideReviewed: boolean;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onConfirm: () => void;
  onExit: () => void;
  onExportNow?: () => void;
  pendingExportFormat?: "pdf" | "jpg" | null;
  reviewText: ReviewUiCopy;
};

export function ReviewModeBanner({
  currentIndex,
  totalCount,
  isCurrentSlideReviewed,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onConfirm,
  onExit,
  onExportNow,
  pendingExportFormat,
  reviewText,
}: ReviewModeBannerProps) {
  return (
    <aside className="reviewModeBanner" role="region" aria-label={reviewText.reviewModeTitle}>
      <div className="reviewModeBannerMain">
        <div className="reviewModeBannerBadge">
          <span className="reviewModeIcon" aria-hidden="true">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <strong className="reviewModeTitle">{reviewText.reviewModeTitle}</strong>
          {totalCount > 0 ? (
            <span className="reviewModeProgress">
              {reviewText.reviewModeProgress(Math.max(1, currentIndex + 1), totalCount)}
            </span>
          ) : (
            <span className="reviewModeAllDone">{reviewText.reviewAllConfirmed}</span>
          )}
        </div>

        {totalCount > 0 ? (
          <div className="reviewModeBannerNav">
            <Button
              variant="secondary"
              size="sm"
              className="reviewNavPrevBtn"
              disabled={!canPrev}
              onClick={onPrev}
              title={`${reviewText.reviewPrevSlide} (K)`}
              aria-label={reviewText.reviewPrevSlide}
            >
              ‹ {reviewText.reviewPrevSlide}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="reviewNavNextBtn"
              disabled={!canNext}
              onClick={onNext}
              title={`${reviewText.reviewNextSlide} (J)`}
              aria-label={reviewText.reviewNextSlide}
            >
              {reviewText.reviewNextSlide} ›
            </Button>
          </div>
        ) : null}
      </div>

      <div className="reviewModeBannerActions">
        {totalCount > 0 && !isCurrentSlideReviewed ? (
          <Button
            variant="primary"
            size="sm"
            className="reviewConfirmBtn"
            onClick={onConfirm}
            title={reviewText.reviewConfirmSlide}
          >
            <svg
              width="14"
              height="14"
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
        ) : null}

        {pendingExportFormat && onExportNow ? (
          <Button
            variant={totalCount === 0 ? "primary" : "secondary"}
            size="sm"
            className="reviewExportNowBtn"
            onClick={onExportNow}
          >
            {reviewText.reviewExportNow(pendingExportFormat)}
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="reviewExitBtn"
          onClick={onExit}
          title={`${reviewText.reviewExit} (Esc)`}
        >
          {reviewText.reviewExit}
        </Button>
      </div>
    </aside>
  );
}
