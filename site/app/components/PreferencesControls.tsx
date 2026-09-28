import React from "react";
import { localeOptions, type LocaleCopy, type LocaleValue } from "../i18n";
import type { ThemeValue } from "../lib/types";
import { Button, Icon, Select } from "./ui";

export interface PreferencesControlsProps {
  infoButtonRef?: React.RefObject<HTMLButtonElement | null>;
  placement?: "bar" | "menu" | "footer";
  text: LocaleCopy;
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => void;
  locale: LocaleValue;
  setLocale: (locale: LocaleValue) => void;
  setIsInfoOpen: (open: boolean) => void;
}

export function PreferencesControls({
  infoButtonRef,
  placement = "bar",
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
      <Button
        ref={infoButtonRef}
        type="button"
        variant={isMenu ? "secondary" : "icon"}
        className={`infoButton${isMenu ? " settingsMenuInfoRow settingsMenuInfo" : ""}`}
        title={`${text.infoTitle} (?)`}
        aria-label={text.infoTitle}
        onClick={() => setIsInfoOpen(true)}
      >
        <Icon name="info.circle" size={18} />
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
