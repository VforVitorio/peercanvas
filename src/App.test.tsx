import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type WeaveCanvas from "./canvas/WeaveCanvas";
import { serializeDocument } from "./document";
import { createSample } from "./editor/sample";
import type { LocalDocumentCandidate } from "./editor/local-document-files";
import { createTranslator } from "./i18n/translator";
import App from "./App";

const canvas = vi.hoisted(() => ({ props: null as ComponentProps<typeof WeaveCanvas> | null }));
const files = vi.hoisted(() => ({
  available: false,
  recentName: vi.fn(),
  loadRecent: vi.fn(),
  open: vi.fn(),
  acceptOpen: vi.fn(),
  discardOpen: vi.fn(),
  save: vi.fn(),
  importDrawio: vi.fn(),
  prepareDrawioExport: vi.fn(),
  exportDrawio: vi.fn(),
  discardDrawioExport: vi.fn(),
  close: vi.fn(),
}));

vi.mock("./canvas/WeaveCanvas", () => ({
  default: (props: ComponentProps<typeof WeaveCanvas>) => {
    canvas.props = props;
    return <div />;
  },
}));
vi.mock("./editor/local-document-files", () => ({ localDocumentFiles: files }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onCloseRequested: async () => vi.fn() }),
}));

const en = createTranslator("en");
const es = createTranslator("es");
const { t } = en;
const rectangle = () => t("editor.shapes.add", { name: t("editor.defaults.rectangle") });
const originalLanguages = Object.getOwnPropertyDescriptor(Navigator.prototype, "languages");

function setSystemLanguages(languages: string[]) {
  Object.defineProperty(navigator, "languages", { configurable: true, get: () => languages });
  act(() => {
    window.dispatchEvent(new Event("languagechange"));
  });
}

/** Viewport emulation for the responsive breakpoints (min-width queries only). */
function setViewport(width: number) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      return {
        matches: min ? width >= Number(min[1]) : false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      };
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  files.available = false;
  files.recentName.mockResolvedValue(null);
  files.open.mockResolvedValue(null);
  files.acceptOpen.mockResolvedValue(true);
  files.discardOpen.mockResolvedValue(undefined);
  files.save.mockResolvedValue({
    displayName: "diagram.peercanvas",
    warning: null,
    recentUpdated: true,
  });
  files.discardDrawioExport.mockResolvedValue(undefined);
  files.close.mockResolvedValue(undefined);
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(navigator, "languages");
  if (originalLanguages) Object.defineProperty(Navigator.prototype, "languages", originalLanguages);
  document.documentElement.lang = "";
  delete document.documentElement.dataset.theme;
});

function storedDocument() {
  const serialized = serializeDocument(createSample().document);
  if (!serialized.ok) throw new Error("Sample document did not serialize.");
  return serialized.value;
}

const workspace = () => screen.getByRole("main").querySelector(".pc-workspace")!;
const fileMenuTrigger = () => screen.getByRole("button", { name: t("documents.menu.file") });
function openFileMenu() {
  fireEvent.click(fileMenuTrigger());
  return within(screen.getByRole("menu"));
}
function chooseFile(key: string) {
  openFileMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: t(key) }));
}
function addRectangle() {
  fireEvent.click(screen.getByRole("tab", { name: t("editor.tabs.shapes") }));
  fireEvent.click(screen.getByRole("button", { name: rectangle() }));
}

