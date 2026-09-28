import type { ReviewUiCopy } from "../i18n";
import { Button, Icon } from "./ui";

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
            <Icon name="magnifyingglass" size={15} />
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
              <Icon name="chevron.backward" size={12} />
              <span>{reviewText.reviewPrevSlide}</span>
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
              <span>{reviewText.reviewNextSlide}</span>
              <Icon name="chevron.forward" size={12} />
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
            <Icon name="checkmark" size={14} />
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
