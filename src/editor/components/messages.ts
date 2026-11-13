import type { Diagnostic } from "../../document";
import { isNativeMessage, type NativeMessage } from "../../native/contracts";

/**
 * Locale-independent description of an interface message. Messages are stored in state in this
 * form and translated during render, so pending errors, feedback, and reviews follow a language
 * change. User content (file names, element text) travels as plain string parameters.
 */
export type MessageParam = string | number | EditorMessage;
export type EditorMessage =
  | { kind: "text"; key: string; params?: Record<string, MessageParam> }
  | { kind: "native"; message: NativeMessage }
  | { kind: "diagnostics"; diagnostics: readonly Diagnostic[] }
  | { kind: "list"; items: readonly EditorMessage[] };

export const text = (key: string, params?: Record<string, MessageParam>): EditorMessage => ({
  kind: "text",
  key,
  params,
});
export const native = (message: NativeMessage): EditorMessage => ({ kind: "native", message });
export const diagnostics = (values: readonly Diagnostic[]): EditorMessage => ({
  kind: "diagnostics",
  diagnostics: values,
});
export const list = (...items: EditorMessage[]): EditorMessage => ({ kind: "list", items });

/** Converts any thrown value to a safe message. Raw exception text is never displayed. */
export function fromError(error: unknown): EditorMessage {
  return isNativeMessage(error) ? native(error) : text("documents.errors.unexpected");
}

/** Native warnings from an older build may still be strings; show a generic localized warning. */
export function fromWarning(warning: unknown): EditorMessage {
  return isNativeMessage(warning) ? native(warning) : text("documents.errors.warning");
}

/** Keeps one review entry per reported loss, without exposing unstructured native text. */
export function normalizeLoss(loss: unknown): EditorMessage {
  return isNativeMessage(loss) ? native(loss) : text("documents.drawio.unknownLoss");
}

// Exact document-core phrases that benefit from a specific translation. Everything else falls back
// to the stable diagnostic code. Validation itself is unchanged; this only selects presentation.
const exactDiagnostics: Record<string, string> = {
  "Connection endpoints must differ.": "editor.diagnostics.endpointsMustDiffer",
  "Connection endpoint is missing.": "editor.diagnostics.endpointMissing",
  "Connection endpoint does not exist.": "editor.diagnostics.endpointMissing",
  "Connection endpoint belongs to another page.": "editor.diagnostics.endpointOtherPage",
  "Name is invalid.": "editor.diagnostics.nameInvalid",
  "Name must contain 1–256 code points.": "editor.diagnostics.nameInvalid",
  "Title must contain 1–256 code points.": "editor.diagnostics.titleInvalid",
  "Metadata values are invalid.": "editor.diagnostics.titleInvalid",
  "Text exceeds its limit.": "editor.diagnostics.textTooLong",
  "Label exceeds its limit.": "editor.diagnostics.labelTooLong",
};

const codeDiagnostics: Record<Diagnostic["code"], string> = {
  INVALID_JSON: "editor.diagnostics.invalidJson",
  INVALID_SCHEMA: "editor.diagnostics.invalidSchema",
  UNSUPPORTED_VERSION: "editor.diagnostics.unsupportedVersion",
  LIMIT_EXCEEDED: "editor.diagnostics.limitExceeded",
  DUPLICATE_ID: "editor.diagnostics.duplicateId",
  MISSING_REFERENCE: "editor.diagnostics.missingReference",
  INVALID_GEOMETRY: "editor.diagnostics.invalidGeometry",
  LAST_PAGE: "editor.diagnostics.lastPage",
  LAST_LAYER: "editor.diagnostics.lastLayer",
  STYLE_IN_USE: "editor.diagnostics.styleInUse",
  INVALID_COMMAND: "editor.diagnostics.invalidCommand",
  REVISION_CONFLICT: "editor.diagnostics.revisionConflict",
};

const MAX_DIAGNOSTIC_PHRASES = 3;

/** Distinct translation keys for a diagnostic list, in reported order. */
export function diagnosticKeys(values: readonly Diagnostic[]): string[] {
  const keys: string[] = [];
  for (const value of values) {
    const key =
      exactDiagnostics[value.message] ??
      codeDiagnostics[value.code] ??
      "editor.diagnostics.unknown";
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.length > 0 ? keys : ["editor.diagnostics.unknown"];
}

export type MessageFormatter = {
  t: (key: string, params?: Record<string, string | number>) => string;
  message: (value: NativeMessage) => string;
};

export function formatMessage(value: EditorMessage, i18n: MessageFormatter): string {
  switch (value.kind) {
    case "text": {
      if (!value.params) return i18n.t(value.key);
      const params: Record<string, string | number> = {};
      for (const [name, param] of Object.entries(value.params)) {
        params[name] = typeof param === "object" ? formatMessage(param, i18n) : param;
      }
      return i18n.t(value.key, params);
    }
    case "native":
      return i18n.message(value.message);
    case "diagnostics": {
      const keys = diagnosticKeys(value.diagnostics);
      const phrases = keys.slice(0, MAX_DIAGNOSTIC_PHRASES).map((key) => i18n.t(key));
      if (keys.length > MAX_DIAGNOSTIC_PHRASES) {
        phrases.push(
          i18n.t("editor.diagnostics.more", { count: keys.length - MAX_DIAGNOSTIC_PHRASES }),
        );
      }
      return phrases.join(" ");
    }
    case "list":
      return value.items.map((item) => formatMessage(item, i18n)).join(" ");
  }
}
