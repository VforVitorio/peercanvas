import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from the repository root.
const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");

/** Returns the text between the braces of the first block that starts with `opener`. */
function block(source: string, opener: string, from = 0): string {
  const start = source.indexOf(opener, from);
  expect(start, `CSS contains ${opener}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(source.indexOf("{", start) + 1, index);
    }
  }
  throw new Error(`Unclosed block ${opener}`);
}

const tokens = (body: string) =>
  Object.fromEntries(
    [...body.matchAll(/(--pc-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );

describe("theme tokens", () => {
  const light = tokens(block(css, ":root {"));
  const systemDark = tokens(
    block(block(css, "@media (prefers-color-scheme: dark)"), ":root:not([data-theme])"),
  );
  const explicitDark = tokens(block(css, ':root[data-theme="dark"]'));

  it("defines the dark set identically for the system fallback and the explicit choice", () => {
    expect(Object.keys(explicitDark).length).toBeGreaterThan(15);
    expect(systemDark).toEqual(explicitDark);
  });

  it("only restyles tokens that exist in the light set", () => {
    for (const name of Object.keys(explicitDark)) expect(light, name).toHaveProperty(name);
  });

  it("applies the system fallback only before a theme attribute exists", () => {
    // An explicit Light choice sets data-theme="light", which the :not([data-theme]) rule excludes.
    expect(css).toContain(":root:not([data-theme])");
    expect(css).not.toContain(':root[data-theme="light"]');
  });

  it("keeps the canvas paper white and the same in every theme", () => {
    expect(light["--pc-paper"]).toBe("#ffffff");
    expect(explicitDark).not.toHaveProperty("--pc-paper");
    expect(systemDark).not.toHaveProperty("--pc-paper");
    expect(block(css, ".pc-canvas-region {")).toContain("background: var(--pc-paper)");
  });

  it("keeps text and accent pairs readable in both themes", () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (a: string, b: string) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (high + 0.05) / (low + 0.05);
    };
    for (const [label, set] of [
      ["light", light],
      ["dark", { ...light, ...explicitDark }],
    ] as const) {
      for (const [foreground, background, minimum] of [
        ["--pc-text", "--pc-surface", 7],
        ["--pc-text", "--pc-bg", 7],
        ["--pc-text-muted", "--pc-surface", 4.5],
        ["--pc-text-muted", "--pc-bg", 4.5],
        ["--pc-accent-text", "--pc-accent", 4.5],
        ["--pc-accent-fg", "--pc-surface", 4.5],
        ["--pc-accent-fg", "--pc-accent-soft", 4.5],
        ["--pc-danger-text", "--pc-danger-soft", 4.5],
        ["--pc-warning-text", "--pc-warning-soft", 4.5],
        ["--pc-success-fg", "--pc-mint-soft", 4.5],
        ["--pc-focus", "--pc-surface", 3],
      ] as const) {
        expect(
          contrast(set[foreground], set[background]),
          `${label} ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });
});

describe("motion", () => {
  it("adds a short color transition only through the provider's class", () => {
    const rule = block(css, "html.pc-theme-transition,");
    expect(rule).toMatch(/transition:[\s\S]*background-color 180ms/);
    // The class selector guards it: no unconditional color transition on :root or *.
    expect(block(css, "* {")).not.toContain("transition");
    expect(block(css, ":root {")).not.toContain("transition");
  });

  it("removes the theme transition, drawer motion and spinner under reduced motion", () => {
    const reduced = block(css, "@media (prefers-reduced-motion: reduce)");
    expect(reduced).toMatch(/html\.pc-theme-transition[\s\S]*transition: none !important/);
    expect(reduced).toMatch(
      /\.pc-panel\[data-drawer="true"\]\[data-open="false"\]\s*{\s*transition: none/,
    );
    expect(reduced).toMatch(/\.pc-spinner\s*{\s*animation: none/);
  });
});

describe("responsive layout contract", () => {
  it("uses 240/280 side panels at wide widths and 220/260 at medium widths", () => {
    expect(block(css, ".pc-workspace {")).toContain(
      "grid-template-columns: 240px minmax(0, 1fr) 280px",
    );
    expect(block(css, '.pc-editor[data-layout="medium"] .pc-workspace')).toContain(
      "grid-template-columns: 220px minmax(0, 1fr) 260px",
    );
  });

  it("turns the left panel into a drawer first, then the properties panel", () => {
    expect(block(css, '.pc-editor[data-layout="compact"] .pc-workspace')).toContain(
      "grid-template-columns: minmax(0, 1fr) 240px",
    );
    expect(block(css, '.pc-editor[data-layout="narrow"] .pc-workspace')).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
  });

  it("hides a closed drawer from focus as well as from view", () => {
    expect(block(css, '.pc-panel-left[data-drawer="true"][data-open="false"]')).toContain(
      "visibility: hidden",
    );
    expect(block(css, '.pc-panel-right[data-drawer="true"][data-open="false"]')).toContain(
      "visibility: hidden",
    );
  });

  it("lets each panel body scroll independently of the canvas", () => {
    expect(block(css, ".pc-panel-body {")).toContain("overflow-y: auto");
    expect(block(css, ".pc-panel {")).toContain("min-height: 0");
    expect(block(css, ".pc-workspace {")).toContain("overflow: hidden");
    expect(block(css, ".pc-canvas-region {")).toContain("overflow: hidden");
  });

  it("styles every class the workspace components render", () => {
    // Guards the class contract: a renamed class in a component without a rule here shows up.
    const required = [
      ".pc-header",
      ".pc-brand",
      ".pc-document",
      ".pc-document-title",
      ".pc-document-status",
      ".pc-header-actions",
      ".pc-menu",
      ".pc-menu-popup",
      ".pc-menu-item",
      ".pc-notice",
      ".pc-panel",
      ".pc-panel-body",
      ".pc-tabs",
      ".pc-tab",
      ".pc-section",
      ".pc-field",
      ".pc-list-item",
      ".pc-canvas-panel",
      ".pc-canvas-context",
      ".pc-canvas-region",
      ".pc-canvas-footer",
      ".pc-drawer-scrim",
      ".pc-statusbar",
      ".pc-preferences-group",
      ".pc-radio",
      ".pc-shortcut-list",
    ];
    for (const selector of required) expect(css, selector).toContain(`${selector} {`);
  });
});
