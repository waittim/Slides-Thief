import React, { useState } from "react";
import { copy, type LocaleValue } from "../../app/i18n";
import type { ThemeValue } from "../../app/lib/types";
import { PreferencesControls } from "../../app/components/PreferencesControls";

interface PreferencesControlsHarnessProps {
  placement?: "bar" | "menu" | "footer";
  initialTheme?: ThemeValue;
  initialLocale?: LocaleValue;
}

export function PreferencesControlsHarness({
  placement = "bar",
  initialTheme = "auto",
  initialLocale = "zh-CN",
}: PreferencesControlsHarnessProps) {
  const [theme, setTheme] = useState<ThemeValue>(initialTheme);
  const [locale, setLocale] = useState<LocaleValue>(initialLocale);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const text = copy[locale];

  return (
    <div data-testid="harness-container">
      {placement === "bar" ? (
        <nav className="prefsBar" aria-label={text.preferences}>
          <PreferencesControls
            placement={placement}
            text={text}
            theme={theme}
            setTheme={setTheme}
            locale={locale}
            setLocale={setLocale}
            setIsInfoOpen={setIsInfoOpen}
          />
        </nav>
      ) : (
        <details className="settingsMenu" open>
          <div className="settingsMenuBody">
            <PreferencesControls
              placement={placement}
              text={text}
              theme={theme}
              setTheme={setTheme}
              locale={locale}
              setLocale={setLocale}
              setIsInfoOpen={setIsInfoOpen}
            />
          </div>
        </details>
      )}
      <div data-testid="info-status">{isInfoOpen ? "open" : "closed"}</div>
      <div data-testid="theme-status">{theme}</div>
      <div data-testid="locale-status">{locale}</div>
    </div>
  );
}
