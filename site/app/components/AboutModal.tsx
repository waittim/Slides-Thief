import React, { useState } from "react";
import type { LocaleCopy, LocaleValue } from "../i18n";
import { PRODUCT_METADATA } from "../product-metadata";
import { PrivacyNoticeContent } from "./PrivacyNoticeContent";
import { Icon, ModalShell, Switch } from "./ui";

interface AboutModalProps {
  isInfoOpen: boolean;
  setIsInfoOpen: (open: boolean) => void;
  infoModalRef: React.RefObject<HTMLDivElement | null>;
  closeInfoButtonRef: React.RefObject<HTMLButtonElement | null>;
  text: LocaleCopy;
  appVersion: string;
  locale?: LocaleValue;
  telemetryEnabled?: boolean;
  telemetryReady?: boolean;
  telemetryCheckingLabel?: string;
  googlePolicyLabel?: string;
  privacyNoticeLabel?: string;
  privacyContactLabel?: string;
  backToAboutLabel?: string;
  openExternalLabel?: string;
  privacyNoticeUpdatedLabel?: string;
  setTelemetryEnabled?: (enabled: boolean) => void;
  expandTelemetryOnOpen?: boolean;
  telemetryDisclosureButtonRef?: React.RefObject<HTMLButtonElement | null>;
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

function TelemetryDisclosure({
  text,
  telemetryEnabled = true,
  telemetryReady = true,
  telemetryCheckingLabel,
  googlePolicyLabel,
  privacyNoticeLabel,
  privacyContactLabel,
  setTelemetryEnabled,
  initiallyOpen,
  buttonRef,
  onOpenPrivacyNotice,
}: Pick<
  AboutModalProps,
  | "text"
  | "telemetryEnabled"
  | "telemetryReady"
  | "telemetryCheckingLabel"
  | "googlePolicyLabel"
  | "privacyNoticeLabel"
  | "privacyContactLabel"
  | "setTelemetryEnabled"
> & {
  initiallyOpen: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onOpenPrivacyNotice?: () => void;
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);

  return (
    <div className="modalTelemetry">
      <div className="modalTelemetryHeader">
        <button
          ref={buttonRef}
          type="button"
          className="modalTelemetryDisclosure"
          aria-expanded={expanded}
          aria-controls="about-telemetry-content"
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="modalTelemetryTitle">{text.telemetryTitle}</span>
          <Icon name={expanded ? "chevron.up" : "chevron.down"} size={15} aria-hidden="true" />
        </button>
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
      <div id="about-telemetry-content" className="modalTelemetryContent" hidden={!expanded}>
        <p className="modalTelemetryDesc">{text.telemetryDesc}</p>
        <div className="modalTelemetryLinks">
          {googlePolicyLabel && (
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="modalTelemetryPolicyLink">
              {googlePolicyLabel}
            </a>
          )}
          {privacyNoticeLabel && (
            <button
              type="button"
              className="modalTelemetryPolicyLink modalTelemetryActionBtn"
              onClick={onOpenPrivacyNotice}
            >
              {privacyNoticeLabel}
            </button>
          )}
          {privacyContactLabel && (
            <a href="https://www.zekun.blog/about/" target="_blank" rel="noopener noreferrer" className="modalTelemetryPolicyLink">
              {privacyContactLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function AboutModal({
  isInfoOpen,
  setIsInfoOpen,
  infoModalRef,
  closeInfoButtonRef,
  text,
  appVersion,
  locale,
  telemetryEnabled = true,
  telemetryReady = true,
  telemetryCheckingLabel,
  googlePolicyLabel,
  privacyNoticeLabel,
  privacyContactLabel,
  backToAboutLabel,
  openExternalLabel,
  privacyNoticeUpdatedLabel,
  setTelemetryEnabled,
  expandTelemetryOnOpen = false,
  telemetryDisclosureButtonRef,
}: AboutModalProps) {
  const [activeView, setActiveView] = useState<"about" | "privacy">("about");
  const [prevIsOpen, setPrevIsOpen] = useState(isInfoOpen);

  if (prevIsOpen !== isInfoOpen) {
    setPrevIsOpen(isInfoOpen);
    if (!isInfoOpen || expandTelemetryOnOpen) {
      setActiveView("about");
    }
  }

  const handleClose = () => {
    setActiveView("about");
    setIsInfoOpen(false);
  };

  const isPrivacyView = activeView === "privacy";

  return (
    <ModalShell
      isOpen={isInfoOpen}
      onClose={handleClose}
      title={isPrivacyView ? (privacyNoticeLabel ?? "Privacy notice") : text.infoTitle}
      appVersion={isPrivacyView ? undefined : appVersion}
      modalRef={infoModalRef}
      closeButtonRef={closeInfoButtonRef}
      closeLabel={text.close}
      className={isPrivacyView ? "modalCard--privacy" : undefined}
      onBack={isPrivacyView ? () => setActiveView("about") : undefined}
      backLabel={backToAboutLabel ?? "Back to About"}
      headerAction={
        isPrivacyView ? (
          <a
            href="./privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="modalHeaderExternalLink"
            title={openExternalLabel ?? "Open in new window"}
          >
            <span>{openExternalLabel ?? "Open in new window"}</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : undefined
      }
    >
      {isPrivacyView ? (
        <PrivacyNoticeContent
          locale={locale}
          updatedLabel={privacyNoticeUpdatedLabel}
          openExternalLabel={openExternalLabel}
          standaloneUrl="./privacy.html"
          googlePolicyUrl="https://policies.google.com/privacy"
          authorAboutUrl="https://www.zekun.blog/about/"
        />
      ) : (
        <>
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
            <TelemetryDisclosure
              text={text}
              telemetryEnabled={telemetryEnabled}
              telemetryReady={telemetryReady}
              telemetryCheckingLabel={telemetryCheckingLabel}
              googlePolicyLabel={googlePolicyLabel}
              privacyNoticeLabel={privacyNoticeLabel}
              privacyContactLabel={privacyContactLabel}
              setTelemetryEnabled={setTelemetryEnabled}
              initiallyOpen={expandTelemetryOnOpen}
              buttonRef={telemetryDisclosureButtonRef}
              onOpenPrivacyNotice={() => setActiveView("privacy")}
            />
          </div>
          <div className="modalLinks">
            <a href={PRODUCT_METADATA.repository} target="_blank" rel="noopener noreferrer" className="modalLink">
              {text.infoRepo}
            </a>
            <a href={PRODUCT_METADATA.blog} target="_blank" rel="noopener noreferrer" className="modalLink">
              {text.infoBlog}
            </a>
          </div>
        </>
      )}
    </ModalShell>
  );
}
