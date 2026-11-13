import { createContext, useContext } from "react";
import type { NativeMessage, ThemePreference } from "../native/contracts";

export type Locale = "en" | "es";
export const supportedLocales: readonly Locale[] = ["en", "es"];
export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"];

export type PreferencesValue = {
  /** The user's theme choice, including "system". */
  theme: ThemePreference;
  /** The theme actually applied to the application chrome. */
  resolvedTheme: "light" | "dark";
  /** The language actually used: saved choice, else supported system language, else English. */
  locale: Locale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  /** True until the native preference snapshot has been read (always false without the desktop API). */
  loading: boolean;
  /** Stable native message about reading/writing preferences; render it with `useI18n().message`. */
  warning: NativeMessage | null;
  dismissWarning: () => void;
  /** "session" means choices last only until the window closes (no desktop API available). */
  persistence: "native" | "session";
};

/** Used outside a provider: English, system light, session-only, inert setters. */
export const fallbackPreferences: PreferencesValue = {
  theme: "system",
  resolvedTheme: "light",
  locale: "en",
  setTheme: () => undefined,
  setLocale: () => undefined,
  loading: false,
  warning: null,
  dismissWarning: () => undefined,
  persistence: "session",
};

export const PreferencesContext = createContext<PreferencesValue>(fallbackPreferences);

export function usePreferences(): PreferencesValue {
  return useContext(PreferencesContext);
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "es";
}

export function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** First supported language in the operating-system preference list, else English. */
export function detectSystemLocale(languages: readonly string[] | undefined): Locale {
  for (const language of languages ?? []) {
    const primary = language.trim().toLowerCase().split(/[-_]/)[0];
    if (primary === "es") return "es";
    if (primary === "en") return "en";
  }
  return "en";
}
