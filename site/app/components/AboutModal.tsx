import React from "react";
import { ModalShell } from "./ui";

interface AboutModalProps {
  isInfoOpen: boolean;
  setIsInfoOpen: (open: boolean) => void;
  infoModalRef: React.RefObject<HTMLDivElement | null>;
  closeInfoButtonRef: React.RefObject<HTMLButtonElement | null>;
  text: Record<string, any>;
  appVersion: string;
}

export function AboutModal({
  isInfoOpen,
  setIsInfoOpen,
  infoModalRef,
  closeInfoButtonRef,
  text,
  appVersion,
}: AboutModalProps) {
  return (
    <ModalShell
      isOpen={isInfoOpen}
      onClose={() => setIsInfoOpen(false)}
      title={text.infoTitle}
      appVersion={appVersion}
      modalRef={infoModalRef}
      closeButtonRef={closeInfoButtonRef}
      closeLabel={text.close}
    >
      <p className="modalDesc">{text.infoDesc}</p>
      <p className="modalPrivacy">
        <strong>{text.infoPrivacy}</strong>
      </p>
      <div className="modalShortcuts">
        <h4>{text.shortcutsTitle}</h4>
        <div className="shortcutGrid">
          <div className="shortcutItem">
            <kbd>J</kbd> / <kbd>K</kbd> <span>{text.shortcutNav}</span>
          </div>
          <div className="shortcutItem">
            <kbd>Delete</kbd> <span>{text.shortcutDelete}</span>
          </div>
          <div className="shortcutItem">
            <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> <span>{text.shortcutUndo}</span>
          </div>
          <div className="shortcutItem">
            <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> <span>{text.shortcutRedo}</span>
          </div>
          <div className="shortcutItem">
            <kbd>⌘↵</kbd> / <kbd>Ctrl+Enter</kbd> <span>{text.shortcutExport}</span>
          </div>
          <div className="shortcutItem">
            <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> <span>{text.shortcutNudge}</span>
          </div>
        </div>
      </div>
      <div className="modalLinks">
        <a href="https://github.com/waittim/Slides-Thief" target="_blank" rel="noopener noreferrer" className="modalLink">
          {text.infoRepo}
        </a>
        <a href="https://www.zekun.blog/2026/07/13/slides-thief/" target="_blank" rel="noopener noreferrer" className="modalLink">
          {text.infoBlog}
        </a>
      </div>
    </ModalShell>
  );
}

