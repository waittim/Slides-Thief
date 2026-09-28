import { useState } from "react";
import { ConfirmModal } from "../../app/components/ui/ConfirmModal";
import { copy, reviewUiCopy } from "../../app/i18n";

export interface ConfirmModalHarnessProps {
  mode?: "clear" | "review";
  initialOpen?: boolean;
}

export function ConfirmModalHarness({
  mode = "clear",
  initialOpen = true,
}: ConfirmModalHarnessProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [confirmed, setConfirmed] = useState(false);
  const [canceled, setCanceled] = useState(false);

  const text = copy["zh-CN"];
  const reviewText = reviewUiCopy["zh-CN"];

  return (
    <div style={{ width: "800px", minHeight: "600px", padding: "20px", background: "var(--bg)" }}>
      <button className="harnessTrigger" onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      <div className="harnessStatus">
        <span className="statusConfirmed">{confirmed ? "confirmed" : "not-confirmed"}</span>
        <span className="statusCanceled">{canceled ? "canceled" : "not-canceled"}</span>
        <span className="statusOpen">{isOpen ? "open" : "closed"}</span>
      </div>

      {mode === "clear" ? (
        <ConfirmModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setCanceled(true);
          }}
          onConfirm={() => {
            setIsOpen(false);
            setConfirmed(true);
          }}
          title={text.clearAllTitle}
          message={text.clearAllConfirm(5)}
          confirmLabel={text.clearAllAction}
          cancelLabel={text.keepSlidesAction}
          destructive
          closeLabel={text.close}
        />
      ) : (
        <ConfirmModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setCanceled(true);
          }}
          onConfirm={() => {
            setIsOpen(false);
            setConfirmed(true);
          }}
          title={reviewText.reviewModalTitle}
          message={reviewText.reviewConfirmation(3)}
          confirmLabel={reviewText.reviewModalConfirm}
          cancelLabel={reviewText.reviewModalCancel}
          confirmVariant="primary"
          cancelVariant="secondary"
          closeLabel={text.close}
        />
      )}
    </div>
  );
}
