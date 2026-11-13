import type { Locale } from "../preferences/context";
import enCommon from "./locales/en/common.json";
import enDocuments from "./locales/en/documents.json";
import enEditor from "./locales/en/editor.json";
import enNative from "./locales/en/native.json";
import esCommon from "./locales/es/common.json";
import esDocuments from "./locales/es/documents.json";
import esEditor from "./locales/es/editor.json";
import esNative from "./locales/es/native.json";

export type MessageTable = Record<string, string>;

/** Domain files, kept separate for review; their keys are prefixed with the domain and never collide. */
export const domains = {
  en: { common: enCommon, documents: enDocuments, editor: enEditor },
  es: { common: esCommon, documents: esDocuments, editor: esEditor },
} as const satisfies Record<Locale, Record<string, MessageTable>>;

function merge(files: Record<string, MessageTable>): MessageTable {
  return Object.assign({}, ...Object.values(files));
}

export const resources: Record<Locale, { messages: MessageTable; native: MessageTable }> = {
  en: { messages: merge(domains.en), native: enNative },
  es: { messages: merge(domains.es), native: esNative },
};
