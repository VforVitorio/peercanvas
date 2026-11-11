import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness } from "./test/weaveMock";
import App from "./App";

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
