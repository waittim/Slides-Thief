import React from "react";
import type { LocaleCopy } from "../i18n";
import { PRODUCT_METADATA } from "../product-metadata";
import { ModalShell } from "./ui";

interface AboutModalProps {
  isInfoOpen: boolean;
  setIsInfoOpen: (open: boolean) => void;
  infoModalRef: React.RefObject<HTMLDivElement | null>;
  closeInfoButtonRef: React.RefObject<HTMLButtonElement | null>;
  text: LocaleCopy;
  appVersion: string;
}

function ShortcutChord({ keys }: { keys: readonly string[] }) {
  return (
    <span className="shortcutChord">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`}>{key}</kbd>
      ))}
    </span>
  );
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
            <ShortcutChord keys={["J"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["K"]} />
            <span>{text.shortcutNav}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["Delete"]} />
            <span>{text.shortcutDelete}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["⌘", "Z"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["Ctrl", "Z"]} />
            <span>{text.shortcutUndo}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["⌘", "⇧", "Z"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["Ctrl", "Shift", "Z"]} />
            <span>{text.shortcutRedo}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["⌘", "↵"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["Ctrl", "Enter"]} />
            <span>{text.shortcutExport}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["↑", "↓", "←", "→"]} />
            <span>{text.shortcutNudge}</span>
          </div>
        </div>
      </div>
      <div className="modalLinks">
        <a href={PRODUCT_METADATA.repository} target="_blank" rel="noopener noreferrer" className="modalLink">
          {text.infoRepo}
        </a>
        <a href={PRODUCT_METADATA.blog} target="_blank" rel="noopener noreferrer" className="modalLink">
          {text.infoBlog}
        </a>
      </div>
    </ModalShell>
  );
}
