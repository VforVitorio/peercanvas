import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoService } from "../services/demo-service";
import { harness, type FakeWeave } from "./test/weaveMock";
import App from "./App";
import { buildProjection, previewConnections } from "./projection";
import type { CanonicalDocument } from "./types";
import WeaveCanvas, { type MoveNodeInput } from "./WeaveCanvas";

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

// jsdom performs no layout; give the Weave host a fixed size so viewport fitting is observable.
let sized = true;
beforeEach(() => {
  harness.reset();
  sized = true;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => (sized ? 700 : 0));
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() =>
    sized ? 600 : 0,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openFixture(title = "Product architecture") {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }));
  await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
  await waitFor(() => expect(harness.instances.length).toBeGreaterThan(0));
}

const zoomLabel = () => screen.getByRole("button", { name: /^Zoom \d+%/ }).textContent;
const saveStatus = () => screen.getByTestId("save-status").textContent;

describe("initial fit to content", () => {
  it("fits the complete fixture on first activation without dirtying the document", async () => {
    await openFixture();
    // Rightmost node edge is x=860; (700 - 96) / 860 = 70%.
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    await waitFor(() => expect(harness.latest().stage.scaleValue.x).toBeCloseTo(0.7, 2), SLOW);
    expect(saveStatus()).not.toMatch(/Unsaved/);
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps a manual zoom after the initial fit, including across edits and pages", async () => {
    await openFixture();
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(zoomLabel()).toBe("75%");
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Data flow" }));
    // First visit to another page fits that page once; returning keeps whatever the user set.
    // Data flow's right edge is x=680: (700 - 96) / 680 = 89%.
    await waitFor(() => expect(zoomLabel()).toBe("89%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "System overview" }));
    await waitFor(() => expect(zoomLabel()).toBe("75%"), SLOW);
  });

  it("still fits on request with the keyboard-reachable control", async () => {
    await openFixture();
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit to content" }));
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
  });

  it("waits for a laid-out viewport instead of fitting against zero size", async () => {
    sized = false;
    await openFixture();
    expect(zoomLabel()).toBe("100%");
  });
});

describe("connection rendering", () => {
  it("hands every connection to the renderer as a typed arrow with default semantics", async () => {
    await openFixture();
    const arrows = harness.latest().elements.filter((element) => element.type === "arrow");
    expect(arrows).toHaveLength(3);
    for (const arrow of arrows)
      expect(arrow.props).toMatchObject({
        nodeType: "arrow",
        stroke: "#000000",
        fill: "#000000",
        strokeWidth: 1,
      });
  });
});

describe("semantic appearance across editor themes", () => {
  const setTheme = (name: "Dark" | "Light") => {
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Preferences/ }));
    fireEvent.click(screen.getByRole("radio", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
  };

  it("projects identical default and explicit appearance in light and dark chrome", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    const snapshot = () =>
      JSON.stringify(
        harness
          .latest()
          .elements.map((element) => [element.key, element.props])
          .sort(),
      );
    await waitFor(() => expect(harness.latest().elements.length).toBeGreaterThan(5), SLOW);
    const light = snapshot();
    const instancesBefore = harness.instances.length;

    setTheme("Dark");
    expect(document.querySelector<HTMLElement>(".pc-root")!.dataset.theme).toBe("dark");
    await waitFor(() => expect(snapshot()).toBe(light));
    // Theme is chrome only: it neither re-renders the canvas nor touches the document.
    expect(harness.instances.length).toBe(instancesBefore);
    expect(saveStatus()).toBe("Unsaved changes");
    expect(screen.getByText(/Revision 2\b/)).toBeTruthy();

    setTheme("Light");
    expect(snapshot()).toBe(light);
  });

  it("renders Add text with legible black default text and no fill/stroke in dark chrome", async () => {
    await openFixture();
    setTheme("Dark");
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    await waitFor(() =>
      expect(
        harness
          .latest()
          .elements.some((e) => e.props.nodeType === "rectangle" && e.props.fill === "transparent"),
      ).toBe(true),
    );
    const text = harness
      .latest()
      .elements.find((e) => e.props.fill === "transparent" && e.props.strokeWidth === 0)!;
    expect(text.props).toMatchObject({
      fill: "transparent",
      stroke: "transparent",
      labelFill: "#000000",
      labelFontSize: 16,
    });
    // Explicit fixture styling is unchanged by the dark theme.
    expect(harness.latest().nodeByLabel("Web client")).toMatchObject({
      fill: "#e8efff",
      stroke: "#3155b7",
      strokeWidth: 2,
      labelFill: "#182646",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Direct adapter tests: the real demo service (never mocked) drives WeaveCanvas through the agreed
// props, so drag behaviour is verified independently of Workspace wiring.

type Service = ReturnType<typeof createDemoService>;

function CanvasHarness({
  service,
  zoom,
  onMove,
}: {
  service: Service;
  zoom: number;
  onMove?: (input: MoveNodeInput) => boolean;
}) {
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot);
  return (
    <WeaveCanvas
      document={state.document as CanonicalDocument | null}
      pageId={state.pageId}
      layerId={state.layerId}
      selection={state.selection}
      revision={state.revision}
      role={state.role}
      zoom={zoom}
      fitRequest={0}
      onSelect={(id) => service.select(id)}
      onZoomChange={() => undefined}
      onMoveNode={onMove ?? ((input) => service.moveNode(input))}
    />
  );
}

async function mountCanvas(zoom = 1, onMove?: (input: MoveNodeInput) => boolean) {
  const service = createDemoService();
  await service.open("diagram");
  const utils = render(<CanvasHarness service={service} zoom={zoom} onMove={onMove} />);
  await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
  return { service, ...utils };
}

const doc = (service: Service) => service.getSnapshot().document as CanonicalDocument;

/** A node on the active layer that has at least one connection on its page. */
function connectedActiveNode(service: Service) {
  const state = service.getSnapshot();
  const page = doc(service).pages.find((p) => p.pageId === state.pageId)!;
  const links = page.layers.flatMap((layer) => layer.connections);
  const layer = page.layers.find((l) => l.layerId === state.layerId)!;
  const node = layer.nodes.find((n) =>
    links.some((c) => c.sourceNodeId === n.nodeId || c.targetNodeId === n.nodeId),
  )!;
  expect(node).toBeTruthy();
  return node;
}

const geometry = (service: Service, nodeId: string) =>
  doc(service)
    .pages.flatMap((p) => p.layers)
    .flatMap((l) => l.nodes)
    .find((n) => n.nodeId === nodeId)!.geometry;

function expectNear(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

/** Client point of a world point through the fake stage's current transform. */
function clientOf(weave: FakeWeave, world: { x: number; y: number }) {
  const { positionValue: p, scaleValue: s } = weave.stage;
  return { x: Math.round(p.x + world.x * s.x), y: Math.round(p.y + world.y * s.x) };
}

function pointer(target: EventTarget, type: string, point: { x: number; y: number }, id = 1) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: id });
  Object.defineProperty(event, "isPrimary", { value: true });
  act(() => {
    target.dispatchEvent(event);
  });
}

const frameEl = () => screen.getByTestId("weave-frame");
const sdkContainer = () => screen.getByTestId("weave-container");

/** Starts a drag on `nodeId` at its centre and moves by `delta` client px. Returns the start. */
function startDrag(
  weave: FakeWeave,
  service: Service,
  nodeId: string,
  delta: { x: number; y: number },
) {
  const g = geometry(service, nodeId);
  const start = clientOf(weave, { x: g.x + g.width / 2, y: g.y + g.height / 2 });
  pointer(sdkContainer(), "pointerdown", start);
  // Two steps: the first crosses the 3 px threshold, the second lands on the target.
  pointer(frameEl(), "pointermove", {
    x: start.x + Math.sign(delta.x) * 3,
    y: start.y + Math.sign(delta.y) * 3,
  });
  pointer(frameEl(), "pointermove", { x: start.x + delta.x, y: start.y + delta.y });
  return start;
}

// jsdom has no pointer capture; emulate it, dispatching lostpointercapture synchronously on
// release (harsher than browsers, which dispatch it later) to exercise the duplicate guard.
let captures: Map<Element, Set<number>>;
function installPointerCapture() {
  captures = new Map();
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = function (this: Element, id: number) {
    captures.set(this, (captures.get(this) ?? new Set()).add(id));
  };
  proto.hasPointerCapture = function (this: Element, id: number) {
    return captures.get(this)?.has(id) ?? false;
  };
  proto.releasePointerCapture = function (this: Element, id: number) {
    if (!captures.get(this)?.delete(id)) return;
    const lost = new MouseEvent("lostpointercapture", { bubbles: true });
    Object.defineProperty(lost, "pointerId", { value: id });
    this.dispatchEvent(lost);
  };
}
function removePointerCapture() {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  delete proto.setPointerCapture;
  delete proto.hasPointerCapture;
  delete proto.releasePointerCapture;
}

describe("node dragging through the validated move service", () => {
  beforeEach(installPointerCapture);
  afterEach(removePointerCapture);

  for (const zoom of [0.25, 1, 2]) {
    it(`previews in world coordinates and commits one move at ${zoom * 100}%, including negative coordinates`, async () => {
      const { service } = await mountCanvas(zoom);
      const weave = harness.latest();
      expect(weave.stage.scaleValue.x).toBe(zoom);
      const node = connectedActiveNode(service);
      const origin = { ...node.geometry };
      const before = {
        revision: service.getSnapshot().revision,
        history: service.getSnapshot().history.length,
        json: JSON.stringify(doc(service)),
      };
      const projected = JSON.stringify(weave.elements);
      // Travel far enough up/left that the result has negative world coordinates.
      const delta = {
        x: -Math.ceil((origin.x + 70) * zoom),
        y: -Math.ceil((origin.y + 50) * zoom),
      };
      startDrag(weave, service, node.nodeId, delta);
      // Exact inverse-stage world travel, never rounded (e.g. 0.5 world units at 200%).
      expectNear(weave.stage.nodes.get(node.nodeId)!.pos, {
        x: origin.x + delta.x / zoom,
        y: origin.y + delta.y / zoom,
      });
      const expected = { ...weave.stage.nodes.get(node.nodeId)!.pos };
      expect(expected.x).toBeLessThan(0);
      expect(expected.y).toBeLessThan(0);

      // Preview: rendered node and its connections move; canonical state does not.
      const projection = buildProjection(
        doc(service),
        service.getSnapshot().pageId,
        service.getSnapshot().layerId,
      );
      const links = previewConnections(projection, node.nodeId, expected);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(weave.stage.nodes.get(link.id)!.pts).toEqual(link.points);
      expect(service.getSnapshot().revision).toBe(before.revision);
      expect(JSON.stringify(doc(service))).toBe(before.json);
      expect(JSON.stringify(weave.elements)).toBe(projected);
      // Only the cosmetic overlay ever goes through the SDK store path.
      expect(weave.updates.every((key) => key === "pc-selection-overlay")).toBe(true);
      // The dragged node is selected for inspector coherence.
      expect(service.getSnapshot().selection).toBe(node.nodeId);
      expect(frameEl().hasPointerCapture(1)).toBe(true);

      pointer(frameEl(), "pointerup", { x: 0, y: 0 });

      const after = service.getSnapshot();
      expect(after.revision).toBe(before.revision + 1);
      expect(after.canUndo).toBe(true);
      expect(after.history).toHaveLength(before.history + 1);
      expect(geometry(service, node.nodeId)).toEqual({ ...origin, ...expected });
      expect(frameEl().hasPointerCapture(1)).toBe(false);
      // Accepted canon replaces the renderer; connections redraw exactly as previewed.
      await waitFor(() => expect(harness.latest()).not.toBe(weave));
      const replaced = harness.latest();
      await waitFor(() => expect(weave.destroyed).toBe(true));
      const moved = replaced.elements.find((e) => e.key === node.nodeId)!;
      expect(moved.props).toMatchObject(expected);
      for (const link of links)
        expect(replaced.elements.find((e) => e.key === link.id)!.props.points).toEqual(link.points);

      act(() => service.undo());
      expect(geometry(service, node.nodeId)).toEqual(origin);
      act(() => service.redo());
      expect(geometry(service, node.nodeId)).toEqual({ ...origin, ...expected });
    });
  }

  it("treats travel below 3 px as a click (renderer selects) and a net-zero drag as no command", async () => {
    const onMove = vi.fn(() => true);
    const { service } = await mountCanvas(1, onMove);
    const weave = harness.latest();
    const node = connectedActiveNode(service);
    const start = clientOf(weave, { x: node.geometry.x + 5, y: node.geometry.y + 5 });
    pointer(sdkContainer(), "pointerdown", start);
    pointer(frameEl(), "pointermove", { x: start.x + 2, y: start.y + 1 });
    pointer(frameEl(), "pointerup", { x: start.x + 2, y: start.y + 1 });
    expect(frameEl().hasPointerCapture(1)).toBe(false);
    act(() => weave.stage.click(node.nodeId));
    expect(service.getSnapshot().selection).toBe(node.nodeId);

    // Out and back to the origin.
    pointer(sdkContainer(), "pointerdown", start);
    pointer(frameEl(), "pointermove", { x: start.x + 40, y: start.y + 20 });
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x + 40,
      y: node.geometry.y + 20,
    });
    pointer(frameEl(), "pointermove", start);
    pointer(frameEl(), "pointerup", start);
    expect(onMove).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({ revision: 0, canUndo: false });
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x,
      y: node.geometry.y,
    });
  });

  const canonicalLinksOf = (service: Service, nodeId: string) =>
    previewConnections(
      buildProjection(doc(service), service.getSnapshot().pageId, service.getSnapshot().layerId),
      nodeId,
      geometry(service, nodeId),
    );

  it("restores the canonical preview when the service rejects the move", async () => {
    // The real service rejects a request bound to a revision that is no longer current.
    const onMove = vi.fn((input: MoveNodeInput) =>
      service.moveNode({ ...input, expectedRevision: input.expectedRevision - 1 }),
    );
    const { service } = await mountCanvas(1, onMove);
    const weave = harness.latest();
    const node = connectedActiveNode(service);
    const canonicalLinks = canonicalLinksOf(service, node.nodeId);
    startDrag(weave, service, node.nodeId, { x: 30, y: 30 });
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot()).toMatchObject({ revision: 0, canUndo: false });
    expect(service.getSnapshot().notice?.message).toMatch(/document has changed/);
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x,
      y: node.geometry.y,
    });
    for (const link of canonicalLinks)
      expect(weave.stage.nodes.get(link.id)!.pts).toEqual(link.points);
    // Rejection keeps the renderer (no new canon) and the selection.
    expect(harness.latest()).toBe(weave);
    expect(service.getSnapshot().selection).toBe(node.nodeId);
  });

  it("gives a viewer no movement preview and never calls the move callback", async () => {
    const onMove = vi.fn(() => true);
    const { service } = await mountCanvas(1, onMove);
    act(() => service.setRole("viewer"));
    const weave = harness.latest();
    const node = connectedActiveNode(service);
    const canonicalLinks = canonicalLinksOf(service, node.nodeId);
    const outside = document.body.appendChild(document.createElement("button"));
    act(() => outside.focus());
    startDrag(weave, service, node.nodeId, { x: 30, y: 30 });
    // No preview, no capture, no focus change, no selection change from the attempted drag.
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x,
      y: node.geometry.y,
    });
    for (const link of canonicalLinks)
      expect(weave.stage.nodes.get(link.id)!.pts).toEqual(link.points);
    expect(frameEl().hasPointerCapture(1)).toBe(false);
    expect(document.activeElement).toBe(outside);
    expect(service.getSnapshot().selection).toBeNull();
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({ revision: 0, canUndo: false });
    // A viewer can still select through the renderer's click handler.
    act(() => weave.stage.click(node.nodeId));
    expect(service.getSnapshot().selection).toBe(node.nodeId);
    outside.remove();
  });

  it("never commits a fractional-origin node dragged away and back to the pointer origin", async () => {
    const onMove = vi.fn((input: MoveNodeInput) => service.moveNode(input));
    const service = createDemoService();
    await service.open("diagram");
    const node = connectedActiveNode(service);
    const origin = { x: 100.4, y: -37.65 };
    const state = service.getSnapshot();
    expect(
      service.moveNode({
        documentId: doc(service).documentId,
        pageId: state.pageId as string,
        layerId: state.layerId as string,
        nodeId: node.nodeId,
        ...origin,
        expectedRevision: state.revision,
      }),
    ).toBe(true);
    render(<CanvasHarness service={service} zoom={0.7} onMove={onMove} />);
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
    const weave = harness.latest();
    expect(weave.stage.scaleValue.x).toBe(0.7);
    const before = {
      revision: service.getSnapshot().revision,
      history: service.getSnapshot().history.length,
      json: JSON.stringify(doc(service)),
    };
    const start = clientOf(weave, { x: origin.x + 10, y: origin.y + 10 });
    pointer(sdkContainer(), "pointerdown", start);
    pointer(frameEl(), "pointermove", { x: start.x + 40, y: start.y + 25 });
    expect(weave.stage.nodes.get(node.nodeId)!.pos).not.toEqual(origin);
    pointer(frameEl(), "pointermove", start);
    // Back at the pointer origin the preview is the exact fractional canonical origin.
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual(origin);
    pointer(frameEl(), "pointerup", start);
    expect(onMove).not.toHaveBeenCalled();
    expect(service.getSnapshot().revision).toBe(before.revision);
    expect(service.getSnapshot().history).toHaveLength(before.history);
    expect(JSON.stringify(doc(service))).toBe(before.json);
    expect(harness.latest()).toBe(weave);
  });

  it("moves by exact world travel at a fractional zoom and commits the previewed value", async () => {
    const onMove = vi.fn((input: MoveNodeInput) => service.moveNode(input));
    const service = createDemoService();
    await service.open("diagram");
    render(<CanvasHarness service={service} zoom={0.7} onMove={onMove} />);
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
    const weave = harness.latest();
    const node = connectedActiveNode(service);
    const origin = { ...node.geometry };
    // 22 CSS px right / 15 up at 70% is 31.43 / -21.43 world units: fractional, never snapped.
    startDrag(weave, service, node.nodeId, { x: 22, y: -15 });
    const preview = { ...weave.stage.nodes.get(node.nodeId)!.pos };
    expectNear(preview, { x: origin.x + 22 / 0.7, y: origin.y - 15 / 0.7 });
    expect(Number.isInteger(preview.x) || Number.isInteger(preview.y)).toBe(false);
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toMatchObject(preview);
    expect(geometry(service, node.nodeId)).toEqual({ ...origin, ...preview });
    expect(service.getSnapshot()).toMatchObject({ revision: 1, canUndo: true });
  });

  it("submits exactly once even though releasing capture fires lostpointercapture", async () => {
    const onMove = vi.fn(() => false);
    const { service } = await mountCanvas(1, onMove);
    const node = connectedActiveNode(service);
    startDrag(harness.latest(), service, node.nodeId, { x: 25, y: -10 });
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({
      documentId: doc(service).documentId,
      pageId: service.getSnapshot().pageId,
      layerId: service.getSnapshot().layerId,
      nodeId: node.nodeId,
      x: node.geometry.x + 25,
      y: node.geometry.y - 10,
      expectedRevision: 0,
    });
  });

  const cancellations: Array<
    [string, (ctx: { service: Service; rerender: (zoom: number) => void }) => void]
  > = [
    [
      "Escape",
      () => {
        const outer = vi.fn();
        document.addEventListener("keydown", outer);
        fireEvent.keyDown(document.body, { key: "Escape" });
        document.removeEventListener("keydown", outer);
        // The drag consumes Escape, so the canvas does not also clear the selection.
        expect(outer).not.toHaveBeenCalled();
      },
    ],
    [
      "lost pointer capture",
      () => {
        const lost = new MouseEvent("lostpointercapture", { bubbles: true });
        Object.defineProperty(lost, "pointerId", { value: 1 });
        act(() => {
          frameEl().dispatchEvent(lost);
        });
      },
    ],
    [
      "window blur",
      () =>
        act(() => {
          window.dispatchEvent(new Event("blur"));
        }),
    ],
    ["pointer cancel", () => pointer(frameEl(), "pointercancel", { x: 0, y: 0 })],
    ["role change", ({ service }) => act(() => service.setRole("viewer"))],
    ["revision change", ({ service }) => act(() => service.addShape("rectangle"))],
    [
      "layer change",
      ({ service }) => {
        const page = doc(service).pages.find((p) => p.pageId === service.getSnapshot().pageId)!;
        const other = page.layers.find((l) => l.layerId !== service.getSnapshot().layerId)!;
        expect(other).toBeTruthy();
        act(() => service.setLayer(other.layerId));
      },
    ],
    [
      "page change",
      ({ service }) => {
        const other = doc(service).pages.find((p) => p.pageId !== service.getSnapshot().pageId)!;
        act(() => service.setPage(other.pageId));
      },
    ],
    ["zoom change", ({ rerender }) => rerender(1.5)],
    [
      "keyboard pan / scroll",
      () => {
        const viewport = screen.getByTestId("canvas-viewport");
        Object.defineProperty(viewport, "scrollLeft", {
          configurable: true,
          writable: true,
          value: 64,
        });
        fireEvent.scroll(viewport);
      },
    ],
  ];

  for (const [name, trigger] of cancellations) {
    it(`cancels on ${name} without a command and restores the preview`, async () => {
      const onMove = vi.fn((input: MoveNodeInput) => service.moveNode(input));
      const service = createDemoService();
      await service.open("diagram");
      const { rerender } = render(<CanvasHarness service={service} zoom={1} onMove={onMove} />);
      await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
      const weave = harness.latest();
      const node = connectedActiveNode(service);
      startDrag(weave, service, node.nodeId, { x: 30, y: 20 });
      expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
        x: node.geometry.x + 30,
        y: node.geometry.y + 20,
      });
      const revision = service.getSnapshot().revision;
      trigger({
        service,
        rerender: (zoom) =>
          rerender(<CanvasHarness service={service} zoom={zoom} onMove={onMove} />),
      });
      expect(frameEl().hasPointerCapture(1)).toBe(false);
      pointer(frameEl(), "pointermove", { x: 400, y: 400 });
      pointer(frameEl(), "pointerup", { x: 400, y: 400 });
      expect(onMove).not.toHaveBeenCalled();
      // Only the trigger itself may have changed revision; the drag never did.
      expect(geometry(service, node.nodeId)).toEqual(node.geometry);
      if (name !== "revision change") expect(service.getSnapshot().revision).toBe(revision);
      // Same renderer: preview restored in place. Replaced renderer: rebuilt from canon.
      const rendered = harness.latest().stage.nodes.get(node.nodeId);
      if (harness.latest() === weave)
        expect(rendered!.pos).toEqual({ x: node.geometry.x, y: node.geometry.y });
      // The selection made at drag start survives cancellation of the drag itself.
      if (
        [
          "Escape",
          "lost pointer capture",
          "window blur",
          "pointer cancel",
          "zoom change",
          "keyboard pan / scroll",
          "role change",
        ].includes(name)
      )
        expect(service.getSnapshot().selection).toBe(node.nodeId);
    });
  }

  describe("focus transfer within the document", () => {
    // Like the workspace: the adapter sits inside a labelled, focusable canvas region.
    async function mountInRegion(onMove: (input: MoveNodeInput) => boolean) {
      const service = createDemoService();
      await service.open("diagram");
      render(
        <>
          <button type="button">Before</button>
          <div role="region" aria-label="Diagram canvas" tabIndex={0}>
            <CanvasHarness service={service} zoom={1} onMove={onMove} />
          </div>
          <button type="button">After</button>
        </>,
      );
      await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
      const node = connectedActiveNode(service);
      return {
        service,
        node,
        weave: harness.latest(),
        region: screen.getByRole("region", { name: "Diagram canvas" }),
      };
    }

    function expectCancelled(
      service: Service,
      weave: FakeWeave,
      node: { nodeId: string; geometry: { x: number; y: number } },
      onMove: unknown,
    ) {
      expect(frameEl().hasPointerCapture(1)).toBe(false);
      expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
        x: node.geometry.x,
        y: node.geometry.y,
      });
      // A later release (and further travel) commits nothing.
      pointer(frameEl(), "pointermove", { x: 400, y: 400 });
      pointer(frameEl(), "pointerup", { x: 400, y: 400 });
      expect(onMove).not.toHaveBeenCalled();
      expect(service.getSnapshot()).toMatchObject({ revision: 0, canUndo: false });
      expect(geometry(service, node.nodeId)).toEqual(node.geometry);
    }

    it("focuses the canvas region on a drag press and cancels when Tab moves focus away", async () => {
      const onMove = vi.fn(() => true);
      const { service, node, weave, region } = await mountInRegion(onMove);
      const before = screen.getByRole("button", { name: "Before" });
      act(() => before.focus());
      startDrag(weave, service, node.nodeId, { x: 30, y: 20 });
      expect(document.activeElement).toBe(region);
      expect(frameEl().hasPointerCapture(1)).toBe(true);
      // Tab: jsdom has no default focus navigation, so perform the transition the browser makes.
      fireEvent.keyDown(region, { key: "Tab" });
      act(() => screen.getByRole("button", { name: "After" }).focus());
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
      expectCancelled(service, weave, node, onMove);
      // Cancelling the drag keeps the selection and leaves keyboard focus where the user put it.
      expect(service.getSnapshot().selection).toBe(node.nodeId);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    });

    it("cancels when focus drops out of the region to the document body", async () => {
      const onMove = vi.fn(() => true);
      const { service, node, weave, region } = await mountInRegion(onMove);
      startDrag(weave, service, node.nodeId, { x: 30, y: 20 });
      expect(document.activeElement).toBe(region);
      await act(async () => region.blur());
      expect(document.activeElement).toBe(document.body);
      expectCancelled(service, weave, node, onMove);
    });

    it("keeps the drag when focus moves within the canvas region and commits once", async () => {
      const onMove = vi.fn(() => true);
      const { service, node, weave } = await mountInRegion(onMove);
      startDrag(weave, service, node.nodeId, { x: 30, y: 20 });
      await act(async () => screen.getByTestId("canvas-viewport").focus());
      expect(document.activeElement).toBe(screen.getByTestId("canvas-viewport"));
      expect(frameEl().hasPointerCapture(1)).toBe(true);
      pointer(frameEl(), "pointerup", { x: 0, y: 0 });
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith(
        expect.objectContaining({ x: node.geometry.x + 30, y: node.geometry.y + 20 }),
      );
    });
  });

  it("does not start a drag on a node of another (dimmed) layer", async () => {
    const onMove = vi.fn(() => true);
    const { service } = await mountCanvas(1, onMove);
    const node = connectedActiveNode(service);
    // Focus another layer: the node's own layer is now dimmed.
    const page = doc(service).pages.find((p) => p.pageId === service.getSnapshot().pageId)!;
    const other = page.layers.find((l) => l.layerId !== service.getSnapshot().layerId)!;
    act(() => service.setLayer(other.layerId));
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
    const weave = harness.latest();
    startDrag(weave, service, node.nodeId, { x: 30, y: 30 });
    expect(weave.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x,
      y: node.geometry.y,
    });
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("cancels on unmount mid-drag: capture released, nothing committed", async () => {
    const onMove = vi.fn(() => true);
    const { service, unmount } = await mountCanvas(1, onMove);
    const node = connectedActiveNode(service);
    startDrag(harness.latest(), service, node.nodeId, { x: 30, y: 30 });
    const frame = frameEl();
    expect(frame.hasPointerCapture(1)).toBe(true);
    unmount();
    expect(frame.hasPointerCapture(1)).toBe(false);
    pointer(window, "pointerup", { x: 0, y: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe("viewport and renderer resource ownership", () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    observed: Element[] = [];
    disconnected = false;
    constructor(public callback: () => void) {
      FakeResizeObserver.instances.push(this);
    }
    observe(element: Element) {
      this.observed.push(element);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("gives the SDK a separate container, so it cannot override the sticky frame", async () => {
    await mountCanvas(1);
    const weave = harness.latest();
    expect(weave.stageConfig!.container).toBe(sdkContainer());
    expect(sdkContainer().style.position).toBe("relative"); // the SDK's own override
    expect(frameEl().className).toBe("pc-weave"); // sticky via the stylesheet
    expect(frameEl().style.position).toBe("");
    expect(sdkContainer().parentElement).toBe(frameEl());
    // The stage is sized from the viewport frame.
    expect(weave.stage.size).toEqual({ width: 700, height: 600 });
  });

  it("owns one ResizeObserver instead of the SDK resize plugin and disconnects it on unmount", async () => {
    const { service, unmount } = await mountCanvas(1);
    expect(harness.latest().config.plugins).toEqual([]);
    expect(FakeResizeObserver.instances).toHaveLength(1);
    const observer = FakeResizeObserver.instances[0];
    expect(observer.observed).toEqual([frameEl()]);

    // A resize updates the current stage.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => 900);
    act(() => observer.callback());
    expect(harness.latest().stage.size.width).toBe(900);

    // Renderer replacement (an accepted command) adds no observers.
    act(() => service.addShape("rectangle"));
    await waitFor(() => expect(harness.instances.length).toBeGreaterThan(1));
    expect(FakeResizeObserver.instances).toHaveLength(1);
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it("releases every renderer across construction failure, start failure, retry, replacement and unmount", async () => {
    const added = new Map<string, number>();
    const removed = new Map<string, number>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      added.set(type, (added.get(type) ?? 0) + 1);
      add(type, listener, options);
    });
    vi.spyOn(window, "removeEventListener").mockImplementation((type, listener, options) => {
      removed.set(type, (removed.get(type) ?? 0) + 1);
      remove(type, listener, options);
    });
    const docAdded = new Map<string, number>();
    const docRemoved = new Map<string, number>();
    const docAdd = document.addEventListener.bind(document);
    const docRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
      docAdded.set(type, (docAdded.get(type) ?? 0) + 1);
      docAdd(type, listener, options);
    });
    vi.spyOn(document, "removeEventListener").mockImplementation((type, listener, options) => {
      docRemoved.set(type, (docRemoved.get(type) ?? 0) + 1);
      docRemove(type, listener, options);
    });

    harness.failNextConstruct = "simulated construction failure";
    const service = createDemoService();
    await service.open("diagram");
    const { unmount } = render(<CanvasHarness service={service} zoom={1} />);
    await screen.findByText(/simulated construction failure/);
    expect(harness.instances).toHaveLength(0);

    harness.failNextStart = "simulated start failure";
    fireEvent.click(screen.getByRole("button", { name: "Retry canvas" }));
    await screen.findByText(/simulated start failure/);
    // A failed start is released immediately, not only on the next retry.
    await waitFor(() => expect(harness.instances[0].destroyed).toBe(true));
    expect(harness.instances[0].stage.handlers.size).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Retry canvas" }));
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
    act(() => service.addShape("rectangle"));
    await waitFor(() => expect(harness.instances.length).toBe(3));
    await waitFor(() => expect(harness.instances[1].destroyed).toBe(true));
    expect(harness.instances[1].stage.handlers.size).toBe(0);

    unmount();
    await waitFor(() =>
      expect(harness.instances.every((instance) => instance.destroyed)).toBe(true),
    );
    expect(harness.latest().stage.handlers.size).toBe(0);
    for (const type of ["pointermove", "pointerup", "pointercancel", "keydown", "blur"])
      expect(removed.get(type), type).toBe(added.get(type));
    for (const type of ["focusin", "focusout", "visibilitychange"]) {
      expect(docAdded.get(type), type).toBeGreaterThan(0);
      expect(docRemoved.get(type), type).toBe(docAdded.get(type));
    }
    // Every instance was released exactly once and never overlapped another's start.
    for (const instance of harness.instances) expect(instance.destroyCalls).toBe(1);
    expect(harness.liveStages()).toEqual([]);
    expect(harness.violations).toEqual([]);
  });
});

/** Lets queued renderer lifecycle steps (start/destroy promise chains) run. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("renderer lifecycle with a delayed SDK start", () => {
  beforeEach(installPointerCapture);
  afterEach(removePointerCapture);

  it("destroys a start that resolves after unmount exactly once, leaving no live stage", async () => {
    harness.holdStarts = true;
    const service = createDemoService();
    await service.open("diagram");
    const { unmount } = render(<CanvasHarness service={service} zoom={1} />);
    await waitFor(() => expect(harness.held).toHaveLength(1));
    const pending = harness.instances[0];
    expect(pending.startCalls).toBe(1);
    unmount();
    await settle();
    // Teardown waits for its own start: destroying now could not release the later stage.
    expect(pending.destroyCalls).toBe(0);
    act(() => harness.releaseStarts());
    await waitFor(() => expect(pending.destroyed).toBe(true));
    await settle();
    expect(pending.started).toBe(true); // the SDK did create its stage late...
    expect(harness.liveStages()).toEqual([]); // ...and it was destroyed, not resurrected
    expect(pending.destroyCalls).toBe(1);
    expect(pending.stage.handlers.size).toBe(0); // the late start registered no listeners
    expect(harness.violations).toEqual([]);
  });

  it("never starts an instance unmounted before its turn", async () => {
    const service = createDemoService();
    await service.open("diagram");
    const { unmount } = render(<CanvasHarness service={service} zoom={1} />);
    unmount();
    await settle();
    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0].startCalls).toBe(0);
    expect(harness.instances[0].destroyCalls).toBe(0);
    expect(harness.liveStages()).toEqual([]);
  });

  it("keeps repeated replacement usable after the old teardown, with one live stage", async () => {
    harness.holdStarts = true;
    const service = createDemoService();
    await service.open("diagram");
    const onMove = vi.fn((input: MoveNodeInput) => service.moveNode(input));
    render(<CanvasHarness service={service} zoom={1} onMove={onMove} />);
    await waitFor(() => expect(harness.held).toHaveLength(1));
    const first = harness.instances[0];
    // Two accepted commands while the first start is still pending: two replacements.
    act(() => service.addShape("rectangle"));
    act(() => service.addShape("rectangle"));
    expect(harness.instances).toHaveLength(3);
    const [, skipped, current] = harness.instances;
    await settle();
    // Nothing else starts while the first start (and then its destroy) is outstanding.
    expect(skipped.startCalls + current.startCalls).toBe(0);
    act(() => harness.releaseStarts());
    await waitFor(() => expect(current.stage.handlers.has("click")).toBe(true), SLOW);
    await settle();
    expect(first.destroyCalls).toBe(1);
    expect(first.stage.destroyed).toBe(true);
    expect(first.stage.handlers.size).toBe(0);
    expect(skipped.startCalls).toBe(0); // superseded before its turn: never started
    expect(skipped.destroyCalls).toBe(0);
    expect(harness.liveStages()).toEqual([current]);
    expect(harness.violations).toEqual([]);

    // The surviving renderer works after the old teardown completed.
    const node = connectedActiveNode(service);
    const revision = service.getSnapshot().revision;
    startDrag(current, service, node.nodeId, { x: 25, y: 15 });
    expect(current.stage.nodes.get(node.nodeId)!.pos).toEqual({
      x: node.geometry.x + 25,
      y: node.geometry.y + 15,
    });
    pointer(frameEl(), "pointerup", { x: 0, y: 0 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot().revision).toBe(revision + 1);
    await waitFor(() => expect(current.destroyed).toBe(true));
    await waitFor(() => expect(harness.latest().stage.handlers.has("click")).toBe(true), SLOW);
    expect(harness.liveStages()).toEqual([harness.latest()]);
    expect(harness.violations).toEqual([]);
  });
});

describe("native scroll viewport", () => {
  it("translates the stage by the scroll offset without a command", async () => {
    const { service } = await mountCanvas(2);
    const viewport = screen.getByTestId("canvas-viewport");
    const weave = harness.latest();
    const before = { ...weave.stage.positionValue };
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 300,
    });
    fireEvent.scroll(viewport);
    expect(weave.stage.positionValue.x).toBe(before.x - 300);
    expect(service.getSnapshot().revision).toBe(0);
    // The extent spacer, not the sticky frame, defines the scroll range.
    const extent = screen.getByTestId("canvas-extent");
    expect(parseFloat(extent.style.width)).toBeGreaterThan(700);
  });
});
