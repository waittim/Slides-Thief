import React, { useEffect, useRef } from "react";
import { Button } from "./Button";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  appVersion?: string;
  modalRef?: React.RefObject<HTMLDivElement | null>;
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeLabel?: string;
  titleId?: string;
  describedById?: string;
  className?: string;
  children: React.ReactNode;
}

export function ModalShell({
  isOpen,
  onClose,
  title,
  appVersion,
  modalRef,
  closeButtonRef,
  initialFocusRef,
  closeLabel = "Close",
  titleId = "info-modal-title",
  describedById,
  className = "",
  children,
}: ModalShellProps) {
  const fallbackModalRef = useRef<HTMLDivElement | null>(null);
  const fallbackCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const effectiveModalRef = modalRef ?? fallbackModalRef;
  const effectiveCloseBtnRef = closeButtonRef ?? fallbackCloseBtnRef;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFrame = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (effectiveCloseBtnRef.current) {
        effectiveCloseBtnRef.current.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const modal = effectiveModalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, onClose, effectiveModalRef, effectiveCloseBtnRef, initialFocusRef]);

  if (!isOpen) return null;

  const cardClassName = ["modalCard", className].filter(Boolean).join(" ");

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        ref={effectiveModalRef}
        className={cardClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitle">
            <h3 id={titleId}>{title}</h3>
            {appVersion && <span className="modalVersion">v{appVersion}</span>}
          </div>
          <Button
            ref={effectiveCloseBtnRef}
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
