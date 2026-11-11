import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoveNodeRequest } from "../services/demo-service";
import { harness } from "./test/weaveMock";
import type { CanonicalDocument } from "./types";
import App from "./App";

/** Props the workspace hands to the canvas adapter; captured to observe the agreed wiring. */
interface CanvasProps {
  document: CanonicalDocument;
  pageId: string;
  layerId: string;
  selection: string | null;
  revision: number;
  role: "editor" | "viewer";
  onMoveNode: (request: MoveNodeRequest) => boolean;
}
const captured = vi.hoisted(() => ({ props: null as unknown }));
const canvasProps = () => captured.props as CanvasProps;

// The real adapter still renders (on the Weave test double); only its props are recorded so a
// renderer drag release can be replayed through the exact callback the workspace supplied.
vi.mock("./WeaveCanvas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./WeaveCanvas")>();
  const { forwardRef, createElement } = await import("react");
  const CapturedCanvas = forwardRef<unknown, Record<string, unknown>>(
    function CapturedCanvas(props, ref) {
      captured.props = props;
      return createElement(actual.default as never, { ...props, ref });
    },
  );
  return { ...actual, default: CapturedCanvas };
});

vi.mock("@inditextech/weave-sdk", async () => (await import("./test/weaveMock")).sdk);
vi.mock(
  "@inditextech/weave-renderer-konva-base",
  async () => (await import("./test/weaveMock")).renderer,
);
vi.mock(
  "@inditextech/weave-store-standalone/client",
  async () => (await import("./test/weaveMock")).store,
);

const SLOW = { timeout: 3000 };

beforeEach(() => {
  harness.reset();
  captured.props = null;
});
afterEach(() => cleanup());

async function openFixture(title = "Product architecture", strict = false) {
  render(
    strict ? (
      <StrictMode>
        <App />
      </StrictMode>
    ) : (
      <App />
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }));
  await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
}

const outline = () => within(screen.getByRole("complementary", { name: "Document structure" }));
const saveStatus = () => screen.getByTestId("save-status").textContent;

function chooseOutcome(value: "success" | "wait" | "cancel" | "error") {
  fireEvent.change(screen.getByLabelText("Outcome"), { target: { value } });
}

function menuItem(menu: string, item: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: menu }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

describe("failed or cancelled replacement keeps the current workspace", () => {
  it("does not leave the workspace when closing fails", async () => {
    await openFixture();
    chooseOutcome("error");
    menuItem("File", /Close document/);
    await screen.findByRole("alert", { name: "Open operation" }, SLOW);
    expect(screen.getByRole("region", { name: /Diagram canvas/ })).toBeTruthy();
    expect(outline().getByRole("button", { name: "Rectangle “Web client”" })).toBeTruthy();
  });

  it("closes normally on success and returns home", async () => {
    await openFixture();
    menuItem("File", /Close document/);
    await waitFor(
      () => expect(screen.queryByRole("region", { name: /Diagram canvas/ })).toBeNull(),
      SLOW,
    );
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);
  });

  it("keeps the dirty document when closing is cancelled in the decision dialog", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    menuItem("File", /Close document/);
    const dialog = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(saveStatus()).toBe("Unsaved changes");
    expect(screen.getByRole("region", { name: /Diagram canvas/ })).toBeTruthy();
  });

  it("stays in the workspace when Save-then-close fails", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    chooseOutcome("error");
    menuItem("File", /Close document/);
    const dialog = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));
    await screen.findByRole("alert", { name: "Save operation" }, SLOW);
    expect(screen.getByRole("region", { name: /Diagram canvas/ })).toBeTruthy();
    expect(saveStatus()).toBe("Unsaved changes");
  });
});

describe("canvas replacement", () => {
  it("survives rapid edits while the replacement renderer has no stage yet", async () => {
    await openFixture();
    for (let i = 0; i < 3; i += 1)
      fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    expect(screen.getByRole("region", { name: /Diagram canvas/ })).toBeTruthy();
    await waitFor(() => expect(harness.latest().stage.scaleValue.x).toBe(1), SLOW);
    expect(outline().getAllByRole("button", { name: /^Rectangle/ })).toHaveLength(7);
  });
});