function expectEditingBlocked() {
  const document = canvas.props!.document!;
  const node = document.pages[0].layers[0].nodes[0];
  const saves = files.save.mock.calls.length;
  expect(workspace().hasAttribute("inert")).toBe(true);
  expect(workspace().getAttribute("aria-busy")).toBe("true");
  expect(
    screen.getByRole("button", { name: t("editor.header.undo") }).hasAttribute("disabled"),
  ).toBe(true);
  expect(fileMenuTrigger().hasAttribute("disabled")).toBe(true);
  const header = within(screen.getByRole("banner"));
  expect(
    header.getByRole("button", { name: t("editor.header.save") }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: rectangle() }));
  act(() => {
    expect(
      canvas.props!.onCommitGeometry!(node.nodeId, { ...node.geometry, x: node.geometry.x + 10 }),
    ).toBe(false);
  });
  for (const key of ["z", "y", "s"]) {
    fireEvent.keyDown(screen.getByRole("main"), { key, ctrlKey: true });
  }
  expect(canvas.props!.document).toBe(document);
  expect(files.save).toHaveBeenCalledTimes(saves);
}

describe("application shell", () => {
  it("renders the product name and the real document state", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "PeerCanvas" })).toBeTruthy();
    const state = screen.getByRole("main").querySelector(".pc-document-status")!;
    expect(state.getAttribute("data-state")).toBe("dirty");
    expect(state.textContent).toBe(t("documents.status.unsaved"));
  });

  it("offers the File actions and disables native ones in a browser", () => {
    render(<App />);
    const menu = openFileMenu();
    expect(
      menu.getByRole("menuitem", { name: t("documents.menu.new") }).hasAttribute("disabled"),
    ).toBe(false);
    for (const key of [
      "documents.menu.open",
      "documents.menu.reopen",
      "documents.menu.save",
      "documents.menu.saveAs",
      "documents.menu.importDrawio",
      "documents.menu.exportDrawio",
    ]) {
      expect(menu.getByRole("menuitem", { name: t(key) }).hasAttribute("disabled")).toBe(true);
    }
    expect(
      menu.getByRole("menuitem", { name: t("documents.menu.close") }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("operates the File menu with the keyboard and restores focus", () => {
    render(<App />);
    const trigger = fileMenuTrigger();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    const newItem = screen.getByRole("menuitem", { name: t("documents.menu.new") });
    const closeItem = screen.getByRole("menuitem", { name: t("documents.menu.close") });
    expect(document.activeElement).toBe(newItem);
    // Disabled native items are skipped in a browser.
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(closeItem);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(newItem);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(closeItem);
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("creates and closes in-memory documents without native file access in a browser", async () => {
    render(<App />);
    addRectangle();
    chooseFile("documents.menu.new");
    fireEvent.click(screen.getByRole("button", { name: t("documents.unsaved.discard") }));
    await waitFor(() => expect(screen.getByText(t("documents.feedback.created"))).toBeTruthy());
    expect(canvas.props!.document!.metadata.title).toBe(t("documents.untitledTitle"));
    expect(files.close).not.toHaveBeenCalled();

    addRectangle();
    chooseFile("documents.menu.close");
    fireEvent.click(screen.getByRole("button", { name: t("documents.unsaved.discard") }));
    await waitFor(() => expect(screen.getByText(t("documents.feedback.closed"))).toBeTruthy());
    expect(files.close).not.toHaveBeenCalled();
  });

  it("creates a clean Spanish document with localized initial page and layer names", async () => {
    setSystemLanguages(["es-ES"]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: es.t("documents.menu.file") }));
    fireEvent.click(screen.getByRole("menuitem", { name: es.t("documents.menu.new") }));
    fireEvent.click(screen.getByRole("button", { name: es.t("documents.unsaved.discard") }));
    await waitFor(() =>
      expect(canvas.props!.document!.metadata.title).toBe(es.t("documents.untitledTitle")),
    );

    const document = canvas.props!.document!;
    expect(document.pages[0].name).toBe(es.t("editor.defaults.page", { number: 1 }));
    expect(document.pages[0].layers[0].name).toBe(es.t("editor.defaults.layer", { number: 1 }));
    expect(
      screen.getByRole("main").querySelector(".pc-document-status")!.getAttribute("data-state"),
    ).toBe("new");
    expect(
      screen.getByRole("button", { name: es.t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("edits the document title through a labelled form and restores focus", () => {
    render(<App />);
    const title = canvas.props!.document!.metadata.title;
    const rename = screen.getByRole("button", {
      name: t("documents.rename.titleLabel", { title }),
    });
    fireEvent.click(rename);
    const input = screen.getByRole("textbox", { name: t("documents.rename.label") });
    expect(screen.getByRole("button", { name: t("documents.rename.save") })).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(canvas.props!.document!.metadata.title).toBe(title);
    const restored = screen.getByRole("button", {
      name: t("documents.rename.titleLabel", { title }),
    });
    expect(document.activeElement).toBe(restored);

    fireEvent.click(restored);
    fireEvent.change(screen.getByRole("textbox", { name: t("documents.rename.label") }), {
      target: { value: "Roadmap" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("documents.rename.save") }));
    expect(canvas.props!.document!.metadata.title).toBe("Roadmap");
  });

  it("accepts titles up to the canonical Unicode code point limit", () => {
    render(<App />);
    const original = canvas.props!.document!;
    const title = "😀".repeat(200);
    fireEvent.click(
      screen.getByRole("button", {
        name: t("documents.rename.titleLabel", { title: original.metadata.title }),
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: t("documents.rename.label") }), {
      target: { value: title },
    });
    fireEvent.click(screen.getByRole("button", { name: t("documents.rename.save") }));
    expect(canvas.props!.document!.metadata.title).toBe(title);

    fireEvent.click(
      screen.getByRole("button", { name: t("documents.rename.titleLabel", { title }) }),
    );
    const invalidTitle = "😀".repeat(257);
    fireEvent.change(screen.getByRole("textbox", { name: t("documents.rename.label") }), {
      target: { value: invalidTitle },
    });
    const beforeInvalidRename = canvas.props!.document;
    fireEvent.click(screen.getByRole("button", { name: t("documents.rename.save") }));
    expect(canvas.props!.document).toBe(beforeInvalidRename);
    expect(canvas.props!.document!.metadata.title).toBe(title);
  });

  it("blocks mutations and history while replacement is requested or opening", async () => {
    files.available = true;
    let finishOpen!: (candidate: LocalDocumentCandidate) => void;
    files.open.mockReturnValue(new Promise((resolve) => (finishOpen = resolve)));
    render(<App />);
    addRectangle();
    const current = canvas.props!.document;
    chooseFile("documents.menu.open");
    expectEditingBlocked();
    fireEvent.click(screen.getByRole("button", { name: t("documents.unsaved.cancel") }));
    expect(
      screen.getByRole("button", { name: t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(false);
    expect(canvas.props!.document).toBe(current);

    chooseFile("documents.menu.open");
    fireEvent.click(screen.getByRole("button", { name: t("documents.unsaved.discard") }));
    expect(files.open).toHaveBeenCalledOnce();
    expectEditingBlocked();
    expect(
      screen.getByRole("main").querySelector(".pc-document-status")!.getAttribute("data-state"),
    ).toBe("busy");
    await act(async () => {
      finishOpen({
        token: "opened",
        displayName: "opened.peercanvas",
        primaryText: storedDocument(),
        backupText: null,
      });
    });

    expect(workspace().hasAttribute("inert")).toBe(false);
    expect(
      screen.getByRole("button", { name: t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(true);
    const count = canvas.props!.document!.pages[0].layers[0].nodes.length;
    addRectangle();
    expect(canvas.props!.document!.pages[0].layers[0].nodes).toHaveLength(count + 1);
  });

  it("blocks edits throughout a backup decision and its asynchronous acceptance", async () => {
    files.available = true;
    files.open.mockResolvedValue({
      token: "backup",
      displayName: "damaged.peercanvas",
      primaryText: "{broken",
      backupText: storedDocument(),
    });
    render(<App />);
    addRectangle();
    fireEvent.click(screen.getByRole("button", { name: t("editor.header.save") }));
    await waitFor(() => expect(screen.getByText(t("documents.status.saved"))).toBeTruthy());
    const current = canvas.props!.document;
    chooseFile("documents.menu.open");
    await screen.findByRole("button", { name: t("documents.recovery.recover") });
    // The specific reason precedes the recovery explanation.
    expect(screen.getByText(new RegExp(t("editor.diagnostics.invalidJson")))).toBeTruthy();
    expectEditingBlocked();
    fireEvent.click(screen.getByRole("button", { name: t("documents.recovery.keep") }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t("documents.recovery.recover") })).toBeNull(),
    );
    expect(canvas.props!.document).toBe(current);
    expect(
      screen.getByRole("button", { name: t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(false);

    chooseFile("documents.menu.open");
    await screen.findByRole("button", { name: t("documents.recovery.recover") });
    let finishRecovery!: () => void;
    files.acceptOpen.mockReturnValue(new Promise<void>((resolve) => (finishRecovery = resolve)));
    fireEvent.click(screen.getByRole("button", { name: t("documents.recovery.recover") }));
    expectEditingBlocked();
    await act(async () => finishRecovery());

    expect(screen.getByText(t("documents.status.recovered"))).toBeTruthy();
    expect(workspace().hasAttribute("inert")).toBe(false);
    expect(
      screen.getByRole("button", { name: t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows a native save failure as a translated persistent error", async () => {
    files.available = true;
    files.save.mockRejectedValue({ code: "file.permissionDenied", params: {} });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: t("editor.header.save") }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        en.message({ code: "file.permissionDenied", params: {} }),
      ),
    );
  });

  it("keeps help read-only, contains document shortcuts, and restores focus", () => {
    render(<App />);
    addRectangle();
    const before = JSON.stringify(canvas.props!.document);
    const help = screen.getByRole("button", { name: t("editor.header.help") });
    help.focus();
    fireEvent.click(help);
    const dialog = screen.getByRole("dialog", { name: t("editor.help.title") });
    const close = within(dialog).getByRole("button", { name: t("editor.help.close") });
    expect(dialog.contains(document.activeElement)).toBe(true);
    // A focused dialog button must not run document shortcuts.
    close.focus();
    for (const key of ["z", "y", "s", "n"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      close.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(JSON.stringify(canvas.props!.document)).toBe(before);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(help);
    expect(JSON.stringify(canvas.props!.document)).toBe(before);
  });

  it("changes language and theme without touching document bytes, revision, dirty state, history, or drafts", () => {
    render(<App />);
    addRectangle();
    fireEvent.click(screen.getByRole("tab", { name: t("editor.tabs.structure") }));
    fireEvent.click(screen.getByRole("button", { name: /Idea/ }));
    // A pending draft and a pending error, both of which must survive the switch.
    fireEvent.change(screen.getByLabelText(t("editor.inspector.width")), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.applyGeometry") }));
    fireEvent.change(screen.getByLabelText(t("editor.inspector.height")), {
      target: { value: "777" },
    });
    const bytes = serializeDocument(canvas.props!.document);
    const revision = document.querySelector("[data-revision]")!.getAttribute("data-revision");
    const state = () =>
      screen.getByRole("main").querySelector(".pc-document-status")!.getAttribute("data-state");
    const dirty = state();
    const selection = canvas.props!.selection;

    const preferences = screen.getByRole("button", { name: t("editor.header.preferences") });
    preferences.focus();
    fireEvent.click(preferences);
    fireEvent.click(screen.getByRole("radio", { name: t("common.preferences.language.es") }));
    fireEvent.click(screen.getByRole("radio", { name: es.t("common.preferences.theme.dark") }));
    fireEvent.click(screen.getByRole("button", { name: es.t("common.close") }));

    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(serializeDocument(canvas.props!.document)).toEqual(bytes);
    expect(document.querySelector("[data-revision]")!.getAttribute("data-revision")).toBe(revision);
    expect(state()).toBe(dirty);
    expect(canvas.props!.selection).toBe(selection);
    expect(
      screen.getByRole("button", { name: es.t("editor.header.undo") }).hasAttribute("disabled"),
    ).toBe(false);
    expect((screen.getByLabelText(es.t("editor.inspector.height")) as HTMLInputElement).value).toBe(
      "777",
    );
    // The existing error is re-rendered in the selected language.
    expect(screen.getByRole("alert").textContent).toBe(es.t("editor.diagnostics.invalidGeometry"));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: es.t("editor.header.preferences") }),
    );
    // User-authored text is never translated.
    expect(screen.getByRole("button", { name: /Idea/ })).toBeTruthy();
  });

  it("retranslates an open draw.io loss review in full when the language changes", async () => {
    files.available = true;
    const losses = [
      { code: "drawio.unsupportedElement", params: { name: "custom" } },
      { code: "drawio.lossesTruncated", params: {} },
    ];
    files.importDrawio.mockResolvedValue({
      displayName: "source.drawio",
      document: createSample().document,
      losses,
      preservedFragmentCount: 0,
    });
    render(<App />);
    chooseFile("documents.menu.importDrawio");
    fireEvent.click(screen.getByRole("button", { name: t("documents.unsaved.discard") }));
    const dialog = await screen.findByRole("alertdialog");
    const items = () =>
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    expect(items()).toEqual(losses.map((loss) => en.message(loss)));
    setSystemLanguages(["es-ES"]);
    expect(items()).toEqual(losses.map((loss) => es.message(loss)));
    expect(es.message(losses[0])).toContain("custom");
  });

  it("uses drawers below 1024 px and keeps the keyboard path inside an open drawer", () => {
    setViewport(700);
    render(<App />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-layout")).toBe("narrow");
    const left = main.querySelector<HTMLElement>("#pc-left-panel")!;
    const right = main.querySelector<HTMLElement>("#pc-inspector")!;
    expect(left.hasAttribute("inert")).toBe(true);
    expect(right.hasAttribute("inert")).toBe(true);
    const before = JSON.stringify(canvas.props!.document);

    const toggle = screen.getByRole("button", { name: t("editor.panels.openLeft") });
    expect(toggle.getAttribute("aria-controls")).toBe("pc-left-panel");
    fireEvent.click(toggle);
    expect(left.getAttribute("data-open")).toBe("true");
    expect(left.hasAttribute("inert")).toBe(false);
    expect(main.querySelector(".pc-header")!.hasAttribute("inert")).toBe(true);
    expect(main.querySelector(".pc-canvas-panel")!.hasAttribute("inert")).toBe(true);
    expect(right.hasAttribute("inert")).toBe(true);
    const close = within(left).getByRole("button", { name: t("editor.panels.closeLeft") });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: "Escape" });
    expect(left.getAttribute("data-open")).toBe("false");
    expect(left.hasAttribute("inert")).toBe(true);
    expect(main.querySelector(".pc-canvas-panel")!.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(screen.getByRole("button", { name: t("editor.panels.openRight") }));
    expect(right.getAttribute("data-open")).toBe("true");
    fireEvent.click(main.querySelector(".pc-drawer-scrim")!);
    expect(right.getAttribute("data-open")).toBe("false");
    expect(JSON.stringify(canvas.props!.document)).toBe(before);
  });

  it("keeps the inspector as a column between 760 and 1023 px", () => {
    setViewport(900);
    render(<App />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-layout")).toBe("compact");
    expect(screen.getByRole("button", { name: t("editor.panels.openLeft") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("editor.panels.openRight") })).toBeNull();
    expect(main.querySelector("#pc-inspector")!.hasAttribute("inert")).toBe(false);
  });

  it("shows permanent panels without drawer controls on wide windows", () => {
    setViewport(1440);
    render(<App />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("data-layout")).toBe("wide");
    expect(screen.queryByRole("button", { name: t("editor.panels.openLeft") })).toBeNull();
    expect(main.querySelector("#pc-left-panel")!.hasAttribute("inert")).toBe(false);
  });
});
