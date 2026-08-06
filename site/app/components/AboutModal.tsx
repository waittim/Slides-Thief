import React from "react";

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
  if (!isInfoOpen) return null;

  return (
    <div className="modalOverlay" onClick={() => setIsInfoOpen(false)}>
      <div
        ref={infoModalRef}
        className="modalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitle">
            <h3 id="info-modal-title">{text.infoTitle}</h3>
            <span className="modalVersion">v{appVersion}</span>
          </div>
          <button
            ref={closeInfoButtonRef}
            className="closeButton"
            type="button"
            onClick={() => setIsInfoOpen(false)}
            aria-label={text.close}
          >
            &times;
          </button>
        </div>
        <div className="modalBody">
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
        </div>
      </div>
    </div>
  );
}