describe("simulated waiting, cancellation and unmount", () => {
  it("shows a waiting save, can continue it, and then reports saved", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    chooseOutcome("wait");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const panel = await screen.findByRole("status", { name: "Save operation" }, SLOW);
    expect(panel.textContent).toMatch(/Waiting for you/);
    expect(saveStatus()).toBe("Unsaved changes");
    fireEvent.click(within(panel).getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(saveStatus()).toMatch(/Saved in memory/), SLOW);
  });

  it("cancelling a waiting save leaves the document unsaved", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    chooseOutcome("wait");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const panel = await screen.findByRole("status", { name: "Save operation" }, SLOW);
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel save" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Save operation" }).textContent).toMatch(
        /Cancelled/,
      ),
    );
    expect(saveStatus()).toBe("Unsaved changes");
  });

  it("works under StrictMode and cancels pending timers on unmount without errors", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await openFixture("Product architecture", true);
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    expect(saveStatus()).toBe("Unsaved changes");
    chooseOutcome("wait");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("status", { name: "Save operation" }, SLOW);
    cleanup();
    // Let any leaked timer fire; nothing may throw or log a React unmounted-update warning.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("proposals and explicit approval", () => {
  const panel = () => within(screen.getByRole("complementary", { name: "Assistant & MCP" }));

  it("loads an MCP-sourced proposal only after an explicit request, then applies it once", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    fireEvent.click(panel().getByRole("radio", { name: "MCP client" }));
    expect(panel().queryByRole("region", { name: "Proposed change" })).toBeNull();
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    const approve = await panel().findByRole("button", { name: "Approve and apply" }, SLOW);
    expect(outline().queryByRole("button", { name: /Review queue/ })).toBeNull();
    expect(panel().getByText(/simulated MCP client/)).toBeTruthy();
    fireEvent.click(approve);
    expect(outline().getAllByRole("button", { name: /Review queue/ })).toHaveLength(1);
    expect(saveStatus()).toBe("Unsaved changes");
  });

  it("marks a proposal stale after the document changes and refuses to apply it", async () => {
    await openFixture("Service blueprint");
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() =>
      expect(panel().queryByRole("button", { name: "Approve and apply" })).toBeNull(),
    );
    expect(panel().getByText(/no longer be applied/)).toBeTruthy();
    expect(outline().queryByRole("button", { name: /Review queue/ })).toBeNull();
  });

  it("shows assistant errors and supports cancelling a waiting request", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    chooseOutcome("error");
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    await waitFor(
      () =>
        expect(
          panel()
            .getAllByRole("status")
            .some((n) => /Error/.test(n.textContent ?? "")),
        ).toBe(true),
      SLOW,
    );
    expect(panel().queryByRole("region", { name: "Proposed change" })).toBeNull();

    chooseOutcome("wait");
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    const cancel = await panel().findByRole("button", { name: "Cancel" }, SLOW);
    fireEvent.click(cancel);
    await waitFor(
      () =>
        expect(
          panel()
            .getAllByRole("status")
            .some((n) => /Cancelled/.test(n.textContent ?? "")),
        ).toBe(true),
      SLOW,
    );
    expect(panel().queryByRole("region", { name: "Proposed change" })).toBeNull();
  });

  it("applies an approved import exactly once", async () => {
    await openFixture();
    menuItem("File", /Import/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    const preview = await screen.findByRole("region", { name: "Import preview" }, SLOW);
    expect(outline().queryByRole("button", { name: /Imported service/ })).toBeNull();
    fireEvent.click(within(preview).getByRole("button", { name: "Apply import" }));
    expect(outline().getAllByRole("button", { name: /Imported service/ })).toHaveLength(1);
    expect(within(preview).queryByRole("button", { name: "Apply import" })).toBeNull();
  });

  it("cancelling a waiting import never produces a preview", async () => {
    await openFixture();
    chooseOutcome("cancel");
    menuItem("File", /Import/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    await waitFor(
      () =>
        expect(screen.getByRole("status", { name: "Import operation" }).textContent).toMatch(
          /Cancelled/,
        ),
      SLOW,
    );
    expect(screen.queryByRole("region", { name: "Import preview" })).toBeNull();
  });
});

