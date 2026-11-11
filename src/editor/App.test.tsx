import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type WeaveCanvas from "../canvas/WeaveCanvas";
import * as core from "../document";

type CanvasProps = ComponentProps<typeof WeaveCanvas>;
const canvas = vi.hoisted(() => ({ props: null as CanvasProps | null }));
const rendererEffects = vi.hoisted(() => ({
  deleteKeyEvents: 0,
  pointerDownEvents: 0,
  pointerMoveEvents: 0,
  mouseDownEvents: 0,
  mouseMoveEvents: 0,
}));
vi.mock("../canvas/WeaveCanvas", () => ({
  default: (props: CanvasProps) => {
    canvas.props = props;
    return (
      <div
        data-testid="canvas-projection"
        tabIndex={1}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace")
            rendererEffects.deleteKeyEvents += 1;
        }}
        onPointerDown={() => rendererEffects.pointerDownEvents++}
        onPointerMove={() => rendererEffects.pointerMoveEvents++}
        onMouseDown={() => rendererEffects.mouseDownEvents++}
        onMouseMove={() => rendererEffects.mouseMoveEvents++}
      />
    );
  },
}));

function snapshot() {
  return canvas.props!.document!;
}
function nodes() {
  return snapshot().pages[0].layers[0].nodes;
}
function revision() {
  return screen.getByText(/Revision \d+ · in memory/).textContent;
}
function selectIdea() {
  fireEvent.click(screen.getByRole("button", { name: /Idea/ }));
}

