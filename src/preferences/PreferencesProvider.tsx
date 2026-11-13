import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { I18nProvider } from "../i18n";
import {
  isNativeMessage,
  type NativeMessage,
  type PreferencesPatch,
  type PreferencesResponse,
  type ThemePreference,
} from "../native/contracts";
import {
  PreferencesContext,
  detectSystemLocale,
  isLocale,
  isTheme,
  usePreferences,
  type Locale,
  type PreferencesValue,
} from "./context";

export { usePreferences };
export type { Locale, PreferencesValue };

const TRANSITION_CLASS = "pc-theme-transition";
const TRANSITION_MS = 220;
const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Warnings that describe a failed write and are cleared by the next successful write.
const TRANSIENT_WARNINGS = new Set(["preferences.writeFailed", "preferences.unavailable"]);
const UNCERTAIN_WRITE_WARNINGS = new Set(["preferences.writeFailed", "file.directoryNotDurable"]);

/** Wraps `invoke` so a synchronous throw or a missing promise still ends in the same catch path. */
function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return Promise.resolve(invoke<T>(command, args));
  } catch (error) {
    return Promise.reject(error);
  }
}

const media = (query: string): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(query) : null;

function listen(query: MediaQueryList | null, handler: () => void): () => void {
  if (!query) return () => undefined;
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }
  query.addListener(handler);
  return () => query.removeListener(handler);
}

const readSystemDark = () => media(DARK_QUERY)?.matches ?? false;
const readSystemLocale = () =>
  detectSystemLocale(
    typeof navigator === "undefined"
      ? undefined
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language],
  );

/** Reads the typed native record defensively; native data is not trusted to be well formed. */
function readSnapshot(value: unknown): PreferencesResponse {
  const record = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    theme: isTheme(record.theme) ? record.theme : "system",
    locale: isLocale(record.locale) ? record.locale : null,
    warning: isNativeMessage(record.warning) ? record.warning : null,
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [persistence] = useState<PreferencesValue["persistence"]>(() =>
    isTauri() ? "native" : "session",
  );
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [localeChoice, setLocaleChoice] = useState<Locale | null>(null);
  const [systemDark, setSystemDark] = useState(readSystemDark);
  const [systemLocale, setSystemLocale] = useState(readSystemLocale);
  const [loading, setLoading] = useState(persistence === "native");
  const [warning, setWarning] = useState<NativeMessage | null>(null);

  // Choices made before the native snapshot arrives must not be overwritten by it.
  const touched = useRef({ theme: false, locale: false });
  const queued = useRef<PreferencesPatch>({});
  // A failed or durability-uncertain partial write must be included in the next explicit
  // preference update. This is memory-only: there is no background retry loop.
  const retryPatch = useRef<PreferencesPatch>({});
  const draining = useRef(false);
  const mounted = useRef(false);
  const animateNextTheme = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Follow the operating system until the user picks Light or Dark; language changes likewise.
  useEffect(() => {
    const stopTheme = listen(media(DARK_QUERY), () => setSystemDark(readSystemDark()));
    const onLanguage = () => setSystemLocale(readSystemLocale());
    window.addEventListener("languagechange", onLanguage);
    return () => {
      stopTheme();
      window.removeEventListener("languagechange", onLanguage);
    };
  }, []);

  useEffect(() => {
    if (persistence !== "native") return;
    let cancelled = false;
    call<PreferencesResponse>("get_preferences")
      .then((value) => {
        if (cancelled) return;
        const snapshot = readSnapshot(value);
        if (!touched.current.theme) setThemeState(snapshot.theme);
        if (!touched.current.locale && snapshot.locale) setLocaleChoice(snapshot.locale);
        // A failed write is more specific than a load note, so keep it.
        if (snapshot.warning) setWarning((current) => current ?? snapshot.warning);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWarning((current) => current ?? { code: "preferences.unavailable", params: {} });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const locale: Locale = localeChoice ?? systemLocale;

  // The operating-system menu is native, so tell it the resolved language once preferences are
  // known (not before, to avoid flashing the system language when a saved choice differs).
  useEffect(() => {
    if (persistence !== "native" || loading) return;
    let cancelled = false;
    call<void>("set_interface_locale", { locale }).catch((error: unknown) => {
      if (cancelled) return;
      const failure = isNativeMessage(error)
        ? error
        : { code: "native.menuUpdateFailed", params: {} };
      setWarning((current) => current ?? failure);
    });
    return () => {
      cancelled = true;
    };
  }, [persistence, loading, locale]);

  // Layout effect: the attribute must be in place before paint so the saved theme does not flash.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const reduced = media(REDUCED_MOTION_QUERY)?.matches ?? false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (animateNextTheme.current && !reduced) {
      root.classList.add(TRANSITION_CLASS);
      timer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
    }
    animateNextTheme.current = false;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = theme;
    root.style.colorScheme = resolvedTheme;
    return () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        root.classList.remove(TRANSITION_CLASS);
      }
    };
  }, [resolvedTheme, theme]);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    try {
      // Writes are serialized; choices made during a write are merged into the next one so the
      // last choice always wins and a slow response can never resurrect an older value.
      while (Object.keys(queued.current).length > 0) {
        const patch = { ...retryPatch.current, ...queued.current };
        queued.current = {};
        let failure: NativeMessage | null = null;
        let reported: NativeMessage | null = null;
        try {
          reported = readSnapshot(await call("update_preferences", { patch })).warning;
        } catch {
          failure = { code: "preferences.writeFailed", params: {} };
        }
        if (!mounted.current) return;
        const uncertain = Boolean(
          failure || (reported && UNCERTAIN_WRITE_WARNINGS.has(reported.code)),
        );
        if (uncertain) {
          retryPatch.current = { ...retryPatch.current, ...patch };
          setWarning(failure ?? reported);
        } else {
          // Clear only values this request actually persisted. A newer choice made while it was
          // in flight remains queued and takes precedence on the next request.
          for (const key of Object.keys(patch) as (keyof PreferencesPatch)[]) {
            delete retryPatch.current[key];
          }
          if (reported) setWarning(reported);
          else if (Object.keys(retryPatch.current).length === 0)
            setWarning((current) =>
              current && TRANSIENT_WARNINGS.has(current.code) ? null : current,
            );
        }
      }
    } finally {
      draining.current = false;
    }
  }, []);

  const persist = useCallback(
    (patch: PreferencesPatch) => {
      if (persistence !== "native") return;
      queued.current = { ...queued.current, ...patch };
      void drain();
    },
    [persistence, drain],
  );

  const setTheme = useCallback(
    (next: ThemePreference) => {
      if (!isTheme(next)) return;
      touched.current.theme = true;
      setThemeState((previous) => {
        // Idempotent flag: only a real change may animate, and never the startup/load path.
        if (previous !== next) animateNextTheme.current = true;
        return next;
      });
      persist({ theme: next });
    },
    [persist],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      touched.current.locale = true;
      setLocaleChoice(next);
      persist({ locale: next });
    },
    [persist],
  );

  const dismissWarning = useCallback(() => setWarning(null), []);

  const value = useMemo<PreferencesValue>(
    () => ({
      theme,
      resolvedTheme,
      locale,
      setTheme,
      setLocale,
      loading,
      warning,
      dismissWarning,
      persistence,
    }),
    [
      theme,
      resolvedTheme,
      locale,
      setTheme,
      setLocale,
      loading,
      warning,
      dismissWarning,
      persistence,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <I18nProvider>{children}</I18nProvider>
    </PreferencesContext.Provider>
  );
}