describe("viewer role and collaboration", () => {
  it("rejects deletion and proposal approval as a viewer, and re-enables as editor", async () => {
    await openFixture("Service blueprint");
    fireEvent.click(screen.getByRole("button", { name: "Collaboration" }));
    fireEvent.click(screen.getByRole("radio", { name: /Viewer \(mutations are rejected\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    const panel = within(screen.getByRole("complementary", { name: "Assistant & MCP" }));
    fireEvent.click(panel.getByRole("button", { name: "Approve and apply" }));
    expect((await screen.findByTestId("service-notice")).textContent).toMatch(/Viewer|viewer/);
    expect(outline().queryByRole("button", { name: /Review queue/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Collaboration" }));
    fireEvent.click(screen.getByRole("radio", { name: /Editor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    await waitFor(() => expect(saveStatus()).toBe("Unsaved changes"));
  });
});

describe("focus and keyboard", () => {
  it("moves focus to the main region after opening a document", async () => {
    await openFixture();
    await waitFor(() => expect(document.activeElement?.id).toBe("pc-main"));
  });

  it("opens the shortcuts dialog with ? and restores focus when closed with Escape", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(window, { key: "?" });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button").length).toBeGreaterThan(0);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports Ctrl+Z / Ctrl+Y and explains empty history", async () => {
    await openFixture();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("ui-notice").textContent).toMatch(/Nothing to undo/);
    const count = () => outline().queryAllByRole("button", { name: /^Rectangle/ }).length;
    const before = count();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() => expect(count()).toBe(before + 1));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(count()).toBe(before));
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    await waitFor(() => expect(count()).toBe(before + 1));
  });

  it("does not hijack undo while typing in a text field", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    const field = screen.getByLabelText("Label text");
    field.focus();
    fireEvent.keyDown(field, { key: "z", ctrlKey: true });
    expect(screen.queryByTestId("ui-notice")).toBeNull();
    expect(saveStatus()).toBe("Unsaved changes");
  });

  it("changes pages and layers from the outline and keeps zoom bounded", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("tab", { name: /Pages/ }));
    fireEvent.click(outline().getByRole("button", { name: /Data flow/ }));
    fireEvent.click(outline().getByRole("tab", { name: /Outline|Structure/ }));
    expect(outline().getByRole("button", { name: "Rectangle “Input”" })).toBeTruthy();
    expect(outline().queryByRole("button", { name: "Rectangle “Web client”" })).toBeNull();
    fireEvent.click(outline().getByRole("tab", { name: /Layers/ }));
    expect(outline().getByRole("list", { name: "Layers" })).toBeTruthy();
    for (let i = 0; i < 12; i += 1)
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByRole("button", { name: /Zoom 25%/ })).toBeTruthy();
    act(() => undefined);
  });
});

const selectionStatus = () => screen.getByTestId("selection-status").textContent;
const notice = () => screen.getByTestId("ui-notice").textContent;
const zoomLabel = () => screen.getByRole("button", { name: /^Zoom \d+%/ }).textContent;
const live = () => screen.getByTestId("live").textContent;

function moveRequest(
  label: string,
  x: number,
  y: number,
  expectedRevision = canvasProps().revision,
): MoveNodeRequest {
  const props = canvasProps();
  const page = props.document.pages.find((candidate) => candidate.pageId === props.pageId);
  const layer = page?.layers.find((candidate) => candidate.layerId === props.layerId);
  const node = layer?.nodes.find((candidate) => candidate.text === label);
  if (!node) throw new Error(`No “${label}” in the active layer`);
  return {
    documentId: props.document.documentId,
    pageId: props.pageId,
    layerId: props.layerId,
    nodeId: node.nodeId,
    x,
    y,
    expectedRevision,
  };
}

function replayMove(request: MoveNodeRequest): boolean {
  let accepted = false;
  act(() => {
    accepted = canvasProps().onMoveNode(request);
  });
  return accepted;
}

describe("node move release through the canonical service", () => {
  it("applies an accepted release as one undoable edit and selects the moved shape", async () => {
    await openFixture();
    expect(canvasProps().role).toBe("editor");
    const revision = canvasProps().revision;
    expect(selectionStatus()).toBe("No selection");

    expect(replayMove(moveRequest("Web client", 300, 140))).toBe(true);
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(300));
    expect(harness.latest().nodeByLabel("Web client")?.y).toBe(140);
    expect(canvasProps().revision).toBe(revision + 1);
    expect(saveStatus()).toBe("Unsaved changes");
    expect(selectionStatus()).toContain("Web client");
    await waitFor(() => expect(live()).toMatch(/Moved .*Web client.* to 300, 140/));

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(100));
    expect(canvasProps().revision).toBeGreaterThan(revision);
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(300));
  });

  it("rejects a stale release, keeps the document, and preserves the current selection", async () => {
    await openFixture();
    const stale = moveRequest("Web client", 500, 500);
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() => expect(canvasProps().revision).toBe(stale.expectedRevision + 1));
    fireEvent.click(outline().getByRole("button", { name: "Rectangle “API gateway”" }));
    const revision = canvasProps().revision;

    expect(replayMove(stale)).toBe(false);
    expect((await screen.findByTestId("service-notice")).textContent).toMatch(
      /document has changed/,
    );
    expect(harness.latest().nodeByLabel("Web client")?.x).toBe(100);
    expect(canvasProps().revision).toBe(revision);
    expect(selectionStatus()).toContain("API gateway");
    await waitFor(() => expect(live()).toMatch(/Move rejected/));
  });

  it("denies a release as a viewer and exposes the role to the canvas", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Collaboration" }));
    fireEvent.click(screen.getByRole("radio", { name: /Viewer \(mutations are rejected\)/ }));
    expect(canvasProps().role).toBe("viewer");
    const request = moveRequest("Web client", 300, 140);

    expect(replayMove(request)).toBe(false);
    expect((await screen.findByTestId("service-notice")).textContent).toMatch(/Viewer permission/);
    expect(harness.latest().nodeByLabel("Web client")?.x).toBe(100);
    expect(saveStatus()).not.toBe("Unsaved changes");

    fireEvent.click(screen.getByRole("radio", { name: /Editor/ }));
    expect(canvasProps().role).toBe("editor");
    expect(replayMove(moveRequest("Web client", 300, 140))).toBe(true);
  });

  it("no longer describes the canvas as unable to move shapes", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help" }));
    const dialog = screen.getByRole("dialog", { name: "About this demonstration" });
    expect(dialog.textContent).toMatch(/drag a shape to move/);
    expect(dialog.textContent).not.toMatch(/read-only projection/i);
  });
});

