import React from "react";
import type { EnhancementMode } from "../enhance";
import { PDF_BASENAME_MAX_LENGTH, sanitizePdfBaseName } from "../filename";
import { localeOptions, type LocaleValue } from "../i18n";
import {
  defaultOrientationForBaseFormat,
  deriveSourceFormat,
  isPaperRatio,
  outputPageRatioValue,
  sourceFormatRatioValue,
  splitSourceFormat,
  type BaseFormat,
  type OutputPageRatio,
  type PageLayoutMode,
} from "../ratio";
import type { Settings, SlideItem, ThemeValue } from "../lib/types";

interface HeaderProps {
  isInfoOpen: boolean;
  text: Record<string, any>;
  ratioUi: Record<string, any>;
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
  selectedSlide: SlideItem | null;
  setIsInfoOpen: (open: boolean) => void;
  currentPageLayout: PageLayoutMode;
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
  selectedSlide,
  setIsInfoOpen,
  currentPageLayout,
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
              {(() => {
                const { baseFormat: currentBaseFormat } = splitSourceFormat(settings.sourceFormat);
                return (
                  <label className="ratioSetting">
                    <span>{ratioUi.sourceFormat}</span>
                    <select
                      value={currentBaseFormat}
                      onChange={(event) => {
                        const nextBaseFormat = event.target.value as BaseFormat;
                        const defaultOrient = defaultOrientationForBaseFormat(nextBaseFormat);
                        const sourceFormat = deriveSourceFormat(nextBaseFormat, defaultOrient);
                        const nextSettings: Settings = {
                          ...settings,
                          sourceFormat,
                        };
                        updateSettings(() => nextSettings);
                        if (hasRun) {
                          runAutoWithSettings(nextSettings);
                        }
                      }}
                    >
                      <optgroup label={ratioUi.presentationGroup}>
                        <option value="16:9">{text.ratio16x9}</option>
                        <option value="4:3">{text.ratio4x3}</option>
                        <option value="16:10">16:10</option>
                      </optgroup>
                      <optgroup label={ratioUi.documentGroup}>
                        <option value="A4">A4</option>
                        <option value="letter">Letter</option>
                      </optgroup>
                      <option value="custom">{ratioUi.custom}</option>
                    </select>
                  </label>
                );
              })()}
              {settings.sourceFormat === "custom" && (
                <label className="sourceCustomSetting">
                  <span>{ratioUi.customRatio}</span>
                  <input
                    type="number"
                    min={0.2}
                    max={5}
                    step={0.01}
                    value={settings.sourceCustomRatio ?? 16 / 9}
                    onChange={(event) => {
                      const sourceCustomRatio = Math.max(0.2, Math.min(5, Number(event.target.value) || 16 / 9));
                      const nextSettings = { ...settings, sourceCustomRatio };
                      updateSettings(() => nextSettings);
                      if (hasRun) runAutoWithSettings(nextSettings);
                    }}
                  />
                </label>
              )}
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
                  {(() => {
                    const { baseFormat: currentBaseFormat, orientation: currentOrientation } = splitSourceFormat(settings.sourceFormat);
                    const isPortrait = currentOrientation === "portrait";
                    return (
                      <label className="orientationSetting">
                        <span>{ratioUi.orientation}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPortrait}
                          aria-label={ratioUi.orientation}
                          className={`switchToggle ${isPortrait ? "checked" : ""}`}
                          onClick={() => {
                            const nextOrientation = isPortrait ? "landscape" : "portrait";
                            const nextFormat = deriveSourceFormat(currentBaseFormat, nextOrientation);
                            const nextSettings: Settings = { ...settings, sourceFormat: nextFormat };
                            updateSettings(() => nextSettings);
                            if (hasRun) runAutoWithSettings(nextSettings);
                          }}
                        >
                          <span className="switchTrack">
                            <span className="switchThumb" />
                          </span>
                          <span className="switchLabel">
                            {isPortrait ? ratioUi.portrait : ratioUi.landscape}
                          </span>
                        </button>
                      </label>
                    );
                  })()}
                  <label>
                    <span>{ratioUi.pageLayout}</span>
                    <select
                      value={currentPageLayout}
                      onChange={(event) => {
                        const nextLayout = event.target.value as PageLayoutMode;
                        updateSettings((current) => {
                          if (nextLayout === "paper") {
                            const sourceRatio = sourceFormatRatioValue(
                              current.sourceFormat,
                              current.sourceCustomRatio,
                              selectedSlide?.sourceRatio,
                            );
                            const outputPageRatio = isPaperRatio(current.outputPageRatio)
                              ? current.outputPageRatio
                              : sourceRatio >= 1
                                ? "A4-landscape"
                                : "A4-portrait";
                            return {
                              ...current,
                              outputPageRatio,
                              height: null,
                            };
                          }
                          if (nextLayout === "custom-size") {
                            const sourceRatio = sourceFormatRatioValue(
                              current.sourceFormat,
                              current.sourceCustomRatio,
                              selectedSlide?.sourceRatio,
                            );
                            const ratio = outputPageRatioValue(current.outputPageRatio, sourceRatio);
                            return {
                              ...current,
                              outputPageRatio: "match-source",
                              height: Math.max(600, Math.min(6000, Math.round(current.width / ratio))),
                            };
                          }
                          return {
                            ...current,
                            outputPageRatio: "match-source",
                            height: null,
                          };
                        });
                      }}
                    >
                      <option value="match-source">{ratioUi.matchSource}</option>
                      <option value="paper">{ratioUi.standardPaper}</option>
                      <option value="custom-size">{ratioUi.customPage}</option>
                    </select>
                  </label>
                  {currentPageLayout === "paper" && (
                    <label>
                      <span>{ratioUi.paperFormat}</span>
                      <select
                        value={settings.outputPageRatio}
                        onChange={(event) => {
                          const outputPageRatio = event.target.value as OutputPageRatio;
                          updateSettings((current) => ({
                            ...current,
                            outputPageRatio,
                            height: null,
                          }));
                        }}
                      >
                        <option value="A4-landscape">{text.ratioA4Landscape}</option>
                        <option value="A4-portrait">{text.ratioA4Portrait}</option>
                        <option value="letter-landscape">{text.ratioLetterLandscape}</option>
                        <option value="letter-portrait">{text.ratioLetterPortrait}</option>
                      </select>
                    </label>
                  )}
                  <label>
                    <span>{text.width}</span>
                    <input
                      type="number"
                      min={800}
                      max={6000}
                      value={settings.width}
                      onChange={(event) =>
                        updateSettings((current) => ({
                          ...current,
                          width: Math.max(800, Math.min(6000, Number(event.target.value) || current.width)),
                        }))
                      }
                    />
                  </label>
                  {currentPageLayout === "custom-size" && (
                    <label>
                      <span>{text.height}</span>
                      <input
                        type="number"
                        min={600}
                        max={6000}
                        value={settings.height ?? 1350}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            height: Math.max(600, Math.min(6000, Number(event.target.value) || 600)),
                          }))
                        }
                      />
                    </label>
                  )}
                  <label>
                    <span>{text.quality}</span>
                    <input
                      type="number"
                      min={60}
                      max={98}
                      value={Math.round(settings.quality * 100)}
                      onChange={(event) =>
                        updateSettings((current) => ({
                          ...current,
                          quality: Math.max(60, Math.min(98, Number(event.target.value) || 92)) / 100,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>{text.enhancement}</span>
                    <select
                      value={settings.enhancement}
                      onChange={(event) =>
                        updateSettings((current) => ({
                          ...current,
                          enhancement: event.target.value as EnhancementMode,
                        }))
                      }
                    >
                      <option value="original">{text.enhancementOriginal}</option>
                      <option value="clean">{text.enhancementClean}</option>
                      <option value="high-contrast">{text.enhancementHighContrast}</option>
                      <option value="bw">{text.enhancementBw}</option>
                    </select>
                  </label>
                  <div
                    className="colorSetting"
                    role="group"
                    aria-labelledby="fill-color-label"
                  >
                    <span id="fill-color-label">{text.fillColor}</span>
                    <div className="colorControls">
                      <button
                        type="button"
                        aria-pressed={settings.fillColor === "auto"}
                        onClick={() => updateSettings((current) => ({ ...current, fillColor: "auto" }))}
                      >
                        {text.auto}
                      </button>
                      <input
                        type="color"
                        className={settings.fillColor === "auto" ? undefined : "isActive"}
                        aria-label={text.fillColor}
                        value={settings.fillColor === "auto" ? "#FFFFFF" : settings.fillColor}
                        onChange={(event) => updateSettings((current) => ({ ...current, fillColor: event.target.value }))}
                      />
                    </div>
                  </div>
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
              <label className="themeSetting settingsMenuTheme">
                <span>{text.theme}</span>
                <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
                  <option value="auto">{text.auto}</option>
                  <option value="light">{text.light}</option>
                  <option value="dark">{text.dark}</option>
                </select>
              </label>
              <label className="languageSetting settingsMenuLanguage">
                <span>{text.language}</span>
                <select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
                  {localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="settingsMenuInfoRow settingsMenuInfo"
                onClick={() => setIsInfoOpen(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>{text.infoTitle}</span>
              </button>
            </div>
          )}
        </details>
      </div>
    </header>
  );
}
