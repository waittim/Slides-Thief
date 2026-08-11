import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LocaleValue } from "../i18n";
import { copy, detectBrowserLocale } from "../i18n";
import { defaultSettings, type Settings, type ThemeValue } from "../lib/types";

const MOBILE_BREAKPOINT = "(max-width: 834px)";

export function usePreferences(clearExport: () => void) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [pdfBaseName, setPdfBaseName] = useState("flattened_slides");
  const [theme, setTheme] = useState<ThemeValue>("auto");
  const [locale, setLocale] = useState<LocaleValue>("en");

  const localeRef = useRef<LocaleValue>("en");
  const settingsRef = useRef<Settings>(defaultSettings);
  const settingsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const moreSettingsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      clearExport();
      setSettings(updater);
    },
    [clearExport],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const localizedText = copy[locale];
    document.documentElement.lang = locale;
    document.title = localizedText.appTitle;
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const browserLocale = detectBrowserLocale();
      setLocale((current) => (current === browserLocale ? current : browserLocale));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useLayoutEffect(() => {
    const settingsMenu = settingsMenuRef.current;
    const moreSettings = moreSettingsRef.current;
    if (!settingsMenu) return;

    const media = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => {
      const matches = media.matches;
      setIsMobile(matches);
      if (matches) {
        settingsMenu.open = false;
        setSettingsOpen(false);
        if (moreSettings) moreSettings.open = true;
        setInspectorCollapsed(true);
      } else {
        settingsMenu.open = true;
        setSettingsOpen(true);
        setInspectorCollapsed(false);
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (window.matchMedia(MOBILE_BREAKPOINT).matches) {
        const settingsMenu = settingsMenuRef.current;
        if (settingsMenu && !settingsMenu.contains(target) && settingsMenu.open) {
          settingsMenu.open = false;
          setSettingsOpen(false);
        }
        return;
      }

      const moreSettings = moreSettingsRef.current;
      if (moreSettings && !moreSettings.contains(target) && moreSettings.open) {
        moreSettings.open = false;
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const confirmClearText = useCallback(
    (count: number) => copy[localeRef.current].clearAllConfirm(count),
    [],
  );

  return {
    settings,
    setSettings,
    settingsRef,
    settingsOpen,
    setSettingsOpen,
    isMobile,
    inspectorCollapsed,
    setInspectorCollapsed,
    pdfBaseName,
    setPdfBaseName,
    theme,
    setTheme,
    locale,
    setLocale,
    localeRef,
    settingsMenuRef,
    moreSettingsRef,
    updateSettings,
    confirmClearText,
  };
}