describe("canvas keyboard paths", () => {
  it("selects with brackets in both directions, clears with Escape, and deletes then undoes", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(canvas, { key: "]" });
    const first = selectionStatus();
    expect(first).not.toBe("No selection");
    fireEvent.keyDown(canvas, { key: "]" });
    const second = selectionStatus();
    expect(second).not.toBe(first);
    fireEvent.keyDown(canvas, { key: "[" });
    expect(selectionStatus()).toBe(first);
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(selectionStatus()).toBe("No selection");

    // "[" with nothing selected wraps to the last element.
    fireEvent.keyDown(canvas, { key: "[" });
    expect(selectionStatus()).not.toBe("No selection");

    const count = () => outline().getAllByRole("button", { name: /^(Rectangle|Text)/ }).length;
    const before = count();
    fireEvent.keyDown(canvas, { key: "Backspace" });
    await waitFor(() => expect(count()).toBe(before - 1));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(count()).toBe(before));
  });

  it("pans with Alt and Alt+Shift arrows without issuing a document command", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(canvas, { key: "]" });
    const selected = selectionStatus();
    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
      fireEvent.keyDown(canvas, { key, altKey: true });
      fireEvent.keyDown(canvas, { key, altKey: true, shiftKey: true });
    }
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
    expect(saveStatus()).not.toBe("Unsaved changes");
    expect(selectionStatus()).toBe(selected);
    expect(harness.latest().nodeByLabel("Web client")?.x).toBe(100);
  });

  it("does not nudge on Ctrl/⌘ + arrows", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(canvas, { key: "]" });
    fireEvent.keyDown(canvas, { key: "ArrowRight", ctrlKey: true });
    fireEvent.keyDown(canvas, { key: "ArrowDown", metaKey: true });
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
  });

  it("leaves keys typed on controls inside the canvas to those controls", async () => {
    await openFixture();
    menuItem("File", /New document/);
    await screen.findByText("This page is empty.", undefined, SLOW);
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    const button = within(canvas).getByRole("button", { name: "Add rectangle" });
    for (const key of ["Delete", "Backspace", "]", "[", "ArrowDown", "Escape"])
      fireEvent.keyDown(button, { key });
    expect(screen.queryByTestId("ui-notice")).toBeNull();
    // Positive control: the same key on the canvas itself is handled and explained.
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(notice()).toMatch(/Select an element first/);
  });
});

