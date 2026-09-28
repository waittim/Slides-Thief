import { useState } from "react";
import { ReviewModeBanner } from "../../app/components/ReviewModeBanner";
import { reviewUiCopy } from "../../app/i18n";

export interface ReviewModeBannerHarnessProps {
  initialIndex?: number;
  initialTotal?: number;
  initialReviewed?: boolean;
  pendingFormat?: "pdf" | "jpg" | null;
}

export function ReviewModeBannerHarness({
  initialIndex = 0,
  initialTotal = 3,
  initialReviewed = false,
  pendingFormat = "pdf",
}: ReviewModeBannerHarnessProps) {
  const [index, setIndex] = useState(initialIndex);
  const [total, setTotal] = useState(initialTotal);
  const [isReviewed, setIsReviewed] = useState(initialReviewed);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [exited, setExited] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<string | null>(null);

  const reviewText = reviewUiCopy["zh-CN"];

  const handleConfirm = () => {
    setIsReviewed(true);
    setConfirmedCount((c) => c + 1);
    if (total > 1) {
      setTotal((t) => t - 1);
      setIndex((idx) => Math.min(idx, total - 2));
      setIsReviewed(false);
    } else {
      setTotal(0);
    }
  };

  const handleExportNow = () => {
    setExportedFormat(pendingFormat);
  };

  return (
    <div style={{ width: "800px", padding: "20px", background: "var(--bg)" }}>
      <div className="harnessStatus">
        <span className="statusIndex">{index}</span>
        <span className="statusTotal">{total}</span>
        <span className="statusConfirmedCount">{confirmedCount}</span>
        <span className="statusExited">{exited ? "exited" : "active"}</span>
        <span className="statusExported">{exportedFormat ?? "none"}</span>
      </div>

      <ReviewModeBanner
        currentIndex={index}
        totalCount={total}
        isCurrentSlideReviewed={isReviewed}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(total - 1, i + 1))}
        canPrev={index > 0}
        canNext={index < total - 1}
        onConfirm={handleConfirm}
        onExit={() => setExited(true)}
        onExportNow={handleExportNow}
        pendingExportFormat={pendingFormat}
        reviewText={reviewText}
      />
    </div>
  );
}
