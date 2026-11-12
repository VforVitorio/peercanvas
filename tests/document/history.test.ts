import { describe, expect, it } from "vitest";
import { createDocument, executeCommand, type ModelState, type Node } from "../../src/document";
import { createDocumentHistory } from "../../src/document/history";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const start = "2026-11-11T10:00:00.000Z";
const node = (n: number): Node => ({
  nodeId: id(n),
  type: "rectangle",
  text: `Node ${n}`,
  geometry: { x: 0, y: 0, width: 100, height: 60, rotation: 0 },
  styleId: null,
  catalogReference: null,
});
const connection = (n: number, source = 4, target = 5) => ({
  connectionId: id(n),
  sourceNodeId: id(source),
  targetNodeId: id(target),
  routing: "straight",
  label: `Connection ${n}`,
  styleId: null,
});
function fixture() {
  const created = createDocument({
    documentId: id(1),
    pageId: id(2),
    layerId: id(3),
    title: "History",
    now: start,
  });
  if (!created.ok) throw new Error("Invalid fixture");
  let state = created.value;
  const history = createDocumentHistory();
  let tick = 0;
  const context = () => ({
    expectedRevision: state.revision,
    now: `2026-11-11T10:00:${String(++tick).padStart(2, "0")}.000Z`,
  });
  const apply = (command: unknown) => {
    const before = state;
    const result = executeCommand(before, command, context());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    history.record(before, command);
    state = result.value.state;
  };
  const replay = (direction: "undo" | "redo") => {
    const result = history[direction](state, context());
    if (!result?.ok) throw new Error(JSON.stringify(result));
    state = result.value.state;
  };
  return { history, apply, replay, state: () => state };
}
const addNode = (n: number, index: number, layerId = id(3)) => ({
  type: "node.add",
  pageId: id(2),
  layerId,
  node: node(n),
  index,
});
const semantic = (state: ModelState) => ({
  ...state.document,
  metadata: { ...state.document.metadata, updatedAt: start },
});