describe("global shortcuts", () => {
  it("do not fire while a dialog is open, then work again once it closes", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() => expect(screen.getByText(/Revision 1\b/)).toBeTruthy());
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(window, { key: "?" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Revision 1\b/)).toBeTruthy();
    expect(zoomLabel()).toBe("100%");

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(screen.queryByText(/Revision 1\b/)).toBeNull());
  });

  it("are ignored while typing in a field, including the shortcuts list key", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    const field = screen.getByLabelText("Label text");
    field.focus();
    fireEvent.keyDown(field, { key: "?" });
    fireEvent.keyDown(field, { key: "=", ctrlKey: true });
    fireEvent.keyDown(field, { key: "y", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(zoomLabel()).toBe("100%");
    expect(screen.queryByTestId("ui-notice")).toBeNull();
  });

  it("zoom with Ctrl/⌘ plus, minus, and zero within bounds", async () => {
    await openFixture();
    fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    expect(zoomLabel()).toBe("125%");
    fireEvent.keyDown(window, { key: "-", metaKey: true });
    fireEvent.keyDown(window, { key: "-", metaKey: true });
    expect(zoomLabel()).toBe("75%");
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(zoomLabel()).toBe("100%");
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(zoomLabel()).toBe("400%");
  });

  it("saves with Ctrl/⌘ S and explains when no document is open", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(notice()).toMatch(/Nothing to save/);
    cleanup();

    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    expect(saveStatus()).toBe("Unsaved changes");
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    await waitFor(() => expect(saveStatus()).toMatch(/Saved in memory/), SLOW);
  });
});

describe("shortcut containment", () => {
  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  };

  it("blocks the browser Save dialog while a modal is open without saving or editing", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() => expect(screen.getByText(/Revision 1\b/)).toBeTruthy());
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    for (const init of [{ ctrlKey: true }, { metaKey: true }])
      expect(press({ key: "s", ...init }).defaultPrevented).toBe(true);
    // Native text undo inside a dialog is not blanket-prevented.
    expect(press({ key: "z", ctrlKey: true }).defaultPrevented).toBe(false);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(saveStatus()).toBe("Unsaved changes");
    expect(screen.getByText(/Revision 1\b/)).toBeTruthy();
  });

  it("ignores undo and zoom on Home but keeps the dirty document intact", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() => expect(screen.getByText(/Revision 1\b/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Go to home" }));
    expect(screen.queryByRole("region", { name: /Diagram canvas/ })).toBeNull();
    expect(press({ key: "z", ctrlKey: true }).defaultPrevented).toBe(false);
    press({ key: "y", ctrlKey: true });
    press({ key: "=", ctrlKey: true });
    press({ key: "0", ctrlKey: true });
    expect(screen.queryByTestId("ui-notice")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Return to “Product architecture”/ }));
    await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
    expect(screen.getByText(/Revision 1\b/)).toBeTruthy();
    expect(saveStatus()).toBe("Unsaved changes");
    expect(zoomLabel()).toBe("100%");
  });

  it("leaves Alt+bracket and Alt+Delete/Backspace to the platform, not the diagram", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(canvas, { key: "]" });
    const selected = selectionStatus();
    for (const key of ["[", "]", "Delete", "Backspace"])
      fireEvent.keyDown(canvas, { key, altKey: true });
    expect(selectionStatus()).toBe(selected);
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
    expect(saveStatus()).not.toBe("Unsaved changes");
    expect(screen.queryByTestId("ui-notice")).toBeNull();
    // Positive control: the plain key still deletes.
    fireEvent.keyDown(canvas, { key: "Delete" });
    await waitFor(() => expect(screen.getByText(/Revision 1\b/)).toBeTruthy());
  });
});

