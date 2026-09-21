import React, { useRef } from "react";
import { Button, type ButtonVariant } from "./Button";
import { ModalShell } from "./ModalShell";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ButtonVariant;
  cancelVariant?: ButtonVariant;
  destructive?: boolean;
  closeLabel?: string;
  autoFocusButton?: "confirm" | "cancel" | "close";
  className?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant,
  cancelVariant = "secondary",
  destructive = false,
  closeLabel = "Close",
  autoFocusButton,
  className = "",
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const resolvedConfirmVariant: ButtonVariant =
    confirmVariant ?? (destructive ? "danger" : "primary");

  const focusTarget = autoFocusButton ?? (destructive ? "cancel" : "cancel");

  const initialFocusRef =
    focusTarget === "confirm"
      ? confirmBtnRef
      : focusTarget === "close"
        ? closeBtnRef
        : cancelBtnRef;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const cardClassName = ["confirmModalCard", className].filter(Boolean).join(" ");

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleId="confirm-dialog-title"
      describedById="confirm-dialog-desc"
      closeButtonRef={closeBtnRef}
      initialFocusRef={initialFocusRef}
      closeLabel={closeLabel}
      className={cardClassName}
    >
      <div className="confirmModalContent">
        <p id="confirm-dialog-desc" className="modalDesc confirmModalMessage">
          {message}
        </p>
        <div className="confirmModalActions">
          <Button
            ref={cancelBtnRef}
            variant={cancelVariant}
            size="md"
            className="confirmModalCancelBtn"
            onClick={handleCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={resolvedConfirmVariant}
            size="md"
            className="confirmModalConfirmBtn"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
