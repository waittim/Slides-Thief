import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LocaleValue } from "../i18n";
import { copy, detectBrowserLocale } from "../i18n";
import {
  ANALYTICS_CONSENT_VERSION,
  hasAnalyticsChoice,
  isAnalyticsConsentExpired,
  loadStoredPreferences,
  saveStoredPreferences,
  shouldEnableTelemetry,
  type AnalyticsConsent,
  type StoredPreferences,
} from "../lib/preferenceStorage";
import { requiresAnalyticsConsent } from "../lib/analyticsPolicy";
import { setTelemetryOptOut } from "../lib/telemetry";
import { defaultSettings, type Settings, type ThemeValue } from "../lib/types";

const MOBILE_BREAKPOINT = "(max-width: 834px)";

export function usePreferences(markExportStale: () => void) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [pdfBaseName, setPdfBaseName] = useState("flattened_slides");
  const [theme, setTheme] = useState<ThemeValue>("auto");
  const [locale, setLocale] = useState<LocaleValue>("en");
  const [telemetry, setTelemetryState] = useState(false);
  const [showAnalyticsChoice, setShowAnalyticsChoice] = useState(false);
  const [analyticsPolicyReady, setAnalyticsPolicyReady] = useState(false);

  const localeRef = useRef<LocaleValue>("en");
  const explicitLocaleRef = useRef<LocaleValue | null>(null);
  const themeRef = useRef<ThemeValue>("auto");
  const pdfBaseNameRef = useRef("flattened_slides");
  const telemetryRef = useRef<boolean>(false);
  const analyticsConsentRef = useRef<AnalyticsConsent | null>(null);
  const storedPreferencesRef = useRef<StoredPreferences | null>(null);
  const preferencesLoadedRef = useRef(false);
  const consentRequiredRef = useRef<boolean | null>(null);
  const telemetryTouchedRef = useRef(false);
  const settingsRef = useRef<Settings>(defaultSettings);
  const settingsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const moreSettingsRef = useRef<HTMLDetailsElement | null>(null);
  const initialMountRef = useRef(true);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    pdfBaseNameRef.current = pdfBaseName;
  }, [pdfBaseName]);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  const savePreferences = useCallback((overrides?: Partial<StoredPreferences>) => {
    saveStoredPreferences({
      version: 3,
      theme: overrides?.theme ?? themeRef.current,
      explicitLocale:
        overrides?.explicitLocale !== undefined
          ? overrides.explicitLocale
          : explicitLocaleRef.current,
      settings: overrides?.settings ?? settingsRef.current,
      pdfBaseName: overrides?.pdfBaseName ?? pdfBaseNameRef.current,
      telemetry: overrides?.telemetry ?? storedPreferencesRef.current?.telemetry,
      analyticsConsent: overrides?.analyticsConsent ?? analyticsConsentRef.current ?? undefined,
    });
  }, []);

  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      markExportStale();
      setSettings((current) => {
        const next = updater(current);
        settingsRef.current = next;
        savePreferences({ settings: next });
        return next;
      });
    },
    [markExportStale, savePreferences],
  );

  const updateTheme = useCallback(
    (newTheme: ThemeValue) => {
      themeRef.current = newTheme;
      setTheme(newTheme);
      savePreferences({ theme: newTheme });
    },
    [savePreferences],
  );

  const setUserLocale = useCallback(
    (newLocale: LocaleValue) => {
      explicitLocaleRef.current = newLocale;
      localeRef.current = newLocale;
      setLocale(newLocale);
      savePreferences({ explicitLocale: newLocale });
    },
    [savePreferences],
  );

  const updatePdfBaseName = useCallback(
    (name: string) => {
      pdfBaseNameRef.current = name;
      setPdfBaseName(name);
      savePreferences({ pdfBaseName: name });
    },
    [savePreferences],
  );

  const updateTelemetry = useCallback(
    (enabled: boolean) => {
      telemetryTouchedRef.current = true;
      const consent: AnalyticsConsent = {
        version: ANALYTICS_CONSENT_VERSION,
        granted: enabled,
        decidedAt: new Date().toISOString(),
      };
      analyticsConsentRef.current = consent;
      storedPreferencesRef.current = { ...storedPreferencesRef.current, telemetry: enabled, analyticsConsent: consent };
      telemetryRef.current = enabled;
      setTelemetryState(enabled);
      setShowAnalyticsChoice(false);
      setTelemetryOptOut(!enabled);
      savePreferences({ telemetry: enabled, analyticsConsent: consent });
    },
    [savePreferences],
  );

  const syncTelemetry = useCallback(() => {
    if (!preferencesLoadedRef.current || consentRequiredRef.current === null) return;
    setAnalyticsPolicyReady(true);
    if (telemetryTouchedRef.current) return;
    const stored = storedPreferencesRef.current;
    const enabled = shouldEnableTelemetry(stored, consentRequiredRef.current);
    telemetryRef.current = enabled;
    setTelemetryState(enabled);
    const shouldPrompt = consentRequiredRef.current
      ? !hasAnalyticsChoice(stored)
      : Boolean(stored?.analyticsConsent && isAnalyticsConsentExpired(stored.analyticsConsent));
    setShowAnalyticsChoice(shouldPrompt);
    setTelemetryOptOut(!enabled);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      if (locale === "en" && typeof document !== "undefined" && document.documentElement.lang && document.documentElement.lang !== "en") {
        localeRef.current = locale;
        return;
      }
    }
    const localizedText = copy[locale];
    document.documentElement.lang = locale;
    document.title = localizedText.appTitle;
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = loadStoredPreferences();
      storedPreferencesRef.current = stored;
      analyticsConsentRef.current = stored?.analyticsConsent ?? null;
      preferencesLoadedRef.current = true;
      syncTelemetry();
      if (stored) {
        if (stored.theme) {
          themeRef.current = stored.theme;
          setTheme(stored.theme);
        }
        if (stored.settings) {
          settingsRef.current = stored.settings as Settings;
          setSettings(stored.settings as Settings);
        }
        if (typeof stored.pdfBaseName === "string") {
          pdfBaseNameRef.current = stored.pdfBaseName;
          setPdfBaseName(stored.pdfBaseName);
        }
        if (stored.explicitLocale) {
          const explicit = stored.explicitLocale;
          explicitLocaleRef.current = explicit;
          localeRef.current = explicit;
          setLocale((current) => {
            if (current === explicit) {
              if (typeof document !== "undefined") {
                document.documentElement.lang = explicit;
                document.title = copy[explicit].appTitle;
              }
            }
            return explicit;
          });
          return;
        }
      }

      const browserLocale = detectBrowserLocale();
      localeRef.current = browserLocale;
      setLocale((current) => {
        if (current === browserLocale) {
          if (typeof document !== "undefined") {
            document.documentElement.lang = browserLocale;
            document.title = copy[browserLocale].appTitle;
          }
        }
        return browserLocale;
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [syncTelemetry]);

  useEffect(() => {
    const controller = new AbortController();
    void requiresAnalyticsConsent(controller.signal).then((required) => {
      if (controller.signal.aborted) return;
      consentRequiredRef.current = required;
      syncTelemetry();
    });
    return () => controller.abort();
  }, [syncTelemetry]);

  useEffect(() => {
    const handleLanguageChange = () => {
      if (explicitLocaleRef.current === null) {
        const browserLocale = detectBrowserLocale();
        localeRef.current = browserLocale;
        setLocale(browserLocale);
      }
    };

    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  useLayoutEffect(() => {
    const media = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => {
      const matches = media.matches;
      setIsMobile(matches);
      if (matches) {
        if (settingsMenuRef.current) settingsMenuRef.current.open = false;
        setSettingsOpen(false);
        if (moreSettingsRef.current) moreSettingsRef.current.open = true;
        setInspectorCollapsed(true);
      } else {
        if (settingsMenuRef.current) settingsMenuRef.current.open = true;
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
    setPdfBaseName: updatePdfBaseName,
    theme,
    setTheme: updateTheme,
    locale,
    setLocale: setUserLocale,
    telemetry,
    setTelemetry: updateTelemetry,
    showAnalyticsChoice,
    analyticsPolicyReady,
    localeRef,
    settingsMenuRef,
    moreSettingsRef,
    updateSettings,
    confirmClearText,
  };
}
