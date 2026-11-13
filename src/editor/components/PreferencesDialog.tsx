import { useI18n } from "../../i18n";
import type { ThemePreference } from "../../native/contracts";
import { usePreferences, type Locale } from "../../preferences/PreferencesProvider";
import Dialog from "../ui/Dialog";

const themes: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "common.preferences.theme.system" },
  { value: "light", label: "common.preferences.theme.light" },
  { value: "dark", label: "common.preferences.theme.dark" },
];
// Language names are shown in their own language.
const languages: { value: Locale; label: string }[] = [
  { value: "en", label: "common.preferences.language.en" },
  { value: "es", label: "common.preferences.language.es" },
];

/** Appearance and language. Changes apply immediately and never touch the diagram document. */
export default function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const { t, message } = useI18n();
  const preferences = usePreferences();
  return (
    <Dialog
      title={t("common.preferences.title")}
      description={t("common.preferences.description")}
      onClose={onClose}
      closeOnBackdrop
      footer={
        <button type="button" className="pc-btn pc-btn--primary pc-primary" onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      {preferences.loading && <p role="status">{t("common.preferences.loading")}</p>}
      <fieldset className="pc-preferences-group">
        <legend>{t("common.preferences.theme.legend")}</legend>
        {themes.map((theme) => (
          <label key={theme.value} className="pc-radio">
            <input
              type="radio"
              name="pc-theme"
              value={theme.value}
              checked={preferences.theme === theme.value}
              onChange={() => preferences.setTheme(theme.value)}
            />
            {t(theme.label)}
          </label>
        ))}
        <p className="pc-hint">
          {preferences.theme === "system" ? `${t("common.preferences.theme.systemHint")} ` : ""}
          {t(
            preferences.resolvedTheme === "dark"
              ? "common.preferences.theme.activeDark"
              : "common.preferences.theme.activeLight",
          )}
        </p>
        <p className="pc-hint">{t("common.preferences.theme.paperNote")}</p>
      </fieldset>
      <fieldset className="pc-preferences-group">
        <legend>{t("common.preferences.language.legend")}</legend>
        {languages.map((language) => (
          <label key={language.value} className="pc-radio" lang={language.value}>
            <input
              type="radio"
              name="pc-language"
              value={language.value}
              checked={preferences.locale === language.value}
              onChange={() => preferences.setLocale(language.value)}
            />
            {t(language.label)}
          </label>
        ))}
        <p className="pc-hint">{t("common.preferences.language.hint")}</p>
      </fieldset>
      {preferences.persistence === "session" && (
        <p className="pc-hint">{t("common.preferences.sessionOnly")}</p>
      )}
      {preferences.warning && (
        <p className="pc-notice" data-tone="warning" role="status">
          {message(preferences.warning)}
        </p>
      )}
    </Dialog>
  );
}
