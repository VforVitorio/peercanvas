import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./index";
import { createTranslator } from "./translator";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("lang");
});

describe("translator", () => {
  it("fills named parameters and formats numbers for the locale", () => {
    expect(createTranslator("en").t("documents.feedback.saved", { name: "plan.peercanvas" })).toBe(
      "Saved plan.peercanvas.",
    );
    expect(createTranslator("es").t("editor.status.revisionNew", { revision: 1234 })).toBe(
      `Revisión ${new Intl.NumberFormat("es").format(1234)} · nuevo`,
    );
    expect(createTranslator("en").formatNumber(1234567.5)).toBe("1,234,567.5");
    expect(createTranslator("es").formatNumber(0.5, { style: "percent" })).toBe(
      new Intl.NumberFormat("es", { style: "percent" }).format(0.5),
    );
  });

  it("selects plural variants from a numeric count", () => {
    const en = createTranslator("en");
    expect(en.t("documents.drawio.preserved", { count: 1 })).toMatch(
      /^1 safe source fragment will/,
    );
    expect(en.t("documents.drawio.preserved", { count: 2 })).toMatch(
      /^2 safe source fragments will/,
    );
    const es = createTranslator("es");
    expect(es.t("documents.drawio.preserved", { count: 1 })).toMatch(/^Se conservará 1 fragmento/);
    expect(es.t("documents.drawio.preserved", { count: 3 })).toMatch(
      /^Se conservarán 3 fragmentos/,
    );
  });

  it("inserts user text literally and never re-scans it for placeholders", () => {
    const hostile = "{count} {name} <b>{x}</b>";
    expect(createTranslator("en").t("editor.feedback.selected", { name: hostile })).toBe(
      `${hostile} selected.`,
    );
  });

  it("never exposes a key: unknown keys give a safe generic phrase in either language", () => {
    expect(createTranslator("en").t("editor.does.not.exist")).toBe(
      "Something went wrong. Try again.",
    );
    expect(createTranslator("es").t("editor.does.not.exist")).toBe(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });

  it("translates native messages by code and parameters", () => {
    const es = createTranslator("es");
    expect(es.message({ code: "document.sizeLimit", params: {} })).toBe(
      "El documento supera el límite de 10 MiB.",
    );
    expect(es.message({ code: "drawio.unsupportedElement", params: { name: "userObject" } })).toBe(
      "No se importó el elemento <userObject> de draw.io.",
    );
    expect(
      createTranslator("en").message({ code: "drawio.pageAttribute", params: { name: "x" } }),
    ).toBe("The draw.io page attribute x was not imported.");
  });

  it("uses a localized generic for unknown codes and malformed or raw values", () => {
    const en = createTranslator("en");
    const generic = en.message({ code: "native.operationFailed", params: {} });
    expect(en.message({ code: "future.code", params: { path: "/Users/me/secret" } })).toBe(generic);
    expect(en.message(new Error("ENOENT: /Users/me/secret"))).toBe(generic);
    expect(en.message("raw text from an old build")).toBe(generic);
    expect(en.message(null)).toBe(generic);
    expect(createTranslator("es").message(undefined)).toBe("No se pudo completar la operación.");
  });

  it.each(["en", "es"] as const)("ignores prototype property names in %s lookups", (locale) => {
    const translator = createTranslator(locale);
    for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(translator.message({ code: key, params: {} })).toBe(
        translator.message({ code: "native.operationFailed", params: {} }),
      );
      expect(translator.t(key)).toBe(translator.t("common.error.generic"));
      expect(translator.t(key, { count: 2 })).toBe(translator.t("common.error.generic"));
    }
  });

  it("formats dates with Intl and returns an empty string for invalid dates", () => {
    const iso = "2026-11-13T15:30:00Z";
    const options: Intl.DateTimeFormatOptions = { dateStyle: "long", timeZone: "UTC" };
    expect(createTranslator("en").formatDate(iso, options)).toBe(
      new Intl.DateTimeFormat("en", options).format(new Date(iso)),
    );
    expect(createTranslator("es").formatDate(new Date(iso), options)).toBe(
      new Intl.DateTimeFormat("es", options).format(new Date(iso)),
    );
    expect(createTranslator("en").formatDate("not a date")).toBe("");
  });
});

function Probe() {
  const { t, locale } = useI18n();
  return (
    <p>
      {locale}:{t("editor.header.undo")}
    </p>
  );
}

describe("I18nProvider", () => {
  it("defaults to English outside a provider so isolated components still render", () => {
    render(<Probe />);
    expect(screen.getByText("en:Undo")).toBeTruthy();
  });

  it("uses its locale, sets html lang and follows a locale change", () => {
    const { rerender } = render(
      <I18nProvider locale="es">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("es:Deshacer")).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
    rerender(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("en:Undo")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });
});
