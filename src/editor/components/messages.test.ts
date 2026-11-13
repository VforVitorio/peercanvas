import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../document";
import { createTranslator } from "../../i18n/translator";
import {
  diagnosticKeys,
  diagnostics,
  formatMessage,
  fromError,
  list,
  native,
  normalizeLoss,
  text,
} from "./messages";

const diagnostic = (code: Diagnostic["code"], message: string): Diagnostic => ({
  code,
  path: "/pages/0",
  message,
});

describe("structured editor messages", () => {
  it("selects specific phrases first, then stable codes, without repeating keys", () => {
    expect(
      diagnosticKeys([
        diagnostic("INVALID_SCHEMA", "Connection endpoints must differ."),
        diagnostic("INVALID_GEOMETRY", "Geometry is outside supported bounds."),
        diagnostic("INVALID_GEOMETRY", "Expected geometry object."),
        diagnostic("INVALID_SCHEMA", "Some future core message."),
      ]),
    ).toEqual([
      "editor.diagnostics.endpointsMustDiffer",
      "editor.diagnostics.invalidGeometry",
      "editor.diagnostics.invalidSchema",
    ]);
    expect(diagnosticKeys([])).toEqual(["editor.diagnostics.unknown"]);
  });

  it("never renders English core text, paths, or raw exception text", () => {
    for (const locale of ["en", "es"] as const) {
      const i18n = createTranslator(locale);
      const rendered = [
        formatMessage(diagnostics([diagnostic("INVALID_JSON", "Input is not valid JSON.")]), i18n),
        formatMessage(fromError(new Error("EACCES /Users/private")), i18n),
      ].join(" ");
      expect(rendered).not.toContain("/pages/0");
      expect(rendered).not.toContain("/Users/private");
      expect(rendered).not.toContain("Input is not valid JSON.");
      expect(rendered).toBe(
        `${i18n.t("editor.diagnostics.invalidJson")} ${i18n.t("documents.errors.unexpected")}`,
      );
    }
  });

  it("summarizes long diagnostic lists with a localized plural count", () => {
    const i18n = createTranslator("en");
    const many = diagnostics([
      diagnostic("INVALID_JSON", ""),
      diagnostic("LIMIT_EXCEEDED", ""),
      diagnostic("DUPLICATE_ID", ""),
      diagnostic("LAST_PAGE", ""),
      diagnostic("LAST_LAYER", ""),
    ]);
    expect(formatMessage(many, i18n)).toContain(i18n.t("editor.diagnostics.more", { count: 2 }));
  });

  it("formats nested parameters lazily so a language change retranslates them", () => {
    const value = text("editor.feedback.selected", { name: text("editor.defaults.rectangle") });
    for (const locale of ["en", "es"] as const) {
      const i18n = createTranslator(locale);
      expect(formatMessage(value, i18n)).toBe(
        i18n.t("editor.feedback.selected", { name: i18n.t("editor.defaults.rectangle") }),
      );
    }
  });

  it("keeps one review entry per loss and maps unstructured entries to a generic phrase", () => {
    const loss = { code: "drawio.unsupportedElement", params: { name: "custom" } };
    expect(normalizeLoss(loss)).toEqual(native(loss));
    expect(normalizeLoss("raw native text")).toEqual(text("documents.drawio.unknownLoss"));
    const i18n = createTranslator("es");
    expect(formatMessage(list(native(loss), text("documents.drawio.noLosses")), i18n)).toBe(
      `${i18n.message(loss)} ${i18n.t("documents.drawio.noLosses")}`,
    );
  });
});
