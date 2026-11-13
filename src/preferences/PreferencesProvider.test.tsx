import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, serializeDocument } from "../document";
import { createDocumentHistory } from "../document/history";
import { useI18n } from "../i18n";
import type { PreferencesResponse } from "../native/contracts";
import { PreferencesProvider, usePreferences } from "./PreferencesProvider";

const tauri = vi.hoisted(() => ({
  native: true,
  invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, args?: unknown) => tauri.invoke(command, args),
  isTauri: () => tauri.native,
}));

const system = { dark: false, reduced: false, listeners: new Set<() => void>() };

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query.includes("prefers-color-scheme: dark")) return system.dark;
      if (query.includes("prefers-reduced-motion")) return system.reduced;
      return false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      if (query.includes("prefers-color-scheme")) system.listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => system.listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function setSystemDark(value: boolean) {
  system.dark = value;
  act(() => system.listeners.forEach((listener) => listener()));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const snapshot = (overrides: Partial<PreferencesResponse> = {}): PreferencesResponse => ({
  theme: "system",
  locale: null,
  warning: null,
  ...overrides,
});

function Harness() {
  const preferences = usePreferences();
  const { t, message } = useI18n();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({
          theme: preferences.theme,
          resolved: preferences.resolvedTheme,
          locale: preferences.locale,
          loading: preferences.loading,
          persistence: preferences.persistence,
        })}
      </output>
      <p data-testid="copy">{t("editor.header.undo")}</p>
      {preferences.warning && <p role="alert">{message(preferences.warning)}</p>}
      <button onClick={() => preferences.setTheme("dark")}>dark</button>
      <button onClick={() => preferences.setTheme("light")}>light</button>
      <button onClick={() => preferences.setTheme("system")}>system</button>
      <button onClick={() => preferences.setLocale("es")}>spanish</button>
      <button onClick={() => preferences.setLocale("en")}>english</button>
      <button onClick={preferences.dismissWarning}>dismiss</button>
    </div>
  );
}

const state = () =>
  JSON.parse(screen.getByTestId("state").textContent ?? "{}") as {
    theme: string;
    resolved: string;
    locale: string;
    loading: boolean;
    persistence: string;
  };
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const root = document.documentElement;
const flush = () => act(async () => undefined);
const mountProvider = () =>
  render(
    <PreferencesProvider>
      <Harness />
    </PreferencesProvider>,
  );
const updates = () =>
  tauri.invoke.mock.calls.filter(([command]) => command === "update_preferences");

beforeEach(() => {
  tauri.native = true;
  tauri.invoke.mockReset();
  tauri.invoke.mockImplementation(async (command) => {
    if (command === "get_preferences") return snapshot();
    if (command === "update_preferences") return snapshot();
    if (command === "set_interface_locale") return undefined;
    throw new Error(`unexpected command ${command}`);
  });
  system.dark = false;
  system.reduced = false;
  system.listeners.clear();
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "languages");
  root.removeAttribute("data-theme");
  root.removeAttribute("data-theme-preference");
  root.removeAttribute("lang");
  root.className = "";
  root.style.colorScheme = "";
});

describe("PreferencesProvider outside the desktop app", () => {
  beforeEach(() => {
    tauri.native = false;
  });

  it("is session-only: choices apply immediately and nothing is persisted or warned about", () => {
    mountProvider();
    expect(state()).toMatchObject({
      theme: "system",
      resolved: "light",
      persistence: "session",
      loading: false,
    });
    click("dark");
    expect(state()).toMatchObject({ theme: "dark", resolved: "dark" });
    click("spanish");
    expect(state().locale).toBe("es");
    expect(screen.getByTestId("copy").textContent).toBe("Deshacer");
    expect(tauri.invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts from the system theme and follows it until the user chooses explicitly", () => {
    system.dark = true;
    mountProvider();
    expect(state()).toMatchObject({ theme: "system", resolved: "dark" });
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    setSystemDark(false);
    expect(state().resolved).toBe("light");
    expect(root.dataset.theme).toBe("light");
    click("dark");
    setSystemDark(true);
    setSystemDark(false);
    expect(state()).toMatchObject({ theme: "dark", resolved: "dark" });
    click("system");
    expect(state().resolved).toBe("light");
  });

  it("resolves the language from the first supported system language, else English", () => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["fr-FR", "es-MX"],
    });
    const { unmount } = mountProvider();
    expect(state().locale).toBe("es");
    expect(root.lang).toBe("es");
    unmount();
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["de-DE", "ja"] });
    mountProvider();
    expect(state().locale).toBe("en");
    expect(root.lang).toBe("en");
  });

  it("keeps html lang in step with the language and leaves the saved choice authoritative", () => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["es-ES"] });
    mountProvider();
    expect(root.lang).toBe("es");
    click("english");
    expect(root.lang).toBe("en");
    expect(screen.getByTestId("copy").textContent).toBe("Undo");
  });
});

