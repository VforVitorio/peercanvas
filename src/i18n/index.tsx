import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { usePreferences, type Locale } from "../preferences/context";
import { createTranslator, type MessageParams, type Translator } from "./translator";

export type { Locale, MessageParams, Translator };

const defaultTranslator = createTranslator("en");
const I18nContext = createContext<Translator>(defaultTranslator);

/**
 * Provides translations. Without a `locale` prop it follows the preference resolved by
 * `PreferencesProvider` (saved choice, else supported system language, else English) and keeps
 * `<html lang>` in sync with it.
 */
export function I18nProvider({ locale, children }: { locale?: Locale; children: ReactNode }) {
  const preferred = usePreferences().locale;
  const active = locale ?? preferred;
  const translator = useMemo(() => createTranslator(active), [active]);
  useLayoutEffect(() => {
    document.documentElement.lang = active;
  }, [active]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

/** Outside a provider this is an English translator, so isolated component tests keep working. */
export function useI18n(): Translator {
  return useContext(I18nContext);
}
