import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness } from "./test/weaveMock";
import App from "./App";

// Only the Weave renderer packages are replaced (jsdom cannot paint a canvas).
// The real demo service is exercised by every test.
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

beforeEach(() => harness.reset());
afterEach(() => cleanup());

async function openFixture(title = "Product architecture") {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }));
  await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
  await waitFor(() => expect(harness.instances.length).toBeGreaterThan(0));
}

function outline() {
  return within(screen.getByRole("complementary", { name: "Document structure" }));
}

function selectionStatus() {
  return screen.getByTestId("selection-status").textContent;
}

describe("launch and home", () => {
  it("keeps the simulation notice visible and filters recent documents", () => {
    render(<App />);
    expect(screen.getByText(/Nothing is saved to disk, shared, or sent/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);

    const search = screen.getByRole("searchbox", { name: "Search recent documents" });
    fireEvent.change(search, { target: { value: "blueprint" } });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1);

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/No recent documents match/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);
  });

  it("requires explicit restore after previewing a recovery candidate", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Recovery/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Product architecture" }));
    const dialog = screen.getByRole("dialog", { name: "Recovery preview" });
    expect(screen.queryByRole("region", { name: /Diagram canvas/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore this version" }));
    await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
    // A recovered checkpoint has never been saved, so the service treats it as unsaved.
    expect(screen.getByTestId("save-status").textContent).toBe("Unsaved changes");
  });
});

describe("editing through the canonical service", () => {
  it("selects from the outline, applies an inspector edit, and undoes/redoes it", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("button", { name: "Rectangle “Web client”" }));
    expect(selectionStatus()).toContain("Web client");

    const x = screen.getByLabelText("X") as HTMLInputElement;
    expect(x.value).toBe("100");
    fireEvent.change(x, { target: { value: "260" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(260));
    expect(screen.getByTestId("save-status").textContent).toBe("Unsaved changes");
    expect((screen.getByLabelText("X") as HTMLInputElement).value).toBe("260");

    fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]);
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(100));
    fireEvent.click(screen.getAllByRole("button", { name: "Redo" })[0]);
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(260));
  });

  it("rejects invalid inspector input without changing the document", async () => {
    await openFixture();
    fireEvent.click(outline().getByRole("button", { name: "Rectangle “API gateway”" }));
    const before = harness.instances.length;
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("Fill"), { target: { value: "blue" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(screen.getByLabelText("Width").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Must be greater than 0.")).toBeTruthy();
    expect(screen.getByText("Use a #RRGGBB colour.")).toBeTruthy();
    expect(harness.instances.length).toBe(before);
    expect(screen.getByTestId("save-status").textContent).not.toBe("Unsaved changes");
  });

  it("reports the service rejection of an invalid command", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Send invalid command/ }));
    const notice = await screen.findByTestId("service-notice");
    expect(notice.getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("save-status").textContent).not.toBe("Unsaved changes");
  });

  it("supports keyboard selection, movement, and deletion on the canvas", async () => {
    await openFixture();
    const canvas = screen.getByRole("region", { name: /Diagram canvas/ });
    canvas.focus();
    fireEvent.keyDown(canvas, { key: "]" });
    expect(selectionStatus()).toContain("Web client");
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")?.x).toBe(108));
    fireEvent.keyDown(canvas, { key: "Delete" });
    await waitFor(() => expect(harness.latest().nodeByLabel("Web client")).toBeUndefined());
    expect(outline().queryByRole("button", { name: "Rectangle “Web client”" })).toBeNull();
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(screen.getByTestId("ui-notice").textContent).toMatch(/Select an element first/);
  });

  it("reports renderer clicks as selection without letting the renderer edit", async () => {
    await openFixture();
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true));
    const weave = harness.latest();
    const id = String(weave.elements.find((e) => e.props.labelText === "Document service")?.key);
    act(() => weave.stage.click(id));
    expect(selectionStatus()).toContain("Document service");
    await waitFor(() => expect(harness.latest().overlay?.props.visible).toBe(true));
    act(() => harness.latest().stage.click(null));
    expect(selectionStatus()).toBe("No selection");
  });

  it("denies viewer mutations at the service boundary", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Collaboration" }));
    fireEvent.click(screen.getByRole("radio", { name: /Viewer \(mutations are rejected\)/ }));
    expect(screen.getByRole("note").textContent).toMatch(/simulated viewer/);
    const count = outline().getAllByRole("button", { name: /^Rectangle/ }).length;
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    const notice = await screen.findByTestId("service-notice");
    expect(notice.textContent).toMatch(/Viewer permission/);
    expect(outline().getAllByRole("button", { name: /^Rectangle/ })).toHaveLength(count);
  });

  it("admits a pending participant and shows a fictional invitation", async () => {
    await openFixture("Team workspace");
    const panel = within(screen.getByRole("complementary", { name: "Collaboration" }));
    fireEvent.click(panel.getByRole("button", { name: "Admit Sam Chen as viewer" }));
    expect(panel.getByText(/viewer · connected/)).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "Create invitation" }));
    expect(panel.getByText("Fictional — cannot be used")).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "Simulate disconnect" }));
    expect(screen.getByText("Offline — local editing continues")).toBeTruthy();
  });
});

describe("document lifecycle decisions", () => {
  it("keeps the dirty document when replacement is cancelled", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    await waitFor(() =>
      expect(screen.getByTestId("save-status").textContent).toBe("Unsaved changes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to home" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Service blueprint" }));
    const dialog = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Return to “Product architecture”/ }));
    expect(screen.getByTestId("save-status").textContent).toBe("Unsaved changes");
    expect(outline().getByRole("button", { name: "Rectangle “New service”" })).toBeTruthy();
  });

  it("discards changes only after an explicit decision", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /New document/ }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /Document title: Untitled diagram/ }),
        ).toBeTruthy(),
      SLOW,
    );
    expect(await screen.findByText("This page is empty.")).toBeTruthy();
  });
});

