import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type WeaveCanvas from "../canvas/WeaveCanvas";
import * as core from "../document";
import { createTranslator } from "../i18n/translator";

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

// Accessible names come from the English resources (the jsdom system language), so the same
// assertions can run against another locale's translator.
const { t } = createTranslator("en");
const rectangle = () => t("editor.shapes.add", { name: t("editor.defaults.rectangle") });

function snapshot() {
  return canvas.props!.document!;
}
function nodes() {
  return snapshot().pages[0].layers[0].nodes;
}
function revision() {
  return document.querySelector("[data-revision]")!.getAttribute("data-revision");
}
function showTab(name: "shapes" | "structure") {
  fireEvent.click(
    screen.getByRole("tab", {
      name: t(name === "shapes" ? "editor.tabs.shapes" : "editor.tabs.structure"),
    }),
  );
}
function addRectangle() {
  showTab("shapes");
  fireEvent.click(screen.getByRole("button", { name: rectangle() }));
}
function selectIdea() {
  showTab("structure");
  fireEvent.click(screen.getByRole("button", { name: /Idea/ }));
}
const field = (key: string) => screen.getByLabelText(t(key), { exact: true });

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
    expect(screen.getByText(t("documents.notice.desktopOnly"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("documents.menu.file") }));
    for (const key of [
      "documents.menu.open",
      "documents.menu.save",
      "documents.menu.importDrawio",
      "documents.menu.exportDrawio",
    ]) {
      expect((screen.getByRole("menuitem", { name: t(key) }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    }
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    selectIdea();
    expect(screen.getByRole("button", { name: /Idea/ }).getAttribute("aria-pressed")).toBe("true");
    expect(canvas.props!.selection).toBe(nodes()[0].nodeId);
    fireEvent.click(screen.getByRole("button", { name: t("editor.canvas.zoomIn") }));
    fireEvent.click(screen.getByRole("button", { name: t("editor.canvas.fit") }));
    expect(canvas.props!.zoom).toBeCloseTo(1.1);
    expect(canvas.props!.fitRequest).toBe(1);
    expect(JSON.stringify(snapshot())).toBe(initial);
    expect(revision()).toBe(initialRevision);
  });

  it("places added rectangles in free cells without overlapping existing elements", () => {
    render(<App />);
    const existing = [...nodes()];
    addRectangle();
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

  it("searches the approved local catalog and adds a stable shape reference", () => {
    render(<App />);
    const search = screen.getByRole("searchbox", { name: t("editor.shapes.search") });
    fireEvent.change(search, { target: { value: "  RECTANGLE " } });
    const addShape = screen.getByRole("button", { name: rectangle() });
    expect(screen.getByText(t("editor.shapes.source"))).toBeTruthy();
    fireEvent.click(addShape);

    expect(nodes().at(-1)?.catalogReference).toEqual({
      shapeId: "basic-rectangle",
      version: "1.0.0",
    });
    expect(nodes().at(-1)?.text).toBe(t("editor.defaults.rectangle"));
    fireEvent.change(search, { target: { value: "no such shape" } });
    expect(screen.getByText(t("editor.shapes.noMatches"))).toBeTruthy();
  });

  it("routes add, move, resize and delete through canonical commands", () => {
    const commands = vi.spyOn(core, "executeCommand");
    render(<App />);
    selectIdea();
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.moveRight") }));
    expect(nodes()[0].geometry.x).toBe(90);
    fireEvent.change(field("editor.inspector.width"), { target: { value: "220" } });
    fireEvent.change(field("editor.inspector.height"), { target: { value: "130" } });
    const applyGeometry = screen.getByRole("button", { name: t("editor.inspector.applyGeometry") });
    applyGeometry.focus();
    fireEvent.click(applyGeometry);
    expect(nodes()[0].geometry).toMatchObject({ x: 90, y: 100, width: 220, height: 130 });
    expect(document.activeElement).toBe(applyGeometry);
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.deleteElement") }));
    expect(nodes()).toHaveLength(2);
    expect(canvas.props!.selection).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Elements/ }));
    addRectangle();
    expect(nodes()).toHaveLength(3);
    expect(nodes()[2].nodeId).toBe(canvas.props!.selection);
    for (const type of ["node.update", "node.remove", "node.add"]) {
      expect(
        commands.mock.calls.some(([, command]) => (command as { type: string }).type === type),
      ).toBe(true);
    }
  });

  it("moves focus to the canvas after an inspector delete when Elements is not visible", () => {
    render(<App />);
    selectIdea();
    showTab("shapes");
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.deleteElement") }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: t("editor.canvas.region") }),
    );
  });

  it("provides keyboard selection, move, resize, clear and delete without hijacking fields", () => {
    render(<App />);
    selectIdea();
    const region = screen.getByRole("region", { name: t("editor.canvas.region") });
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    fireEvent.keyDown(region, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(region, { key: "ArrowRight", altKey: true, shiftKey: true });
    expect(nodes()[0].geometry).toMatchObject({ x: 81, y: 110, width: 190, height: 90 });
    const currentRevision = revision();
    fireEvent.keyDown(field("editor.inspector.width"), { key: "ArrowRight" });
    fireEvent.keyDown(field("editor.inspector.width"), { key: "Delete" });
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
    expect(screen.getByRole("status", { name: t("editor.status.label") }).textContent).toBe(
      t("editor.feedback.deleted", { name: "Idea" }),
    );
    // Keyboard deletion keeps the keyboard user on the canvas.
    expect(document.activeElement).toBe(projection);
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
      screen.getByRole("button", { name: t("editor.canvas.zoomIn") }),
      screen.getByRole("button", { name: t("editor.canvas.fit") }),
      screen.getByRole("button", { name: /Idea/ }),
      screen.getByRole("button", { name: t("editor.inspector.moveRight") }),
      field("editor.inspector.width"),
    ]) {
      control.focus();
      fireEvent.keyDown(control, { key: "ArrowRight" });
      fireEvent.keyDown(control, { key: "ArrowDown", altKey: true, shiftKey: true });
    }
    expect(JSON.stringify(snapshot())).toBe(original);
    expect(revision()).toBe(originalRevision);
    const region = screen.getByRole("region", { name: t("editor.canvas.region") });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(JSON.stringify(snapshot())).toBe(original);
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(nodes()[0].geometry.x).toBe(81);
  });

  it("places added rectangles in free grid cells without overlapping existing elements", () => {
    render(<App />);
    for (let index = 0; index < 8; index += 1) addRectangle();
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
    expect(screen.getByRole("alert").textContent).toBe(t("editor.diagnostics.invalidGeometry"));
    act(() => {
      expect(canvas.props!.onCommitGeometry!("missing-node", idea.geometry)).toBe(false);
    });
    expect(JSON.stringify(snapshot())).toBe(accepted);
    expect(screen.getByRole("alert").textContent).toBe(t("editor.errors.elementGone"));
  });

  it("shows rejected geometry and supports an empty document without trapping focus", () => {
    render(<App />);
    selectIdea();
    const accepted = JSON.stringify(snapshot());
    fireEvent.change(field("editor.inspector.width"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.applyGeometry") }));
    expect(JSON.stringify(snapshot())).toBe(accepted);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(t("editor.diagnostics.invalidGeometry"));
    const width = field("editor.inspector.width");
    expect(width.getAttribute("aria-invalid")).toBe("true");
    expect(width.getAttribute("aria-describedby")).toBe(alert.id);
    for (const label of ["Idea", "Draft", "Review"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
      fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.deleteElement") }));
    }
    expect(nodes()).toHaveLength(0);
    expect(screen.getByText(t("editor.structure.noElements"))).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Elements/ }));
    addRectangle();
    expect(nodes()).toHaveLength(1);
    expect(canvas.props!.selection).toBe(nodes()[0].nodeId);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps unsubmitted geometry drafts out of the document", () => {
    render(<App />);
    selectIdea();
    const original = JSON.stringify(snapshot());
    fireEvent.change(field("editor.inspector.width"), { target: { value: "999" } });
    expect(JSON.stringify(snapshot())).toBe(original);
    fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
    selectIdea();
    expect((field("editor.inspector.width") as HTMLInputElement).value).toBe("180");
    expect(JSON.stringify(snapshot())).toBe(original);
  });

  it("creates, updates, deletes and restores connectors through canonical history", () => {
    render(<App />);
    const initial = snapshot().pages[0].layers[0].connections.length;
    fireEvent.change(field("editor.connector.label"), { target: { value: "Decision" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.connector.add") }));
    expect(snapshot().pages[0].layers[0].connections).toHaveLength(initial + 1);
    const created = snapshot().pages[0].layers[0].connections.at(-1)!;
    expect(created.label).toBe("Decision");
    fireEvent.change(field("editor.connector.label"), { target: { value: "Accepted" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.connector.apply") }));
    expect(snapshot().pages[0].layers[0].connections.at(-1)!.label).toBe("Accepted");
    fireEvent.click(screen.getByRole("button", { name: t("editor.connector.delete") }));
    expect(snapshot().pages[0].layers[0].connections).toHaveLength(initial);
    fireEvent.click(screen.getByRole("button", { name: t("editor.header.undo") }));
    expect(snapshot().pages[0].layers[0].connections.at(-1)!.connectionId).toBe(
      created.connectionId,
    );
    fireEvent.click(screen.getByRole("button", { name: t("editor.header.redo") }));
    expect(snapshot().pages[0].layers[0].connections).toHaveLength(initial);
    const before = JSON.stringify(snapshot());
    fireEvent.change(field("editor.connector.target"), { target: { value: nodes()[0].nodeId } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.connector.add") }));
    expect(JSON.stringify(snapshot())).toBe(before);
    expect(screen.getByRole("alert").textContent).toBe(t("editor.diagnostics.endpointsMustDiffer"));
  });

  it("discards an unsubmitted new-connector draft when New connector is chosen", () => {
    render(<App />);
    fireEvent.change(field("editor.connector.label"), { target: { value: "Draft label" } });
    showTab("structure");
    fireEvent.click(screen.getByRole("button", { name: t("editor.structure.newConnector") }));
    expect((field("editor.connector.label") as HTMLInputElement).value).toBe("");
  });

  it("replaces connector selection when adding a rectangle before keyboard deletion", () => {
    const commands = vi.spyOn(core, "executeCommand");
    render(<App />);
    const connections = JSON.stringify(snapshot().pages[0].layers[0].connections);
    const initialNodes = nodes().length;
    showTab("structure");
    fireEvent.click(screen.getByRole("button", { name: "Refine" }));
    expect(canvas.props!.connectionSelection).toBe(
      snapshot().pages[0].layers[0].connections[0].connectionId,
    );
    addRectangle();
    const addedId = nodes().at(-1)!.nodeId;
    expect(canvas.props!.selection).toBe(addedId);
    expect(canvas.props!.connectionSelection).toBeNull();
    const region = screen.getByRole("region", { name: t("editor.canvas.region") });
    region.focus();
    fireEvent.keyDown(region, { key: "Delete" });
    expect(nodes()).toHaveLength(initialNodes);
    expect(nodes().some((node) => node.nodeId === addedId)).toBe(false);
    expect(JSON.stringify(snapshot().pages[0].layers[0].connections)).toBe(connections);
    expect(
      commands.mock.calls.some(([, command]) => {
        const value = command as { type: string; nodeId?: string };
        return value.type === "node.remove" && value.nodeId === addedId;
      }),
    ).toBe(true);
  });

  it("manages page and layer contexts and clears stale selection across undo", () => {
    render(<App />);
    selectIdea();
    const initialPages = snapshot().pages.length;
    fireEvent.click(screen.getByRole("button", { name: t("editor.structure.addPage") }));
    expect(snapshot().pages).toHaveLength(initialPages + 1);
    expect(snapshot().pages.at(-1)!.name).toBe(
      t("editor.defaults.page", { number: initialPages + 1 }),
    );
    expect(canvas.props!.selection).toBeNull();
    expect(canvas.props!.pageId).toBe(snapshot().pages.at(-1)!.pageId);
    fireEvent.change(field("editor.structure.pageName"), { target: { value: "Details" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.structure.renamePage") }));
    expect(snapshot().pages.at(-1)!.name).toBe("Details");
    fireEvent.click(screen.getByRole("button", { name: t("editor.structure.addLayer") }));
    const addedPage = snapshot().pages.at(-1)!;
    expect(addedPage.layers).toHaveLength(2);
    fireEvent.change(field("editor.structure.layerName"), { target: { value: "Annotations" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.structure.renameLayer") }));
    expect(snapshot().pages.at(-1)!.layers[1].name).toBe("Annotations");
    addRectangle();
    expect(snapshot().pages.at(-1)!.layers[1].nodes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: t("editor.header.undo") }));
    expect(canvas.props!.selection).toBeNull();
    showTab("structure");
    fireEvent.change(field("editor.structure.page"), {
      target: { value: snapshot().pages[0].pageId },
    });
    expect(canvas.props!.layerId).toBe(snapshot().pages[0].layers[0].layerId);
    expect(canvas.props!.selection).toBeNull();
  });

  it("resolves canvas node ownership and preserves native text undo", () => {
    render(<App />);
    const notes = snapshot().pages[0].layers[1];
    const node = notes.nodes[0];
    act(() => canvas.props!.onSelect(node.nodeId));
    expect(canvas.props!.layerId).toBe(notes.layerId);
    act(() => canvas.props!.onCommitGeometry!(node.nodeId, { ...node.geometry, x: 300 }));
    expect(snapshot().pages[0].layers[1].nodes[0].geometry.x).toBe(300);
    fireEvent.change(field("editor.inspector.text"), { target: { value: "New note" } });
    fireEvent.click(screen.getByRole("button", { name: t("editor.inspector.applyText") }));
    expect(snapshot().pages[0].layers[1].nodes[0].text).toBe("New note");
    const current = revision();
    fireEvent.keyDown(field("editor.inspector.text"), { key: "z", ctrlKey: true });
    expect(revision()).toBe(current);
    const region = screen.getByRole("region", { name: t("editor.canvas.region") });
    region.focus();
    fireEvent.keyDown(region, { key: "z", ctrlKey: true });
    expect(snapshot().pages[0].layers[1].nodes[0].text).toBe(node.text);
    fireEvent.keyDown(region, { key: "z", ctrlKey: true, shiftKey: true });
    expect(snapshot().pages[0].layers[1].nodes[0].text).toBe("New note");
  });
});
