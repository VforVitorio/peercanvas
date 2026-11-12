import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, executeCommand, type Document, type Geometry } from "../document";
import { harness } from "../ui-mock/ui/test/weaveMock";
import { InteractiveWeave, RectangleNode, SelectionPlugin } from "./weaveTestHarness";
import WeaveCanvas from "./WeaveCanvas";

vi.mock("@inditextech/weave-sdk", async () => (await import("./weaveTestHarness")).interactiveSdk);
vi.mock(
  "@inditextech/weave-renderer-konva-base",
  async () => (await import("../ui-mock/ui/test/weaveMock")).renderer,
);
vi.mock(
  "@inditextech/weave-store-standalone/client",
  async () => (await import("../ui-mock/ui/test/weaveMock")).store,
);

const nodeId = "40000000-0000-4000-8000-000000000000";
const geometry: Geometry = { x: 10, y: 20, width: 120, height: 80, rotation: 0 };
let doc: Document;

beforeEach(() => {
  harness.reset();
  const created = createDocument({
    documentId: "10000000-0000-4000-8000-000000000000",
    pageId: "20000000-0000-4000-8000-000000000000",
    layerId: "30000000-0000-4000-8000-000000000000",
    title: "Canvas fixture",
    now: "2026-11-11T10:00:00.000Z",
  });
  if (!created.ok) throw new Error("Invalid fixture");
  doc = created.value.document;
  doc.pages[0].layers[0].nodes.push({
    nodeId,
    type: "rectangle",
    geometry: { ...geometry },
    text: "",
    styleId: null,
    catalogReference: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function mount(onCommitGeometry?: (id: string, geometry: Geometry) => boolean) {
  const onSelect = vi.fn();
  const view = render(
    <WeaveCanvas
      document={doc}
      pageId={doc.pages[0].pageId}
      layerId={doc.pages[0].layers[0].layerId}
      selection={nodeId}
      zoom={1}
      fitRequest={0}
      onSelect={onSelect}
      onZoomChange={() => undefined}
      onCommitGeometry={onCommitGeometry}
    />,
  );
  await waitFor(() => expect(screen.queryByText("Starting Weave canvas…")).toBeNull());
  return { ...view, instance: harness.latest() as InteractiveWeave, onSelect };
}

const pluginOf = (instance: InteractiveWeave) =>
  instance.options.plugins.find((entry) => entry instanceof SelectionPlugin) as SelectionPlugin;

describe("canonical geometry gesture boundary", () => {
  it.each(
    ["drag", "transform"].flatMap((gesture) =>
      ["node", "transformer"].map((source) => ({ gesture, source })),
    ),
  )("commits $gesture from $source once after all Weave handlers", async ({ gesture, source }) => {
    const commit = vi.fn(() => true);
    const { instance } = await mount(commit);
    const node = instance.nodes.get(nodeId)!;
    const transformer = pluginOf(instance).getTransformer();
    const events = source === "node" ? node : transformer;
    const duplicate = source === "node" ? transformer : node;
    // Registered after the adapter, like the node's later resize/serialization handlers.
    events.on(`${gesture}end.weave`, () =>
      Object.assign(
        node.element.props,
        gesture === "drag" ? { x: 65, y: 60 } : { width: 300, height: 135, scaleX: 1, scaleY: 1 },
      ),
    );
    await act(async () => {
      events.fire(`${gesture}start`);
      Object.assign(
        node.element.props,
        gesture === "drag" ? { x: 35, y: 50 } : { width: 100, height: 80, scaleX: 2, scaleY: 1.5 },
      );
      events.fire(gesture === "drag" ? "dragmove" : "transform");
    });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => {
      events.fire(`${gesture}end`);
      duplicate.fire(`${gesture}end`);
      events.fire(`${gesture}end`);
      expect(commit).not.toHaveBeenCalled();
    });
    expect(commit).toHaveBeenCalledExactlyOnceWith(
      nodeId,
      gesture === "drag" ? { ...geometry, x: 65, y: 60 } : { ...geometry, width: 300, height: 135 },
    );
    expect(doc.pages[0].layers[0].nodes[0].geometry).toEqual(geometry);
    await waitFor(() => expect(instance.destroyCalls).toBe(1));
  });

  it.each(
    ["drag", "transform"].flatMap((gesture) =>
      ["pointercancel", "Escape", "blur"].map((cancel) => ({ gesture, cancel })),
    ),
  )("discards $cancel during $gesture without a command", async ({ gesture, cancel }) => {
    const commit = vi.fn(() => true);
    const { instance } = await mount(commit);
    const node = instance.nodes.get(nodeId)!;
    const transformer = pluginOf(instance).getTransformer();
    await act(async () => {
      transformer.fire(`${gesture}start`);
      node.element.props.x = 90;
    });
    if (cancel === "Escape") fireEvent.keyDown(window, { key: "Escape" });
    else fireEvent(window, new Event(cancel));
    await act(async () => transformer.fire(`${gesture}end`));
    expect(commit).not.toHaveBeenCalled();
    await waitFor(() => expect(instance.destroyCalls).toBe(1));
    expect((harness.latest() as InteractiveWeave).nodes.get(nodeId)!.x()).toBe(geometry.x);
    expect(doc.pages[0].layers[0].nodes[0].geometry).toEqual(geometry);
  });

  it("redraws an accepted command from the new canonical snapshot", async () => {
    function Editor() {
      const [state, setState] = useState({ document: doc, revision: 0 });
      return (
        <WeaveCanvas
          document={state.document}
          pageId={doc.pages[0].pageId}
          layerId={doc.pages[0].layers[0].layerId}
          selection={nodeId}
          zoom={1}
          fitRequest={0}
          onSelect={() => undefined}
          onZoomChange={() => undefined}
          onCommitGeometry={(id, next) => {
            const result = executeCommand(
              state,
              {
                type: "node.update",
                pageId: doc.pages[0].pageId,
                layerId: doc.pages[0].layers[0].layerId,
                node: { ...doc.pages[0].layers[0].nodes[0], nodeId: id, geometry: next },
              },
              { expectedRevision: state.revision, now: "2026-11-11T10:00:01.000Z" },
            );
            if (!result.ok) return false;
            setState(result.value.state);
            return true;
          }}
        />
      );
    }
    render(<Editor />);
    await waitFor(() => expect(screen.queryByText("Starting Weave canvas…")).toBeNull());
    const original = harness.latest() as InteractiveWeave;
    await act(async () => {
      const node = original.nodes.get(nodeId)!;
      node.fire("dragstart");
      node.element.props.x = 95;
      node.fire("dragend");
    });
    await waitFor(() =>
      expect((harness.latest() as InteractiveWeave).nodes.get(nodeId)!.x()).toBe(95),
    );
    expect(doc.pages[0].layers[0].nodes[0].geometry).toEqual(geometry);
    expect(original.destroyCalls).toBe(1);
  });

  it.each([false, "throw"])(
    "rebuilds from the canonical document on callback rejection (%s)",
    async (outcome) => {
      const commit = vi.fn(() => {
        if (outcome === "throw") throw new Error("Rejected");
        return false;
      });
      const { instance } = await mount(commit);
      await act(async () => {
        const node = instance.nodes.get(nodeId)!;
        pluginOf(instance).getTransformer().fire("dragstart");
        node.element.props.x = 90;
        pluginOf(instance).getTransformer().fire("dragend");
      });
      expect(commit).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(instance.destroyCalls).toBe(1));
      expect((harness.latest() as InteractiveWeave).nodes.get(nodeId)!.x()).toBe(geometry.x);
    },
  );

  it.each([{ x: NaN }, { width: -2 }, { y: Infinity }, { rotation: 20 }, { x: 1_000_001 }])(
    "rejects invalid renderer geometry %o",
    async (props) => {
      const commit = vi.fn(() => true);
      const { instance } = await mount(commit);
      await act(async () => {
        const node = instance.nodes.get(nodeId)!;
        node.fire("transformstart");
        Object.assign(node.element.props, props);
        node.fire("transformend");
      });
      expect(commit).not.toHaveBeenCalled();
      await waitFor(() => expect(instance.destroyCalls).toBe(1));
    },
  );

  it("tears down an in-progress gesture exactly once and ignores late events", async () => {
    const commit = vi.fn(() => true);
    const { instance, unmount } = await mount(commit);
    const node = instance.nodes.get(nodeId)!;
    await act(async () => {
      node.fire("dragstart");
      node.element.props.x = 90;
    });
    unmount();
    node.fire("dragend");
    fireEvent(window, new Event("blur"));
    await waitFor(() => expect(instance.destroyCalls).toBe(1));
    expect(commit).not.toHaveBeenCalled();
    expect(instance.listeners.size).toBe(0);
    expect(node.handlers.size).toBe(0);
    expect(pluginOf(instance).getTransformer().handlers.size).toBe(0);
  });

  it("keeps the existing UI mock read-only without interaction plugins", async () => {
    const { instance, onSelect } = await mount();
    expect(instance.options.actions).toEqual([]);
    expect(instance.options.plugins.some((plugin) => plugin instanceof SelectionPlugin)).toBe(
      false,
    );
    expect(instance.nodes.get(nodeId)!.element.props.draggable).toBe(false);
    expect(instance.nodes.get(nodeId)!.handlers.size).toBe(0);
    await act(async () => instance.stage.click(nodeId));
    expect(onSelect).toHaveBeenCalledWith(nodeId);
    expect(doc.pages[0].layers[0].nodes[0].geometry).toEqual(geometry);
  });

  it("cancels a queued Transformer commit before Weave's event stack finishes", async () => {
    const commit = vi.fn(() => true);
    const { instance } = await mount(commit);
    const transformer = pluginOf(instance).getTransformer();
    await act(async () => {
      transformer.fire("dragstart");
      instance.nodes.get(nodeId)!.element.props.x = 90;
      transformer.fire("dragend");
      fireEvent(window, new Event("pointercancel"));
    });
    expect(commit).not.toHaveBeenCalled();
    await waitFor(() => expect(instance.destroyCalls).toBe(1));
    expect((harness.latest() as InteractiveWeave).nodes.get(nodeId)!.x()).toBe(geometry.x);
  });

  it("blocks renderer double-tap editing through the public gesture API", async () => {
    const { instance } = await mount(() => true);
    const plugin = pluginOf(instance);
    expect(Object.hasOwn(instance.nodes.get(nodeId)!, "dblClick")).toBe(false);
    fireEvent.pointerDown(screen.getByTestId("weave-container"));
    expect(plugin.getGesture().resets).toBe(1);
    expect(doc.pages[0].layers[0].nodes[0].text).toBe("");
  });

  it("blocks Weave's window mousemove clone path when Alt is pressed mid-drag", async () => {
    const { instance } = await mount(() => true);
    const container = instance.getStage()!.container();
    const laterMousemove = vi.fn();
    window.addEventListener("mousemove", laterMousemove);
    try {
      fireEvent.pointerDown(container, { pointerId: 1, buttons: 1 });
      fireEvent(window, new MouseEvent("mousemove", { altKey: true, buttons: 1, bubbles: true }));
      expect(laterMousemove).not.toHaveBeenCalled();
      fireEvent(window, new MouseEvent("mousemove", { buttons: 1, bubbles: true }));
      expect(laterMousemove).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(container, { pointerId: 1 });
      fireEvent(window, new MouseEvent("mousemove", { altKey: true, buttons: 1, bubbles: true }));
      expect(laterMousemove).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener("mousemove", laterMousemove);
    }
  });

  it("uses transient selection with rotation disabled", async () => {
    const { instance, onSelect } = await mount(() => true);
    const plugin = instance.options.plugins.find(
      (entry) => entry instanceof SelectionPlugin,
    ) as SelectionPlugin;
    expect(instance.action).toBe("selectionTool");
    expect(plugin.options).toMatchObject({
      config: { selection: { rotateEnabled: false, flipEnabled: false } },
    });
    expect(plugin.getSelectedNodes()[0].id()).toBe(nodeId);
    await act(async () => {
      plugin.setSelectedNodes([]);
      instance.listeners.get("onNodesChange")?.(null);
    });
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(doc.pages[0].layers[0].nodes[0].geometry).toEqual(geometry);
  });

  it("keeps Weave's focused canvas in normal tab order after selection", async () => {
    const { instance } = await mount(() => true);
    const container = instance.getStage()!.container();
    expect(container.tabIndex).toBe(0);
    container.tabIndex = 1;
    await act(async () => instance.listeners.get("onNodesChange")?.(null));
    expect(container.tabIndex).toBe(0);
  });

  it("restores external keyboard focus after Weave starts", async () => {
    render(<button>Outside control</button>);
    const outside = screen.getByRole("button", { name: "Outside control" });
    outside.focus();
    await mount(() => true);
    expect(document.activeElement).toBe(outside);
  });

  it("enables lateral resize and commits the right-handle width on transformend", async () => {
    const commit = vi.fn(() => true);
    const { instance } = await mount(commit);
    const plugin = pluginOf(instance);
    const expectedTransform = {
      rotateEnabled: false,
      flipEnabled: false,
      resizeEnabled: true,
      keepRatio: false,
      enabledAnchors: expect.arrayContaining(["middle-right", "middle-left", "bottom-right"]),
    };
    expect(plugin.options).toMatchObject({ config: { selection: expectedTransform } });
    const rectangle = instance.options.nodes.find(
      (node) => node instanceof RectangleNode,
    ) as RectangleNode;
    expect(rectangle.options).toMatchObject({ config: { transform: expectedTransform } });
    const transformer = plugin.getTransformer();
    const node = instance.nodes.get(nodeId)!;
    await act(async () => {
      transformer.fire("transformstart");
      node.element.props.scaleX = 1.5;
      transformer.fire("transform");
    });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => transformer.fire("transformend"));
    expect(commit).toHaveBeenCalledExactlyOnceWith(nodeId, { ...geometry, width: 180 });
  });
  it("highlights the selected connector without changing its canonical style", async () => {
    const layer = doc.pages[0].layers[0];
    const targetId = "40000000-0000-4000-8000-000000000001";
    const connectionId = "50000000-0000-4000-8000-000000000000";
    layer.nodes.push({ ...layer.nodes[0], nodeId: targetId, geometry: { ...geometry, x: 300 } });
    layer.connections.push({
      connectionId,
      sourceNodeId: nodeId,
      targetNodeId: targetId,
      routing: "straight",
      label: "Link",
      styleId: null,
    });
    const before = JSON.stringify(doc);
    render(
      <WeaveCanvas
        document={doc}
        pageId={doc.pages[0].pageId}
        layerId={layer.layerId}
        selection={null}
        connectionSelection={connectionId}
        zoom={1}
        fitRequest={0}
        onSelect={() => undefined}
        onZoomChange={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.queryByText("Starting Weave canvas…")).toBeNull());
    const arrow = harness
      .latest()
      .elements.find((value) => value.key === `pc-connection-${connectionId}`);
    expect(arrow?.props.stroke).toBe("#005CBA");
    expect(JSON.stringify(doc)).toBe(before);
  });
});
