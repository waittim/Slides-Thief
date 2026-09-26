import React, { useRef, useState } from "react";
import { Header } from "../../app/components/Header";
import { copy, ratioUiCopy, type LocaleValue } from "../../app/i18n";
import { defaultSettings, type Settings, type ThemeValue } from "../../app/lib/types";

export interface HeaderHarnessProps {
  initialPdfBaseName?: string;
  initialLocale?: LocaleValue;
  initialTheme?: ThemeValue;
  isMobile?: boolean;
}

export function HeaderHarness({
  initialPdfBaseName = "flattened_slides",
  initialLocale = "zh-CN",
  initialTheme = "auto",
  isMobile = false,
}: HeaderHarnessProps) {
  const [pdfBaseName, setPdfBaseName] = useState(initialPdfBaseName);
  const [locale, setLocale] = useState<LocaleValue>(initialLocale);
  const [theme, setTheme] = useState<ThemeValue>(initialTheme);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const settingsMenuRef = useRef<HTMLDetailsElement>(null);
  const moreSettingsRef = useRef<HTMLDetailsElement>(null);

  const text = copy[locale];
  const ratioUi = ratioUiCopy[locale];

  return (
    <div className="app" data-testid="header-harness">
      <Header
        isInfoOpen={isInfoOpen}
        text={text}
        ratioUi={ratioUi}
        settings={settings}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsMenuRef={settingsMenuRef}
        moreSettingsRef={moreSettingsRef}
        isMobile={isMobile}
        hasRun={false}
        pdfBaseName={pdfBaseName}
        setPdfBaseName={setPdfBaseName}
        theme={theme}
        setTheme={setTheme}
        locale={locale}
        setLocale={setLocale}
        updateSettings={(updater) => setSettings(updater)}
        runAutoWithSettings={() => {}}
        setIsInfoOpen={setIsInfoOpen}
      />
      <div data-testid="current-pdf-base-name">{pdfBaseName}</div>
      <button type="button" data-testid="outside-button">
        Outside
      </button>
    </div>
  );
}
