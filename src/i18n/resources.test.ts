import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nativeCatalog from "../native/messages.en.json";
import { domains, resources } from "./resources";

const PLURAL = /\.(zero|one|two|few|many|other)$/;
const baseKey = (key: string) => key.replace(PLURAL, "");
const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

function groups(table: Record<string, string>) {
  const byBase = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(table)) {
    const base = baseKey(key);
    byBase.set(base, { ...byBase.get(base), [key]: value });
  }
  return byBase;
}

describe("message resources", () => {
  it("keeps domain prefixes and never defines a key twice", () => {
    for (const locale of ["en", "es"] as const) {
      const seen = new Set<string>();
      for (const [domain, table] of Object.entries(domains[locale])) {
        for (const key of Object.keys(table)) {
          expect(key.startsWith(`${domain}.`), `${locale} ${key} is in ${domain}.json`).toBe(true);
          expect(seen.has(key), `${locale} duplicate ${key}`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("has the same message keys in English and Spanish, with the same named parameters", () => {
    const en = groups(resources.en.messages);
    const es = groups(resources.es.messages);
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [base, variants] of en) {
      // Every locale needs the base form or its "other" variant so every count has a phrase.
      const spanish = es.get(base)!;
      expect(
        base in spanish || `${base}.other` in spanish,
        `${base} has a Spanish fallback form`,
      ).toBe(true);
      const params = placeholders(Object.values(variants).join(" "));
      for (const [key, value] of Object.entries(spanish)) {
        expect(placeholders(value), `Spanish ${key} parameters`).toEqual(params);
      }
    }
  });

  it("has no empty or whitespace-only values and no key text leaking into copy", () => {
    for (const locale of ["en", "es"] as const) {
      for (const table of [resources[locale].messages, resources[locale].native]) {
        for (const [key, value] of Object.entries(table)) {
          expect(value.trim(), `${locale} ${key}`).not.toBe("");
          expect(value, `${locale} ${key} must not repeat its key`).not.toBe(key);
        }
      }
    }
  });

  it("translates every code in the native English catalog, with the same parameters, and nothing extra", () => {
    expect(Object.keys(resources.en.native).sort()).toEqual(Object.keys(nativeCatalog).sort());
    expect(Object.keys(resources.es.native).sort()).toEqual(Object.keys(nativeCatalog).sort());
    for (const [code, english] of Object.entries(nativeCatalog)) {
      expect(placeholders(resources.es.native[code]), `Spanish ${code}`).toEqual(
        placeholders(english),
      );
      expect(placeholders(resources.en.native[code]), `English ${code}`).toEqual(
        placeholders(english),
      );
    }
  });

  it("covers every message code the Rust sources can emit", () => {
    // Vitest runs from the repository root.
    const dir = resolve(process.cwd(), "src-tauri/src");
    const codes = new Set<string>();
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".rs"))) {
      const source = readFileSync(resolve(dir, file), "utf8");
      for (const match of source.matchAll(
        /(?:::new|named)\(\s*"((?:file|document|preferences|drawio|native)\.[A-Za-z]+)"/g,
      )) {
        codes.add(match[1]);
      }
    }
    expect(codes.size).toBeGreaterThan(20);
    for (const code of codes) {
      expect(resources.en.native[code], `English ${code}`).toBeTruthy();
      expect(resources.es.native[code], `Spanish ${code}`).toBeTruthy();
    }
  });
});

describe("keys used by the application", () => {
  const sources = import.meta.glob(
    ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../ui-mock/**", "!../native-smoke/**"],
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;

  it("resolves every literal editor., documents. and common. key in Spanish and English", () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const match of source.matchAll(
        /["'`]((?:editor|documents|common)\.[A-Za-z][\w]*(?:\.[\w]+)*)["'`]/g,
      )) {
        const key = match[1];
        for (const locale of ["en", "es"] as const) {
          const table = resources[locale].messages;
          if (!(key in table) && !(`${key}.other` in table)) {
            missing.push(`${locale}: ${key} (${file})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("has no dead translations: every message key is referenced by a source file", () => {
    const used = new Set<string>();
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(
        /["'`]((?:editor|documents|common)\.[A-Za-z][\w]*(?:\.[\w]+)*)["'`]/g,
      )) {
        used.add(match[1]);
      }
    }
    const unused = Object.keys(resources.en.messages).filter(
      (key) => !used.has(key) && !used.has(baseKey(key)),
    );
    expect(unused).toEqual([]);
  });

  it("scans real source files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5);
  });
});