describe("every control works or explains why not", () => {
  it("explains unavailable shapes, empty history, missing selection, and offline-only items", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("tab", { name: /Shapes/ }));
    const ellipse = outline().getByRole("button", { name: "Ellipse (unavailable in this demo)" });
    expect(ellipse.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(ellipse);
    expect(notice()).toMatch(/not part of the agreed demo command set/);

    fireEvent.click(
      screen.getByRole("button", { name: "Connect selected element to the next element" }),
    );
    expect(notice()).toMatch(/Select an element first/);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(notice()).toMatch(/Nothing to undo/);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(notice()).toMatch(/Nothing to redo/);
    menuItem("Edit", /Delete selection/);
    expect(notice()).toMatch(/Select an element first/);
    menuItem("Help", /Check for updates/);
    expect(notice()).toMatch(/network access/);
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
  });

  it("keeps the last page and layer and says so", async () => {
    await openFixture();
    menuItem("File", /New document/);
    await screen.findByText("This page is empty.", undefined, SLOW);
    fireEvent.click(outline().getByRole("tab", { name: /Pages/ }));
    fireEvent.click(outline().getByRole("button", { name: "Remove" }));
    expect(notice()).toMatch(/at least one page/);
    fireEvent.click(outline().getByRole("tab", { name: /Layers/ }));
    fireEvent.click(outline().getByRole("button", { name: "Remove" }));
    expect(notice()).toMatch(/at least one layer/);
  });

  it("adds, activates, and renames layers with keyboard-safe inline forms", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("tab", { name: /Layers/ }));
    const items = () =>
      within(outline().getByRole("list", { name: "Layers" })).getAllByRole("button");
    const count = items().length;
    fireEvent.click(outline().getByRole("button", { name: "Add layer" }));
    await waitFor(() => expect(items()).toHaveLength(count + 1));
    fireEvent.click(items()[0]);
    expect(items()[0].getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(outline().getByRole("button", { name: "Rename" }));
    const field = outline().getByRole("textbox", { name: "Layer name" });
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.keyDown(field, { key: "Escape" });
    expect(outline().queryByRole("textbox", { name: "Layer name" })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(outline().getByRole("button", { name: "Rename" })),
    );

    fireEvent.click(outline().getByRole("button", { name: "Rename" }));
    fireEvent.change(outline().getByRole("textbox", { name: "Layer name" }), {
      target: { value: "Edge services" },
    });
    fireEvent.click(outline().getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(outline().getByRole("button", { name: /Edge services/ })).toBeTruthy(),
    );
  });

  it("reverts inspector drafts and reports an unchanged apply without a command", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("button", { name: "Rectangle “Web client”" }));
    const x = () => screen.getByLabelText("X") as HTMLInputElement;
    fireEvent.change(x(), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect(x().value).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(notice()).toMatch(/No property changed/);
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
  });

  it("lists accepted commands in the History panel and undoes from it", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const panel = () => within(screen.getByRole("complementary", { name: "History" }));
    expect(panel().getByText(/No accepted commands yet/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    const list = await panel().findByRole("list", { name: "Accepted commands, oldest first" });
    expect(within(list).getByText("Add shape")).toBeTruthy();
    expect(within(list).getByText("You")).toBeTruthy();
    const before = outline().getAllByRole("button", { name: /^Rectangle/ }).length;
    fireEvent.click(panel().getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(outline().getAllByRole("button", { name: /^Rectangle/ })).toHaveLength(before - 1),
    );
  });

  it("renames the document from the dialog, rejects an empty title, and restores focus", async () => {
    await openFixture();
    const opener = screen.getByRole("button", { name: /Document title: Product architecture/ });
    // fireEvent.click does not move focus the way a real pointer click does.
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("pc-main")));
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Rename document" });
    const field = within(dialog).getByLabelText("Title") as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    expect(notice()).toMatch(/cannot be empty/);
    expect(screen.getByRole("dialog", { name: "Rename document" })).toBeTruthy();

    fireEvent.change(field, { target: { value: "Platform map" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener.getAttribute("aria-label")).toMatch(/Platform map/);
    expect(document.activeElement).toBe(opener);
    expect(saveStatus()).toBe("Unsaved changes");
  });
});

