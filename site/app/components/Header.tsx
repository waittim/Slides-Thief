import React from "react";
import { PDF_BASENAME_MAX_LENGTH, sanitizePdfBaseName } from "../filename";
import type { LocaleCopy, LocaleValue, RatioUiCopy } from "../i18n";
import type { Settings, ThemeValue } from "../lib/types";
import { OutputPageControls } from "./OutputPageControls";
import { PreferencesControls } from "./PreferencesControls";
import { SourceFormatControls, SourceOrientationControl } from "./SourceFormatControls";

interface HeaderProps {
  isInfoOpen: boolean;
  text: LocaleCopy;
  ratioUi: RatioUiCopy;
  settings: Settings;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsMenuRef: React.RefObject<HTMLDetailsElement | null>;
  moreSettingsRef: React.RefObject<HTMLDetailsElement | null>;
  isMobile: boolean;
  hasRun: boolean;
  pdfBaseName: string;
  setPdfBaseName: (name: string) => void;
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => void;
  locale: LocaleValue;
  setLocale: (locale: LocaleValue) => void;
  updateSettings: (updater: (current: Settings) => Settings) => void;
  runAutoWithSettings: (settings: Settings) => void;
  setIsInfoOpen: (open: boolean) => void;
}

export function Header({
  isInfoOpen,
  text,
  ratioUi,
  settings,
  settingsOpen,
  setSettingsOpen,
  settingsMenuRef,
  moreSettingsRef,
  isMobile,
  hasRun,
  pdfBaseName,
  setPdfBaseName,
  theme,
  setTheme,
  locale,
  setLocale,
  updateSettings,
  runAutoWithSettings,
  setIsInfoOpen,
}: HeaderProps) {
  return (
    <header className="topbar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
      <div className="brand">
        <div className="mark" aria-label={text.brandMark} role="img">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 10.5L24 8.5V21.5L8 23.5V10.5Z" fill="var(--logo-slide, #F5F7F2)" />
            <path d="M11 13.625L21 12.375V13.375L11 14.625Z" fill="var(--logo-lines, #64717A)" />
            <path d="M11 16.125L19 15.125V16.125L11 17.125Z" fill="var(--logo-lines, #64717A)" />
            <path d="M11 18.625L16 18.0V19.0L11 19.625Z" fill="var(--logo-lines, #64717A)" />
          </svg>
        </div>
        <h1 className="brandText">{text.brandName}</h1>
      </div>
      <div className="settings">
        <details
          className="settingsMenu"
          ref={settingsMenuRef}
          onToggle={(event) => {
            const isOpen = event.currentTarget.open;
            if (window.matchMedia("(max-width: 834px)").matches) {
              setSettingsOpen(isOpen);
            } else {
              event.currentTarget.open = true;
              setSettingsOpen(true);
            }
          }}
        >
          <summary className="settingsMenuToggle">{text.settings}</summary>
          {settingsOpen && (
            <div className="settingsMenuBody">
              <SourceFormatControls
                hasRun={hasRun}
                runAutoWithSettings={runAutoWithSettings}
                settings={settings}
                text={text}
                ratioUi={ratioUi}
                updateSettings={updateSettings}
              />
              <details
                className="moreSettings"
                ref={moreSettingsRef}
                open={isMobile ? true : undefined}
                onToggle={(event) => {
                  if (window.matchMedia("(max-width: 834px)").matches) {
                    event.currentTarget.open = true;
                  }
                }}
              >
                <summary>{text.more}</summary>
                <div className="morePanel">
                  <SourceOrientationControl
                    hasRun={hasRun}
                    ratioUi={ratioUi}
                    runAutoWithSettings={runAutoWithSettings}
                    settings={settings}
                    updateSettings={updateSettings}
                  />
                  <OutputPageControls
                    ratioUi={ratioUi}
                    settings={settings}
                    text={text}
                    updateSettings={updateSettings}
                  />
                </div>
              </details>
              <label className="pdfNameSetting">
                <span>{text.pdfName}</span>
                <input
                  value={pdfBaseName}
                  maxLength={PDF_BASENAME_MAX_LENGTH}
                  onChange={(event) => setPdfBaseName(sanitizePdfBaseName(event.target.value))}
                  type="text"
                />
                <span className="fileSuffix">.pdf</span>
              </label>
              <hr className="settingsMenuDivider" />
              <PreferencesControls
                placement="menu"
                text={text}
                theme={theme}
                setTheme={setTheme}
                locale={locale}
                setLocale={setLocale}
                setIsInfoOpen={setIsInfoOpen}
              />
            </div>
          )}
        </details>
      </div>
    </header>
  );
}
