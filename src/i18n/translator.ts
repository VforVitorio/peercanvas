import { isNativeMessage } from "../native/contracts";
import type { Locale } from "../preferences/context";
import { resources } from "./resources";

export type MessageParams = Record<string, string | number>;

export type Translator = {
  locale: Locale;
  t: (key: string, params?: MessageParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  /** Translates a stable native message. Unknown codes and malformed values give a safe generic phrase. */
  message: (value: unknown) => string;
};

const GENERIC_KEY = "common.error.generic";
const NATIVE_GENERIC_CODE = "native.operationFailed";

function ownPhrase(table: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(table, key)) return undefined;
  const phrase = table[key];
  return typeof phrase === "string" ? phrase : undefined;
}

export function createTranslator(locale: Locale): Translator {
  const numbers = new Intl.NumberFormat(locale);
  const plural = (target: Locale) => new Intl.PluralRules(target);
  const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};
  const rules = (target: Locale) => (pluralRules[target] ??= plural(target));

  // Single pass: a user-authored parameter value is never re-scanned for placeholders.
  function fill(template: string, params?: MessageParams): string {
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = params?.[name];
      if (value === undefined) return "";
      return typeof value === "number" ? numbers.format(value) : String(value);
    });
  }

  function find(target: Locale, key: string, params?: MessageParams): string | undefined {
    const table = resources[target].messages;
    const count = params?.count;
    if (typeof count === "number") {
      const category = rules(target).select(count);
      const variant = ownPhrase(table, `${key}.${category}`) ?? ownPhrase(table, `${key}.other`);
      if (variant !== undefined) return variant;
    }
    return ownPhrase(table, key);
  }

  const t: Translator["t"] = (key, params) => {
    const template =
      find(locale, key, params) ??
      find("en", key, params) ??
      find(locale, GENERIC_KEY) ??
      find("en", GENERIC_KEY);
    return template === undefined ? "" : fill(template, params);
  };

  const message: Translator["message"] = (value) => {
    const code = isNativeMessage(value) ? value.code : undefined;
    const params: MessageParams = {};
    if (isNativeMessage(value)) {
      for (const [name, param] of Object.entries(value.params)) {
        if (typeof param === "string" || typeof param === "number") params[name] = param;
      }
    }
    const template =
      (code === undefined ? undefined : ownPhrase(resources[locale].native, code)) ??
      (code === undefined ? undefined : ownPhrase(resources.en.native, code)) ??
      ownPhrase(resources[locale].native, NATIVE_GENERIC_CODE) ??
      ownPhrase(resources.en.native, NATIVE_GENERIC_CODE);
    return template === undefined ? t(GENERIC_KEY) : fill(template, params);
  };

  const formatNumber: Translator["formatNumber"] = (value, options) =>
    options ? new Intl.NumberFormat(locale, options).format(value) : numbers.format(value);

  const formatDate: Translator["formatDate"] = (value, options) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(
      locale,
      options ?? { dateStyle: "medium", timeStyle: "short" },
    ).format(date);
  };

  return { locale, t, formatNumber, formatDate, message };
}
