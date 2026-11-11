import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type WeaveCanvas from "./canvas/WeaveCanvas";
import { serializeDocument } from "./document";
import { createSample } from "./editor/sample";
import type { LocalDocumentCandidate } from "./editor/local-document-files";
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
});

function storedDocument() {
  const serialized = serializeDocument(createSample().document);
  if (!serialized.ok) throw new Error("Sample document did not serialize.");
  return serialized.value;
}

function expectEditingBlocked() {
  const document = canvas.props!.document!;
  const node = document.pages[0].layers[0].nodes[0];
  const workspace = screen.getByRole("main").querySelector(".pc-workspace")!;
  const saves = files.save.mock.calls.length;
  expect(workspace.hasAttribute("inert")).toBe(true);
  expect(workspace.getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  const fileActions = within(screen.getByRole("group", { name: "Document file actions" }));
  for (const name of ["New", "Open", "Save", "Save as", "Close"]) {
    expect(fileActions.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
  }
  fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
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
  it("renders the product name", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "PeerCanvas" })).toBeTruthy();
  });

  it("labels the file controls and disables native file actions in a browser", () => {
    render(<App />);
    const files = within(screen.getByRole("group", { name: "Document file actions" }));

    expect(files.getByRole("button", { name: "New" }).hasAttribute("disabled")).toBe(false);
    for (const name of ["Open", "Reopen last", "Save", "Save as"]) {
      expect(files.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("creates and closes in-memory documents without native file access in a browser", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.getByText("New document created.")).toBeTruthy());
    expect(files.close).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.getByText("Document closed.")).toBeTruthy());
    expect(files.close).not.toHaveBeenCalled();
  });

  it("exposes document-title editing as a labelled form", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Rename document" }));

    expect(screen.getByRole("textbox", { name: "Document title" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save title" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel rename" })).toBeTruthy();
  });

  it("blocks mutations and history while replacement is requested or opening", async () => {
    files.available = true;
    let finishOpen!: (candidate: LocalDocumentCandidate) => void;
    files.open.mockReturnValue(new Promise((resolve) => (finishOpen = resolve)));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    const current = canvas.props!.document;
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expectEditingBlocked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(false);
    expect(canvas.props!.document).toBe(current);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(files.open).toHaveBeenCalledOnce();
    expectEditingBlocked();
    await act(async () => {
      finishOpen({
        token: "opened",
        displayName: "opened.peercanvas",
        primaryText: storedDocument(),
        backupText: null,
      });
    });

    expect(screen.getByRole("main").querySelector(".pc-workspace")!.hasAttribute("inert")).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
    const count = canvas.props!.document!.pages[0].layers[0].nodes.length;
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Saved locally")).toBeTruthy());
    const current = canvas.props!.document;
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("button", { name: "Recover backup" });
    expectEditingBlocked();
    fireEvent.click(screen.getByRole("button", { name: "Keep current document" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Recover backup" })).toBeNull(),
    );
    expect(canvas.props!.document).toBe(current);
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("button", { name: "Recover backup" });
    let finishRecovery!: () => void;
    files.acceptOpen.mockReturnValue(new Promise<void>((resolve) => (finishRecovery = resolve)));
    fireEvent.click(screen.getByRole("button", { name: "Recover backup" }));
    expectEditingBlocked();
    await act(async () => finishRecovery());

    expect(screen.getByText("Recovered · save as")).toBeTruthy();
    expect(screen.getByRole("main").querySelector(".pc-workspace")!.hasAttribute("inert")).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  });
});