describe("PreferencesProvider with native preferences", () => {
  it("applies the saved snapshot without an initial transition and stays loading until then", async () => {
    const load = deferred<PreferencesResponse>();
    tauri.invoke.mockImplementation((command) =>
      command === "get_preferences" ? load.promise : Promise.resolve(snapshot()),
    );
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(root.className));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    mountProvider();
    expect(state()).toMatchObject({ loading: true, theme: "system", persistence: "native" });
    expect(root.dataset.theme).toBe("light");
    await act(async () => load.resolve(snapshot({ theme: "dark", locale: "es" })));
    await flush();
    observer.disconnect();
    expect(state()).toMatchObject({
      loading: false,
      theme: "dark",
      resolved: "dark",
      locale: "es",
    });
    expect(root.dataset.theme).toBe("dark");
    expect(root.lang).toBe("es");
    expect(root.classList.contains("pc-theme-transition")).toBe(false);
    expect(seen.some((value) => value.includes("pc-theme-transition"))).toBe(false);
    expect(updates()).toHaveLength(0);
  });

  it("treats a saved null locale as 'follow the system'", async () => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["es-AR"] });
    tauri.invoke.mockImplementation(async () => snapshot({ theme: "light", locale: null }));
    mountProvider();
    await flush();
    expect(state()).toMatchObject({ theme: "light", locale: "es" });
  });

  it("keeps user choices made while loading and never lets the snapshot overwrite them", async () => {
    const load = deferred<PreferencesResponse>();
    tauri.invoke.mockImplementation((command) =>
      command === "get_preferences" ? load.promise : Promise.resolve(snapshot()),
    );
    mountProvider();
    click("light");
    click("spanish");
    await act(async () => load.resolve(snapshot({ theme: "dark", locale: "en" })));
    await flush();
    expect(state()).toMatchObject({ theme: "light", locale: "es", loading: false });
    expect(updates().map(([, args]) => args)).toEqual([
      { patch: { theme: "light" } },
      { patch: { locale: "es" } },
    ]);
  });

  it("does not trust malformed native data", async () => {
    tauri.invoke.mockImplementation(async () => ({
      theme: "neon",
      locale: "fr",
      warning: { code: 7 },
    }));
    mountProvider();
    await flush();
    expect(state()).toMatchObject({ theme: "system", locale: "en", loading: false });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a translated warning from the snapshot and lets the user dismiss it", async () => {
    tauri.invoke.mockImplementation(async () =>
      snapshot({ warning: { code: "preferences.recovered", params: {} } }),
    );
    mountProvider();
    await flush();
    expect(screen.getByRole("alert").textContent).toBe(
      "PeerCanvas restored preferences from the previous saved copy.",
    );
    click("dismiss");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls back to session defaults with a warning when loading fails", async () => {
    tauri.invoke.mockImplementation(async (command) => {
      if (command === "get_preferences") throw new Error("/Users/me/secret failed");
      return snapshot();
    });
    mountProvider();
    await flush();
    expect(state()).toMatchObject({ loading: false, theme: "system" });
    expect(screen.getByRole("alert").textContent).toBe("Application preferences are unavailable.");
    expect(document.body.textContent).not.toContain("/Users/me/secret");
    click("dark");
    await flush();
    expect(state().theme).toBe("dark");
  });

  it("tells the native menu the resolved language only after preferences have loaded", async () => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-US"] });
    const load = deferred<PreferencesResponse>();
    tauri.invoke.mockImplementation((command) =>
      command === "get_preferences" ? load.promise : Promise.resolve(undefined),
    );
    const menuCalls = () =>
      tauri.invoke.mock.calls.filter(([command]) => command === "set_interface_locale");
    mountProvider();
    await flush();
    expect(menuCalls()).toHaveLength(0);
    await act(async () => load.resolve(snapshot({ locale: "es" })));
    await flush();
    expect(menuCalls().map(([, args]) => args)).toEqual([{ locale: "es" }]);
    click("english");
    await flush();
    expect(menuCalls().map(([, args]) => args)).toEqual([{ locale: "es" }, { locale: "en" }]);
  });

  it("warns, without blocking anything, when the native menu cannot be updated", async () => {
    tauri.invoke.mockImplementation(async (command) => {
      if (command === "set_interface_locale") {
        throw { code: "native.menuUpdateFailed", params: {} };
      }
      return snapshot();
    });
    mountProvider();
    await flush();
    expect(screen.getByRole("alert").textContent).toBe(
      "The native application menu could not be updated.",
    );
    click("dark");
    await flush();
    expect(state().theme).toBe("dark");
  });

  it("persists a typed partial patch for each choice", async () => {
    mountProvider();
    await flush();
    click("dark");
    await flush();
    click("spanish");
    await flush();
    expect(updates().map(([, args]) => args)).toEqual([
      { patch: { theme: "dark" } },
      { patch: { locale: "es" } },
    ]);
  });

  it("serializes writes, merges choices made during a write, and ignores stale responses", async () => {
    const first = deferred<PreferencesResponse>();
    let inFlight = 0;
    let maxInFlight = 0;
    tauri.invoke.mockImplementation(async (command) => {
      if (command === "get_preferences") return snapshot();
      if (command !== "update_preferences") return undefined;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        return updates().length === 1
          ? await first.promise
          : snapshot({ theme: "light", locale: "es" });
      } finally {
        inFlight -= 1;
      }
    });
    mountProvider();
    await flush();
    click("dark");
    click("spanish");
    click("light");
    expect(updates()).toHaveLength(1);
    expect(state()).toMatchObject({ theme: "light", locale: "es" });
    // The slow first response describes the oldest choice; it must not resurrect it.
    await act(async () => first.resolve(snapshot({ theme: "dark", locale: "en" })));
    await flush();
    expect(updates().map(([, args]) => args)).toEqual([
      { patch: { theme: "dark" } },
      { patch: { theme: "light", locale: "es" } },
    ]);
    expect(maxInFlight).toBe(1);
    expect(state()).toMatchObject({ theme: "light", locale: "es" });
  });

  it("applies a choice for the session and warns when it cannot be saved", async () => {
    tauri.invoke.mockImplementation(async (command) => {
      if (command === "update_preferences") throw { code: "preferences.writeFailed", params: {} };
      return snapshot();
    });
    mountProvider();
    await flush();
    click("dark");
    await flush();
    expect(state()).toMatchObject({ theme: "dark", resolved: "dark" });
    expect(root.dataset.theme).toBe("dark");
    expect(screen.getByRole("alert").textContent).toBe(
      "The preference applies for this session, but could not be saved.",
    );
    click("dismiss");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the failure warning in the selected language and clears it after a later successful save", async () => {
    let fail = true;
    tauri.invoke.mockImplementation(async (command) => {
      if (command === "update_preferences" && fail) throw new Error("disk full at /private/path");
      return snapshot();
    });
    mountProvider();
    await flush();
    click("dark");
    await flush();
    click("spanish");
    await flush();
    expect(screen.getByRole("alert").textContent).toBe(
      "La preferencia se aplica en esta sesión, pero no se pudo guardar.",
    );
    expect(document.body.textContent).not.toContain("/private/path");
    fail = false;
    click("light");
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(state()).toMatchObject({ theme: "light", locale: "es" });
  });

  it("shows a warning the native side reports with a successful write", async () => {
    const patches: unknown[] = [];
    tauri.invoke.mockImplementation(async (command, args) => {
      if (command !== "update_preferences") return snapshot();
      patches.push(args);
      return patches.length === 1
        ? snapshot({ theme: "dark", warning: { code: "preferences.writeFailed", params: {} } })
        : snapshot({ theme: "dark", locale: "es" });
    });
    mountProvider();
    await flush();
    click("dark");
    await flush();
    expect(screen.getByRole("alert").textContent).toContain("could not be saved");
    click("spanish");
    await flush();
    expect(patches).toEqual([
      { patch: { theme: "dark" } },
      { patch: { theme: "dark", locale: "es" } },
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retains a rejected preference patch when a later unrelated write also fails", async () => {
    const patches: unknown[] = [];
    tauri.invoke.mockImplementation(async (command, args) => {
      if (command !== "update_preferences") return snapshot();
      patches.push(args);
      throw { code: "preferences.writeFailed", params: {} };
    });
    mountProvider();
    await flush();
    click("dark");
    await flush();
    click("spanish");
    await flush();
    expect(patches).toEqual([
      { patch: { theme: "dark" } },
      { patch: { theme: "dark", locale: "es" } },
    ]);
    expect(screen.getByRole("alert").textContent).toContain("no se pudo guardar");
  });

  it("retires an older failed value when a newer value for that preference is saved", async () => {
    const patches: unknown[] = [];
    tauri.invoke.mockImplementation(async (command, args) => {
      if (command !== "update_preferences") return snapshot();
      patches.push(args);
      if (patches.length === 1) throw { code: "preferences.writeFailed", params: {} };
      return snapshot({ theme: "light", locale: patches.length > 2 ? "es" : null });
    });
    mountProvider();
    await flush();
    click("dark");
    await flush();
    click("light");
    await flush();
    click("spanish");
    await flush();
    expect(patches).toEqual([
      { patch: { theme: "dark" } },
      { patch: { theme: "light" } },
      { patch: { locale: "es" } },
    ]);
    expect(state()).toMatchObject({ theme: "light", locale: "es" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("theme transition", () => {
  it("animates only a user-initiated change, briefly", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    tauri.native = false;
    mountProvider();
    expect(root.classList.contains("pc-theme-transition")).toBe(false);
    click("dark");
    expect(root.classList.contains("pc-theme-transition")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(root.classList.contains("pc-theme-transition")).toBe(false);
    expect(root.dataset.theme).toBe("dark");
  });

  it("does not animate when reduced motion is requested", () => {
    tauri.native = false;
    system.reduced = true;
    mountProvider();
    click("dark");
    expect(root.classList.contains("pc-theme-transition")).toBe(false);
    expect(root.dataset.theme).toBe("dark");
  });

  it("does not animate a system appearance change", () => {
    tauri.native = false;
    mountProvider();
    setSystemDark(true);
    expect(root.dataset.theme).toBe("dark");
    expect(root.classList.contains("pc-theme-transition")).toBe(false);
  });
});

describe("independence from the document", () => {
  function DocumentHarness() {
    const [session] = useState(() => {
      const created = createDocument({
        documentId: "11111111-1111-4111-8111-111111111111",
        pageId: "22222222-2222-4222-8222-222222222222",
        layerId: "33333333-3333-4333-8333-333333333333",
        title: "Diagrama de prueba",
        now: "2026-11-13T00:00:00.000Z",
      });
      if (!created.ok) throw new Error("fixture document is invalid");
      return { model: created.value, history: createDocumentHistory(), dirty: { value: false } };
    });
    const preferences = usePreferences();
    return (
      <div>
        <button onClick={() => preferences.setTheme("dark")}>dark</button>
        <button onClick={() => preferences.setLocale("es")}>spanish</button>
        <output data-testid="doc">
          {JSON.stringify({
            bytes: serializeDocument(session.model.document),
            revision: session.model.revision,
            canUndo: session.history.canUndo,
            canRedo: session.history.canRedo,
            dirty: session.dirty.value,
          })}
        </output>
      </div>
    );
  }

  it("leaves document bytes, revision, dirty state and history untouched by theme and language changes", async () => {
    render(
      <PreferencesProvider>
        <DocumentHarness />
      </PreferencesProvider>,
    );
    await flush();
    const before = screen.getByTestId("doc").textContent;
    expect(before).toContain("Diagrama de prueba");
    click("dark");
    await flush();
    click("spanish");
    await flush();
    expect(screen.getByTestId("doc").textContent).toBe(before);
    expect(root.dataset.theme).toBe("dark");
    expect(root.lang).toBe("es");
  });
});