describe("simulated operations", () => {
  it("cancels a waiting import without changing the document", async () => {
    await openFixture();
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "wait" } });
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Import/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    const panel = await screen.findByRole("status", { name: "Import operation" });
    expect(panel.textContent).toMatch(/Waiting for you/);
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel import" }));
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Import operation" }).textContent).toMatch(
        /Cancelled/,
      ),
    );
    expect(screen.queryByRole("region", { name: "Import preview" })).toBeNull();
    expect(screen.getByTestId("save-status").textContent).not.toBe("Unsaved changes");
  });

  it("previews an import and leaves the document unchanged when declined", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Import/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start simulated import" }));
    const preview = await screen.findByRole("region", { name: "Import preview" }, SLOW);
    expect(within(preview).getByText(/Incompatible/)).toBeTruthy();
    fireEvent.click(within(preview).getByRole("button", { name: "Decline import" }));
    expect(within(preview).getByText(/Declined/)).toBeTruthy();
    expect(outline().queryByRole("button", { name: /Imported service/ })).toBeNull();
  });

  it("shows a simulated save error and keeps unsaved state", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const panel = await screen.findByRole("alert", { name: "Save operation" }, SLOW);
    expect(panel.textContent).toMatch(/Failed/);
    expect(screen.getByTestId("save-status").textContent).toBe("Unsaved changes");
  });
});

describe("assistant proposals", () => {
  it("rejects without mutation and applies an approved proposal exactly once", async () => {
    await openFixture("Service blueprint");
    const panel = () => within(screen.getByRole("complementary", { name: "Assistant & MCP" }));
    const proposal = panel().getByRole("region", { name: "Proposed change" });
    expect(within(proposal).getByText("Add one rectangle: Review queue")).toBeTruthy();

    fireEvent.click(within(proposal).getByRole("button", { name: "Reject" }));
    expect(panel().getByText(/Rejected. The document was not changed/)).toBeTruthy();
    expect(outline().queryByRole("button", { name: /Review queue/ })).toBeNull();

    fireEvent.click(panel().getByRole("button", { name: "Request proposal" }));
    const approve = await panel().findByRole("button", { name: "Approve and apply" }, SLOW);
    fireEvent.click(approve);
    expect(outline().getAllByRole("button", { name: /Review queue/ })).toHaveLength(1);
    expect(panel().queryByRole("button", { name: "Approve and apply" })).toBeNull();
    expect(panel().getByText(/cannot be approved again/)).toBeTruthy();
  });
});

describe("keyboard, dialogs, and preferences", () => {
  it("contains focus in a dialog, closes on Escape, and restores focus to the opener", async () => {
    await openFixture();
    const helpMenu = screen.getByRole("button", { name: "Help" });
    helpMenu.focus();
    fireEvent.keyDown(helpMenu, { key: "ArrowDown" });
    const first = screen.getByRole("menuitem", { name: "Help" });
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(first, { key: "Enter" });

    const dialog = screen.getByRole("dialog", { name: "About this demonstration" });
    expect(document.getElementById("pc-shell")?.hasAttribute("inert")).toBe(true);
    const buttons = within(dialog).getAllByRole("button");
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.getElementById("pc-shell")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(helpMenu);
  });

  it("navigates menus by keyboard and explains unavailable items", async () => {
    await openFixture();
    const file = screen.getByRole("button", { name: "File" });
    file.focus();
    fireEvent.keyDown(file, { key: "ArrowUp" });
    const close = screen.getByRole("menuitem", { name: /Close document/ });
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(close, { key: "ArrowUp" });
    const print = screen.getByRole("menuitem", { name: /Print/ });
    await waitFor(() => expect(document.activeElement).toBe(print));
    fireEvent.keyDown(print, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(file);

    fireEvent.click(file);
    fireEvent.click(screen.getByRole("menuitem", { name: /Print/ }));
    expect(screen.getByTestId("ui-notice").textContent).toMatch(/Printing is not part/);
  });

  it("changes theme and zoom, then resets them with the demo", async () => {
    await openFixture();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Preferences/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const root = document.querySelector(".pc-root") as HTMLElement;
    expect(root.dataset.theme).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: /Zoom 125%/ })).toBeTruthy();
    await waitFor(() => expect(harness.latest().stage.scaleValue.x).toBe(1.25));

    fireEvent.click(screen.getByRole("button", { name: /Reset demo/ }));
    expect(root.dataset.theme).toBe("light");
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4);
    expect(screen.queryByRole("region", { name: /Diagram canvas/ })).toBeNull();
  });

  it("shows renderer failure with a working retry and disposes renderers on unmount", async () => {
    harness.failNextStart = "simulated renderer failure";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Product architecture" }));
    const alert = await screen.findByRole("alert", undefined, SLOW);
    expect(alert.textContent).toMatch(/CANVAS_(START|INIT)/);
    expect(alert.textContent).not.toContain("simulated renderer failure");
    expect(alert.closest('[role="alert"]')).toBeTruthy();
    // The accessible outline remains usable while the renderer is down.
    expect(outline().getByRole("button", { name: "Rectangle “Web client”" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry canvas" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    cleanup();
    await waitFor(() =>
      expect(harness.instances.every((instance) => instance.destroyed)).toBe(true),
    );
  });
});
