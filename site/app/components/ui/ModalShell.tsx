import React from "react";
import { Button } from "./Button";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  appVersion?: string;
  modalRef?: React.RefObject<HTMLDivElement | null>;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  closeLabel?: string;
  children: React.ReactNode;
}

export function ModalShell({
  isOpen,
  onClose,
  title,
  appVersion,
  modalRef,
  closeButtonRef,
  closeLabel = "Close",
  children,
}: ModalShellProps) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitle">
            <h3 id="info-modal-title">{title}</h3>
            {appVersion && <span className="modalVersion">v{appVersion}</span>}
          </div>
          <Button
            ref={closeButtonRef}
            variant="icon"
            size="sm"
            className="modalCloseButton"
            onClick={onClose}
            aria-label={closeLabel}
          >
            &times;
          </Button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}
