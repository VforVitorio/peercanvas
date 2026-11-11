import { describe, expect, it } from "vitest";
import { brand, contrast, darkTheme, lightTheme } from "./tokens";

// WCAG 2.2: 4.5:1 for body text (1.4.3), 3:1 for focus indicators and UI boundaries (1.4.11).
const TEXT = 4.5;
const NON_TEXT = 3;

describe("design token contrast", () => {
  it("computes the WCAG reference ratio", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  for (const [name, theme] of [
    ["light", lightTheme],
    ["dark", darkTheme],
  ] as const) {
    describe(`${name} theme`, () => {
      for (const surface of ["bg", "surface", "surfaceAlt", "accentSoft"] as const) {
        it(`text and muted text are legible on ${surface}`, () => {
          expect(contrast(theme.text, theme[surface])).toBeGreaterThanOrEqual(TEXT);
          expect(contrast(theme.textMuted, theme[surface])).toBeGreaterThanOrEqual(TEXT);
        });
      }

      for (const surface of ["bg", "surface", "surfaceAlt"] as const) {
        it(`focus ring and status colours are distinguishable on ${surface}`, () => {
          expect(contrast(theme.focus, theme[surface])).toBeGreaterThanOrEqual(NON_TEXT);
          for (const status of ["accent", "danger", "success", "warning"] as const)
            expect(contrast(theme[status], theme[surface])).toBeGreaterThanOrEqual(TEXT);
        });
      }

      it("primary button text is legible on the accent fill", () => {
        expect(contrast(theme.accentText, theme.accent)).toBeGreaterThanOrEqual(TEXT);
      });
    });
  }

  it("simulation banner text and pill are legible", () => {
    expect(contrast("#F4F4F4", brand.ink)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast("#D6D6D6", brand.ink)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(brand.ink, brand.mint)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(brand.mint, brand.ink)).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