beforeEach(() => {
  canvas.props = null;
  rendererEffects.deleteKeyEvents = 0;
  rendererEffects.pointerDownEvents = 0;
  rendererEffects.pointerMoveEvents = 0;
  rendererEffects.mouseDownEvents = 0;
  rendererEffects.mouseMoveEvents = 0;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("in-memory model-backed editor", () => {
  it("labels the unsaved example and preserves the document when selecting and zooming", () => {
    render(<App />);
    const initial = JSON.stringify(snapshot());
    const initialRevision = revision();
    expect(screen.getByText(/Closing or reloading the app loses all changes/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /save|open/i })).toBeNull();
    selectIdea();
    expect(screen.getByRole("button", { name: /Idea/ }).getAttribute("aria-pressed")).toBe("true");
    expect(canvas.props!.selection).toBe(nodes()[0].nodeId);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit to content" }));
    expect(canvas.props!.zoom).toBeCloseTo(1.1);
    expect(canvas.props!.fitRequest).toBe(1);
    expect(JSON.stringify(snapshot())).toBe(initial);
    expect(revision()).toBe(initialRevision);
  });

  it("places added rectangles in free cells without overlapping existing elements", () => {
    render(<App />);
    const existing = [...nodes()];
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    const added = nodes().at(-1)!;
    expect(canvas.props!.fitRequest).toBe(1);
    expect(
      existing.every(
        (node) =>
          added.geometry.x >= node.geometry.x + node.geometry.width ||
          added.geometry.x + added.geometry.width <= node.geometry.x ||
          added.geometry.y >= node.geometry.y + node.geometry.height ||
          added.geometry.y + added.geometry.height <= node.geometry.y,
      ),
    ).toBe(true);
  });

  it("routes add, move, resize and delete through canonical commands", () => {
    const commands = vi.spyOn(core, "executeCommand");
    render(<App />);
    selectIdea();
    fireEvent.click(screen.getByRole("button", { name: "Move right 10 units" }));
    expect(nodes()[0].geometry.x).toBe(90);
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText("Height"), { target: { value: "130" } });
    const applyGeometry = screen.getByRole("button", { name: "Apply geometry" });
    applyGeometry.focus();
    fireEvent.click(applyGeometry);
    expect(nodes()[0].geometry).toMatchObject({ x: 90, y: 100, width: 220, height: 130 });
    expect(document.activeElement).toBe(applyGeometry);
    fireEvent.click(screen.getByRole("button", { name: "Delete element" }));
    expect(nodes()).toHaveLength(2);
    expect(canvas.props!.selection).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Elements" }));
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    expect(nodes()).toHaveLength(3);
    expect(nodes()[2].nodeId).toBe(canvas.props!.selection);
    expect(
      commands.mock.calls.slice(1).map(([, command]) => (command as { type: string }).type),
    ).toEqual(["node.update", "node.update", "node.remove", "node.add"]);
  });

  it("provides keyboard selection, move, resize, clear and delete without hijacking fields", () => {
    render(<App />);
    selectIdea();
    const region = screen.getByRole("region", { name: "Diagram canvas" });
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    fireEvent.keyDown(region, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(region, { key: "ArrowRight", altKey: true, shiftKey: true });
    expect(nodes()[0].geometry).toMatchObject({ x: 81, y: 110, width: 190, height: 90 });
    const currentRevision = revision();
    fireEvent.keyDown(screen.getByLabelText("Width"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByLabelText("Width"), { key: "Delete" });
    expect(revision()).toBe(currentRevision);
    expect(nodes()).toHaveLength(3);
    fireEvent.keyDown(region, { key: "Escape" });
    expect(canvas.props!.selection).toBeNull();
    expect(revision()).toBe(currentRevision);
    selectIdea();
    const projection = screen.getByTestId("canvas-projection");
    projection.focus();
    fireEvent.keyDown(projection, { key: "Delete" });
    expect(nodes()).toHaveLength(2);
    expect(rendererEffects.deleteKeyEvents).toBe(0);
    expect(screen.getByRole("status", { name: "Editing status" }).textContent).toBe(
      "Idea deleted.",
    );
  });

  it("blocks Weave's renderer-only Alt-drag clone before pointer handlers run", () => {
    render(<App />);
    const projection = screen.getByTestId("canvas-projection");
    fireEvent.pointerDown(projection, { altKey: true });
    expect(rendererEffects.pointerDownEvents).toBe(0);
    fireEvent.pointerDown(projection, { altKey: false });
    expect(rendererEffects.pointerDownEvents).toBe(1);
    fireEvent.pointerMove(projection, { altKey: true, buttons: 1 });
    expect(rendererEffects.pointerMoveEvents).toBe(0);
    fireEvent.pointerMove(projection, { altKey: false, buttons: 1 });
    expect(rendererEffects.pointerMoveEvents).toBe(1);
    fireEvent.mouseDown(projection, { altKey: true, buttons: 1 });
    expect(rendererEffects.mouseDownEvents).toBe(0);
    fireEvent.mouseDown(projection, { altKey: false, buttons: 1 });
    expect(rendererEffects.mouseDownEvents).toBe(1);
    fireEvent.mouseMove(projection, { altKey: true, buttons: 1 });
    expect(rendererEffects.mouseMoveEvents).toBe(0);
    fireEvent.mouseMove(projection, { altKey: false, buttons: 1 });
    expect(rendererEffects.mouseMoveEvents).toBe(1);
  });

  it("keeps movement and resize shortcuts inside the focused canvas", () => {
    render(<App />);
    selectIdea();
    const original = JSON.stringify(snapshot());
    const originalRevision = revision();
    for (const control of [
      screen.getByRole("button", { name: "Zoom in" }),
      screen.getByRole("button", { name: "Fit to content" }),
      screen.getByRole("button", { name: /Idea/ }),
      screen.getByRole("button", { name: "Move right 10 units" }),
      screen.getByLabelText("Width"),
    ]) {
      control.focus();
      fireEvent.keyDown(control, { key: "ArrowRight" });
      fireEvent.keyDown(control, { key: "ArrowDown", altKey: true, shiftKey: true });
    }
    expect(JSON.stringify(snapshot())).toBe(original);
    expect(revision()).toBe(originalRevision);
    const region = screen.getByRole("region", { name: "Diagram canvas" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(JSON.stringify(snapshot())).toBe(original);
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(nodes()[0].geometry.x).toBe(81);
  });

  it("places added rectangles in free grid cells without overlapping existing elements", () => {
    render(<App />);
    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    }
    const placed = nodes();
    expect(placed).toHaveLength(11);
    for (let index = 0; index < placed.length; index += 1) {
      const a = placed[index].geometry;
      for (const { geometry: b } of placed.slice(index + 1)) {
        expect(
          a.x >= b.x + b.width ||
            a.x + a.width <= b.x ||
            a.y >= b.y + b.height ||
            a.y + a.height <= b.y,
        ).toBe(true);
      }
    }
  });

  it("accepts completed canvas geometry and rejects invalid edits without changing the document", () => {
    render(<App />);
    const idea = nodes()[0];
    act(() => {
      expect(canvas.props!.onCommitGeometry!(idea.nodeId, { ...idea.geometry, x: 240 })).toBe(true);
    });
    expect(nodes()[0].geometry.x).toBe(240);
    const accepted = JSON.stringify(snapshot());
    const acceptedRevision = revision();
    act(() => {
      expect(canvas.props!.onCommitGeometry!(idea.nodeId, { ...idea.geometry, width: -1 })).toBe(
        false,
      );
    });
    expect(JSON.stringify(snapshot())).toBe(accepted);
    expect(revision()).toBe(acceptedRevision);
    expect(screen.getByRole("alert").textContent).toMatch(/Geometry/);
    act(() => {
      expect(canvas.props!.onCommitGeometry!("missing-node", idea.geometry)).toBe(false);
    });
    expect(JSON.stringify(snapshot())).toBe(accepted);
  });

  it("shows rejected geometry and supports an empty document without trapping focus", () => {
    render(<App />);
    selectIdea();
    const accepted = JSON.stringify(snapshot());
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply geometry" }));
    expect(JSON.stringify(snapshot())).toBe(accepted);
    expect(screen.getByRole("alert").textContent).toMatch(/Geometry/);
    expect(screen.getByLabelText("Width").getAttribute("aria-invalid")).toBe("true");
    for (const label of ["Idea", "Draft", "Review"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
      fireEvent.click(screen.getByRole("button", { name: "Delete element" }));
    }
    expect(nodes()).toHaveLength(0);
    expect(screen.getByText("No elements. Add a rectangle to begin.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Elements" }));
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    expect(nodes()).toHaveLength(1);
    expect(canvas.props!.selection).toBe(nodes()[0].nodeId);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps unsubmitted geometry drafts out of the document", () => {
    render(<App />);
    selectIdea();
    const original = JSON.stringify(snapshot());
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "999" } });
    expect(JSON.stringify(snapshot())).toBe(original);
    fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
    selectIdea();
    expect((screen.getByLabelText("Width") as HTMLInputElement).value).toBe("180");
    expect(JSON.stringify(snapshot())).toBe(original);
  });
});
