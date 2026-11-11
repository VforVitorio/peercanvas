/**
 * PeerCanvas demo design tokens.
 *
 * ink, cobalt and paper were programmatically sampled (most frequent opaque pixel
 * colour) from the original maintainer-supplied PNG artwork in docs/branding/assets:
 *
 *   ink    #252524  symbol's most frequent ink colour (40311 pixels)
 *   cobalt #005CBA  symbol's blue form (23548 pixels)
 *   paper  #FDFAF6  brand-board background (385900 pixels)
 *
 * mint (#4CF2B4, small accent square) and azure (#1A8CFF, brighter blue for dark
 * surfaces) are explicitly chosen accent values, NOT sampled from the artwork.
 *
 * Mint is never used as text on light surfaces (insufficient contrast); it is used
 * as an accent fill carrying ink text, or as the focus ring on dark surfaces.
 * WCAG contrast of the text/focus pairs below is asserted in tokens.test.ts.
 */
export const brand = {
  ink: "#252524",
  cobalt: "#005CBA",
  mint: "#4CF2B4",
  paper: "#FDFAF6",
  azure: "#1A8CFF",
} as const;

export const lightTheme = {
  bg: "#F4F3EF",
  surface: "#FFFFFF",
  surfaceAlt: brand.paper,
  border: "#D9D6CE",
  text: brand.ink,
  textMuted: "#575C66",
  accent: brand.cobalt,
  accentText: "#FFFFFF",
  accentSoft: "#E3EEFA",
  danger: "#B42318",
  success: "#0B6E4F",
  warning: "#8A5300",
  focus: brand.cobalt,
} as const;

export const darkTheme = {
  bg: "#121417",
  surface: "#1B1E23",
  surfaceAlt: "#22262C",
  border: "#343A43",
  text: "#ECEEF1",
  textMuted: "#A6ADB9",
  accent: "#5EA8FF",
  accentText: "#0D1117",
  accentSoft: "#1D3350",
  danger: "#FF8A80",
  success: "#5EE3AE",
  warning: "#F5C069",
  focus: brand.mint,
} as const;

export type ThemeTokens = { readonly [K in keyof typeof lightTheme]: string };

/** Relative luminance per WCAG 2.2 for a #RRGGBB colour. */
export function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Emits the theme tokens as CSS custom properties on a selector. */
export function themeCss(): string {
  const paper = Object.entries(canvasPaper)
    .map(
      ([key, value]) =>
        `--pc-paper-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`,
    )
    .join(" ");
  const block = (tokens: ThemeTokens) =>
    Object.entries(tokens)
      .map(
        ([key, value]) => `--pc-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`,
      )
      .concat(paper)
      .join(" ");
  return [
    `.pc-root[data-theme="light"] { ${block(lightTheme)} --pc-ink: ${brand.ink}; --pc-mint: ${brand.mint}; color-scheme: light; }`,
    `.pc-root[data-theme="dark"] { ${block(darkTheme)} --pc-ink: ${brand.ink}; --pc-mint: ${brand.mint}; color-scheme: dark; }`,
  ].join("\n");
}

/**
 * The diagram canvas is a paper surface that is white in BOTH editor themes. The shared
 * document contract (docs/architecture/shared-document-contract.md) defines the default
 * appearance of a null style as white fill and black stroke/text; keeping the paper white
 * keeps those defaults legible without mutating the document or recolouring explicit styles
 * by theme. Only the surrounding editor chrome switches between light and dark.
 */
export const canvasPaper = {
  paper: "#FFFFFF",
  grid: "#D9D6CE",
  /** Muted text on paper (empty-page hint). */
  textMuted: lightTheme.textMuted,
  /** Focus ring and selection overlay drawn on paper. */
  focus: brand.cobalt,
} as const;

/**
 * Declared default appearance of a null style plus a null connection style, taken from the
 * shared document contract's default-style paragraph. These are adapter defaults, not
 * persisted renderer state.
 */
export { defaultAppearance } from "../../canvas/projection";

/** Colours drawn on the paper by the read-only projection (selection overlay). */
export function canvasChrome() {
  return { selection: canvasPaper.focus };
}
