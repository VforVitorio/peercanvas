/** Stable native-to-renderer diagnostic. The renderer selects translated copy by code. */
export type NativeMessage = {
  code: string;
  params: Record<string, string | number>;
};

export type ThemePreference = "system" | "light" | "dark";
export type LocalePreference = "en" | "es" | null;
export type ResolvedLocale = Exclude<LocalePreference, null>;

export type PreferencesResponse = {
  theme: ThemePreference;
  /** null follows the supported operating-system locale, falling back to English. */
  locale: LocalePreference;
  warning: NativeMessage | null;
};

export type PreferencesPatch = {
  theme?: ThemePreference;
  locale?: ResolvedLocale;
};

/** Tauri `set_interface_locale({ locale })` updates only the native Quit menu label. */
export type SetInterfaceLocale = (locale: ResolvedLocale) => Promise<void>;

export type NativeSaveOutcome = {
  displayName: string;
  warning: NativeMessage | null;
  recentUpdated: boolean;
};

export type NativeDrawioImportCandidate = {
  displayName: string;
  document: unknown;
  losses: NativeMessage[];
  preservedFragmentCount: number;
};

export type NativeDrawioExportReview = {
  token: string;
  losses: NativeMessage[];
  preservedFragmentCount: number;
};

export type NativeDrawioExportOutcome = {
  displayName: string;
  warning: NativeMessage | null;
};

export function isNativeMessage(value: unknown): value is NativeMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NativeMessage>;
  if (
    typeof candidate.code !== "string" ||
    candidate.code.length === 0 ||
    typeof candidate.params !== "object" ||
    candidate.params === null ||
    Array.isArray(candidate.params)
  ) {
    return false;
  }
  return Object.values(candidate.params).every(
    (parameter) =>
      typeof parameter === "string" ||
      (typeof parameter === "number" && Number.isFinite(parameter)),
  );
}
