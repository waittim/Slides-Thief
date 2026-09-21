import React from "react";
import { localeOptions, type LocaleCopy, type LocaleValue } from "../i18n";
import type { ThemeValue } from "../lib/types";
import { Button, Select } from "./ui";

export interface PreferencesControlsProps {
  infoButtonRef?: React.RefObject<HTMLButtonElement | null>;
  placement: "menu" | "footer";
  text: LocaleCopy;
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => void;
  locale: LocaleValue;
  setLocale: (locale: LocaleValue) => void;
  setIsInfoOpen: (open: boolean) => void;
}

export function PreferencesControls({
  infoButtonRef,
  placement,
  text,
  theme,
  setTheme,
  locale,
  setLocale,
  setIsInfoOpen,
}: PreferencesControlsProps) {
  const isMenu = placement === "menu";

  return (
    <>
      {!isMenu && (
        <span className="privacyBadge" title={text.infoPrivacy}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>{text.noUpload}</span>
        </span>
      )}
      <Button
        ref={infoButtonRef}
        type="button"
        variant={isMenu ? "secondary" : "icon"}
        className={`infoButton${isMenu ? " settingsMenuInfoRow settingsMenuInfo" : ""}`}
        title={text.infoTitle}
        aria-label={text.infoTitle}
        onClick={() => setIsInfoOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="infoButtonLabel">{text.infoTitle}</span>
      </Button>
      <label className={`themeSetting${isMenu ? " settingsMenuTheme" : ""}`}>
        <span>{text.theme}</span>
        <Select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
          <option value="auto">{text.auto}</option>
          <option value="light">{text.light}</option>
          <option value="dark">{text.dark}</option>
        </Select>
      </label>
      <label className={`languageSetting${isMenu ? " settingsMenuLanguage" : ""}`}>
        <span>{text.language}</span>
        <Select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
    </>
  );
}
