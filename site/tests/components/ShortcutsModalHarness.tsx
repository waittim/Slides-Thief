import React, { useRef, useState } from "react";
import { copy, type LocaleValue } from "../../app/i18n";
import { ShortcutsModal } from "../../app/components/ShortcutsModal";

export function ShortcutsModalHarness({ locale = "zh-CN" }: { locale?: LocaleValue }) {
  const [isOpen, setIsOpen] = useState(true);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div>
      <div data-testid="modal-open-status">{isOpen ? "open" : "closed"}</div>
      <ShortcutsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        shortcutsModalRef={modalRef}
        closeShortcutsButtonRef={closeButtonRef}
        text={copy[locale]}
      />
    </div>
  );
}
