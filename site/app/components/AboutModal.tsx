import React from "react";
import type { LocaleCopy } from "../i18n";
import { PRODUCT_METADATA } from "../product-metadata";
import { ModalShell, Switch } from "./ui";

interface AboutModalProps {
  isInfoOpen: boolean;
  setIsInfoOpen: (open: boolean) => void;
  infoModalRef: React.RefObject<HTMLDivElement | null>;
  closeInfoButtonRef: React.RefObject<HTMLButtonElement | null>;
  text: LocaleCopy;
  appVersion: string;
  telemetryEnabled?: boolean;
  telemetryReady?: boolean;
  telemetryCheckingLabel?: string;
  googlePolicyLabel?: string;
  privacyNoticeLabel?: string;
  privacyContactLabel?: string;
  setTelemetryEnabled?: (enabled: boolean) => void;
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
  telemetryEnabled = true,
  telemetryReady = true,
  telemetryCheckingLabel,
  googlePolicyLabel,
  privacyNoticeLabel,
  privacyContactLabel,
  setTelemetryEnabled,
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
      <div className="modalPrivacy modalPrivacyCard">
        <p className="modalPrivacyText">
          <strong>{text.infoPrivacy}</strong>
        </p>
        <div className="modalTelemetry">
          <div className="modalTelemetryHeader">
            <div className="modalTelemetryHeaderContent">
              <span className="modalTelemetryTitle">{text.telemetryTitle}</span>
              <p className="modalTelemetryDesc">{text.telemetryDesc}</p>
            </div>
            {setTelemetryEnabled && (
              <Switch
                aria-label={text.telemetryTitle}
                checked={telemetryEnabled}
                disabled={!telemetryReady}
                label={telemetryReady ? (telemetryEnabled ? text.telemetryEnabled : text.telemetryDisabled) : (telemetryCheckingLabel ?? text.telemetryDisabled)}
                onChange={setTelemetryEnabled}
              />
            )}
          </div>
          <div className="modalTelemetryLinks">
            {googlePolicyLabel && (
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="modalTelemetryPolicyLink">
                {googlePolicyLabel}
              </a>
            )}
            {privacyNoticeLabel && (
              <a href="https://slidesthief.com/privacy.html" target="_blank" rel="noopener noreferrer" className="modalTelemetryPolicyLink">
                {privacyNoticeLabel}
              </a>
            )}
            {privacyContactLabel && (
              <a href="https://www.zekun.blog/about/" target="_blank" rel="noopener noreferrer" className="modalTelemetryPolicyLink">
                {privacyContactLabel}
              </a>
            )}
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
