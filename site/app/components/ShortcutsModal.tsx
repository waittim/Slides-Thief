import React from "react";
import type { LocaleCopy } from "../i18n";
import { ModalShell } from "./ui";

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcutsModalRef?: React.RefObject<HTMLDivElement | null>;
  closeShortcutsButtonRef?: React.RefObject<HTMLButtonElement | null>;
  text: LocaleCopy;
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

export function ShortcutsModal({
  isOpen,
  onClose,
  shortcutsModalRef,
  closeShortcutsButtonRef,
  text,
}: ShortcutsModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={text.shortcutsTitle}
      modalRef={shortcutsModalRef}
      closeButtonRef={closeShortcutsButtonRef}
      closeLabel={text.close}
      titleId="shortcuts-modal-title"
      className="shortcutsModal"
    >
      <div className="modalShortcuts">
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
            <ShortcutChord keys={["Alt", "↑"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["Alt", "↓"]} />
            <span>{text.shortcutReorder}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["Delete"]} />
            <span className="shortcutSep" aria-hidden="true">
              /
            </span>
            <ShortcutChord keys={["Backspace"]} />
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
          <div className="shortcutItem">
            <ShortcutChord keys={["Esc"]} />
            <span>{text.shortcutCloseOrExit}</span>
          </div>
          <div className="shortcutItem">
            <ShortcutChord keys={["?"]} />
            <span>{text.shortcutHelp}</span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