describe("canonical command history", () => {
  it("undoes and redoes an atomic batch while keeping revisions and timestamps monotonic", () => {
    const f = fixture();
    const initial = semantic(f.state());
    f.apply({
      type: "batch",
      commands: [
        addNode(4, 0),
        addNode(5, 1),
        {
          type: "connection.add",
          pageId: id(2),
          layerId: id(3),
          connection: connection(6),
          index: 0,
        },
      ],
    });
    const edited = semantic(f.state());
    expect(f.state().revision).toBe(1);
    f.replay("undo");
    expect(semantic(f.state())).toEqual(initial);
    expect(f.state().revision).toBe(2);
    f.replay("redo");
    expect(semantic(f.state())).toEqual(edited);
    expect(f.state().revision).toBe(3);
    expect(f.state().document.metadata.updatedAt).toBe("2026-11-11T10:00:03.000Z");
  });

  it("does not record rejected or semantic no-op commands or invalidate redo for them", () => {
    const f = fixture();
    f.apply(addNode(4, 0));
    f.replay("undo");
    f.history.record(f.state(), { type: "unknown" });
    f.history.record(f.state(), { type: "page.rename", pageId: id(2), name: "Page 1" });
    expect(f.history.canUndo).toBe(false);
    expect(f.history.canRedo).toBe(true);
    f.replay("redo");
    expect(f.state().document.pages[0].layers[0].nodes).toHaveLength(1);
  });

  it("detaches forward and inverse payloads and invalidates redo after a new edit", () => {
    const f = fixture();
    const command = addNode(4, 0);
    f.apply(command);
    command.node.text = "Caller mutated";
    f.replay("undo");
    f.replay("redo");
    expect(f.state().document.pages[0].layers[0].nodes[0].text).toBe("Node 4");
    f.apply({
      type: "node.update",
      pageId: id(2),
      layerId: id(3),
      node: { ...node(4), text: "Edited" },
    });
    f.replay("undo");
    expect(f.state().document.pages[0].layers[0].nodes[0].text).toBe("Node 4");
    f.apply(addNode(5, 1));
    expect(f.history.canRedo).toBe(false);
  });

  it("restores incident connectors owned by other layers in their original order", () => {
    const f = fixture();
    f.apply({
      type: "batch",
      commands: [
        addNode(4, 0),
        addNode(5, 1),
        {
          type: "layer.add",
          pageId: id(2),
          layer: {
            layerId: id(7),
            name: "Links",
            nodes: [],
            connections: [connection(8), connection(9, 5, 4)],
          },
          index: 1,
        },
      ],
    });
    const before = semantic(f.state());
    f.apply({ type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) });
    expect(f.state().document.pages[0].layers[1].connections).toHaveLength(0);
    f.replay("undo");
    expect(semantic(f.state())).toEqual(before);
    f.replay("redo");
    expect(f.state().document.pages[0].layers[1].connections).toHaveLength(0);
  });

  it("reverses page/layer additions, renames, ordering and subtree deletions", () => {
    const f = fixture();
    f.apply({
      type: "batch",
      commands: [
        addNode(4, 0),
        {
          type: "layer.add",
          pageId: id(2),
          layer: { layerId: id(7), name: "Other", nodes: [node(5)], connections: [connection(8)] },
          index: 1,
        },
        {
          type: "page.add",
          page: {
            pageId: id(9),
            name: "Second",
            layers: [{ layerId: id(10), name: "Main", nodes: [], connections: [] }],
          },
          index: 1,
        },
      ],
    });
    const initial = semantic(f.state());
    const commands = [
      { type: "page.rename", pageId: id(2), name: "Overview" },
      { type: "layer.rename", pageId: id(2), layerId: id(7), name: "Connections" },
      { type: "page.reorder", pageIds: [id(9), id(2)] },
      { type: "layer.reorder", pageId: id(2), layerIds: [id(7), id(3)] },
      { type: "layer.remove", pageId: id(2), layerId: id(3) },
      { type: "page.remove", pageId: id(2) },
    ];
    for (const command of commands) f.apply(command);
    commands.forEach(() => f.replay("undo"));
    expect(semantic(f.state())).toEqual(initial);
    commands.forEach(() => f.replay("redo"));
    expect(f.state().document.pages.map((p) => p.pageId)).toEqual([id(9)]);
  });

  it("reverses connector updates and removal", () => {
    const f = fixture();
    const style = {
      styleId: id(10),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      fontSize: 16,
      textColor: "#000000",
    };
    f.apply({
      type: "batch",
      commands: [
        addNode(4, 0),
        addNode(5, 1),
        {
          type: "connection.add",
          pageId: id(2),
          layerId: id(3),
          connection: connection(6),
          index: 0,
        },
        { type: "style.put", style },
      ],
    });
    const initial = semantic(f.state());
    f.apply({
      type: "connection.update",
      pageId: id(2),
      layerId: id(3),
      connection: { ...connection(6), label: "Edited", styleId: id(10) },
    });
    f.apply({ type: "connection.remove", pageId: id(2), layerId: id(3), connectionId: id(6) });
    f.replay("undo");
    f.replay("undo");
    expect(semantic(f.state())).toEqual(initial);
  });

  it("does not promise Undo for style removal when canonical order cannot be restored", () => {
    const f = fixture();
    const styles = [10, 11, 12].map((n) => ({
      styleId: id(n),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      fontSize: 16,
      textColor: "#000000",
    }));
    f.apply({ type: "batch", commands: styles.map((style) => ({ type: "style.put", style })) });
    expect(f.history.canUndo).toBe(true);
    f.apply({ type: "style.remove", styleId: id(11) });
    expect(f.state().document.styles.map((style) => style.styleId)).toEqual([id(10), id(12)]);
    expect(f.history.canUndo).toBe(false);
    expect(f.history.canRedo).toBe(false);
    expect(
      f.history.undo(f.state(), {
        expectedRevision: f.state().revision,
        now: f.state().document.metadata.updatedAt,
      }),
    ).toBeNull();
  });

  it("keeps stacks intact when replay fails revision or timestamp validation and clears on reopen", () => {
    const f = fixture();
    f.apply(addNode(4, 0));
    const state = f.state();
    expect(f.history.undo(state, { expectedRevision: 0, now: start })?.ok).toBe(false);
    expect(f.history.undo(state, { expectedRevision: state.revision, now: start })?.ok).toBe(false);
    expect(f.history.canUndo).toBe(true);
    expect(f.history.canRedo).toBe(false);
    f.replay("undo");
    f.history.clear();
    expect(f.history.canUndo).toBe(false);
    expect(f.history.canRedo).toBe(false);
    expect(
      f.history.undo(f.state(), { expectedRevision: f.state().revision, now: start }),
    ).toBeNull();
  });

  it("does not advertise a cascade inverse larger than the canonical batch limit", () => {
    const f = fixture();
    const before = f.state();
    before.document.pages[0].layers[0].nodes = [node(4), node(5)];
    before.document.pages[0].layers[0].connections = Array.from({ length: 1000 }, (_, i) =>
      connection(100 + i),
    );
    f.history.record(before, { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) });
    expect(f.history.canUndo).toBe(false);
    expect(f.history.canRedo).toBe(false);
  });
});