describe("simulated export and operation exclusivity", () => {
  it("cancels the export dialog with Escape without starting anything", async () => {
    await openFixture();
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("radio", { name: "PNG" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("status", { name: "Export operation" })).toBeNull();
  });

  it("completes, fails, and cancels a simulated export without touching the document", async () => {
    await openFixture();
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated export" }));
    await waitFor(
      () =>
        expect(screen.getByRole("status", { name: "Export operation" }).textContent).toMatch(
          /Completed/,
        ),
      SLOW,
    );
    expect(saveStatus()).not.toBe("Unsaved changes");

    chooseOutcome("error");
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated export" }));
    const failed = await screen.findByRole("alert", { name: "Export operation" }, SLOW);
    expect(failed.textContent).toMatch(/Failed/);

    chooseOutcome("wait");
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated export" }));
    await waitFor(
      () =>
        expect(screen.getByRole("status", { name: "Export operation" }).textContent).toMatch(
          /Waiting for you/,
        ),
      SLOW,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Export operation" }).textContent).toMatch(
        /Cancelled/,
      ),
    );
    expect(saveStatus()).not.toBe("Unsaved changes");
  });

  it("refuses a second simulated operation while one is pending", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    chooseOutcome("wait");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("status", { name: "Save operation" }, SLOW);
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated export" }));
    expect((await screen.findByTestId("service-notice")).textContent).toMatch(/already pending/);
    expect(screen.getByRole("status", { name: "Save operation" }).textContent).toMatch(
      /Waiting for you/,
    );
  });

  it("reset during a waiting operation clears it and nothing resumes later", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    chooseOutcome("wait");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("status", { name: "Save operation" }, SLOW);
    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    expect(screen.queryByRole("status", { name: "Save operation" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole("status", { name: "Save operation" })).toBeNull();
    expect(screen.queryByRole("region", { name: /Diagram canvas/ })).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("operation result dismissal is scoped to the result it dismissed", () => {
  const opCard = (name: string) => screen.queryByRole("status", { name });
  const startExport = () => {
    menuItem("File", /Export/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated export" }));
  };
  const completedExport = () =>
    waitFor(() => expect(opCard("Export operation")?.textContent).toMatch(/Completed/), SLOW);

  it("shows a fresh Open result after dismissing the previous one and resetting", async () => {
    await openFixture();
    const first = await screen.findByRole("status", { name: "Open operation" }, SLOW);
    expect(first.textContent).toMatch(/Completed/);
    fireEvent.click(within(first).getByRole("button", { name: "Dismiss" }));
    expect(opCard("Open operation")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    expect(opCard("Open operation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Product architecture" }));
    await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
    const fresh = await screen.findByRole("status", { name: "Open operation" }, SLOW);
    expect(fresh.textContent).toMatch(/Completed/);
  });

  it("shows each new export completion, including after waiting and continuing", async () => {
    await openFixture();
    startExport();
    await completedExport();
    fireEvent.click(
      within(screen.getByRole("status", { name: "Export operation" })).getByRole("button", {
        name: "Dismiss",
      }),
    );
    expect(opCard("Export operation")).toBeNull();

    startExport();
    await completedExport();
    fireEvent.click(
      within(screen.getByRole("status", { name: "Export operation" })).getByRole("button", {
        name: "Dismiss",
      }),
    );
    expect(opCard("Export operation")).toBeNull();

    chooseOutcome("wait");
    startExport();
    await waitFor(() => expect(opCard("Export operation")?.textContent).toMatch(/Waiting/), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(opCard("Export operation")?.textContent).toMatch(/Completed/));
  });

  it("shows each new cancellation after an earlier cancellation was dismissed", async () => {
    await openFixture();
    chooseOutcome("cancel");
    for (let round = 0; round < 2; round += 1) {
      startExport();
      await waitFor(
        () => expect(opCard("Export operation")?.textContent).toMatch(/Cancelled/),
        SLOW,
      );
      fireEvent.click(
        within(screen.getByRole("status", { name: "Export operation" })).getByRole("button", {
          name: "Dismiss",
        }),
      );
      expect(opCard("Export operation")).toBeNull();
    }
    chooseOutcome("wait");
    startExport();
    await waitFor(() => expect(opCard("Export operation")?.textContent).toMatch(/Waiting/), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    await waitFor(() => expect(opCard("Export operation")?.textContent).toMatch(/Cancelled/));
  });

  it("keeps the dismissed current result hidden across unrelated state updates", async () => {
    await openFixture();
    startExport();
    await completedExport();
    fireEvent.click(
      within(screen.getByRole("status", { name: "Export operation" })).getByRole("button", {
        name: "Dismiss",
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    chooseOutcome("wait");
    expect(saveStatus()).toBe("Unsaved changes");
    expect(opCard("Export operation")).toBeNull();
  });

  it("shows a fresh import preview after closing one and resetting the demo", async () => {
    await openFixture();
    menuItem("File", /Import/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    const preview = await screen.findByRole("region", { name: "Import preview" }, SLOW);
    fireEvent.click(within(preview).getByRole("button", { name: "Apply import" }));
    fireEvent.click(screen.getByRole("button", { name: "Close import preview" }));
    expect(screen.queryByRole("region", { name: "Import preview" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open Product architecture" }));
    await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
    menuItem("File", /Import/);
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    expect(await screen.findByRole("region", { name: "Import preview" }, SLOW)).toBeTruthy();
  });
});

describe("assistant and MCP waiting, cancel, and single use", () => {
  const panel = () => within(screen.getByRole("complementary", { name: "Assistant & MCP" }));

  it("continues a waiting MCP request and applies its proposal exactly once", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    fireEvent.click(panel().getByRole("radio", { name: "MCP client" }));
    chooseOutcome("wait");
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    fireEvent.click(await panel().findByRole("button", { name: "Continue" }, SLOW));
    const approve = await panel().findByRole("button", { name: "Approve and apply" }, SLOW);
    fireEvent.click(approve);
    expect(outline().getAllByRole("button", { name: /Review queue/ })).toHaveLength(1);
    expect(panel().queryByRole("button", { name: "Approve and apply" })).toBeNull();
  });

  it("explains a second proposal request while one is in progress and cancels it", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    chooseOutcome("wait");
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    await panel().findByRole("button", { name: "Cancel" }, SLOW);
    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    expect(notice()).toMatch(/already in progress/);
    fireEvent.click(panel().getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        panel()
          .getAllByRole("status")
          .some((n) => /Cancelled/.test(n.textContent ?? "")),
      ).toBe(true),
    );
    expect(outline().queryByRole("button", { name: /Review queue/ })).toBeNull();
  });

  it("explains an empty message instead of sending it", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    fireEvent.click(panel().getByRole("button", { name: "Send" }));
    expect(notice()).toMatch(/Type a message first/);
  });
});
