import { describe, expect, it } from "vitest";
import { executeCommand, parseDocument, serializeDocument } from "../document";
import { createSample, LAYER_ID, PAGE_ID } from "./sample";

describe("editor reopen fixture", () => {
  it("retains edited properties, IDs, page/layer order and connectors through serialization", () => {
    const state = createSample("2026-11-11T10:00:00.000Z");
    const [overview, delivery] = state.document.pages;
    const [main, notes] = overview.layers;
    const node = main.nodes[0];
    const connection = main.connections[0];
    const edited = executeCommand(
      state,
      {
        type: "batch",
        commands: [
          { type: "page.rename", pageId: PAGE_ID, name: "Planning" },
          { type: "layer.rename", pageId: PAGE_ID, layerId: notes.layerId, name: "Annotations" },
          { type: "page.reorder", pageIds: [delivery.pageId, overview.pageId] },
          { type: "layer.reorder", pageId: PAGE_ID, layerIds: [notes.layerId, LAYER_ID] },
          {
            type: "node.update",
            pageId: PAGE_ID,
            layerId: LAYER_ID,
            node: {
              ...node,
              text: "A refined idea",
              geometry: { ...node.geometry, x: 95, width: 220 },
              styleId: state.document.styles[0].styleId,
            },
          },
          {
            type: "connection.update",
            pageId: PAGE_ID,
            layerId: LAYER_ID,
            connection: { ...connection, label: "Validated proposal" },
          },
        ],
      },
      { expectedRevision: state.revision, now: "2026-11-11T10:01:00.000Z" },
    );
    if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
    const serialized = serializeDocument(edited.value.state.document);
    if (!serialized.ok) throw new Error(JSON.stringify(serialized.errors));
    const reopened = parseDocument(serialized.value);
    if (!reopened.ok) throw new Error(JSON.stringify(reopened.errors));

    expect(reopened.value.migrated).toBe(false);
    expect(reopened.value.document).toEqual(edited.value.state.document);
    expect(reopened.value.document.pages.map((page) => page.pageId)).toEqual([
      delivery.pageId,
      PAGE_ID,
    ]);
    const planning = reopened.value.document.pages[1];
    expect(planning.name).toBe("Planning");
    expect(planning.layers.map((layer) => layer.layerId)).toEqual([notes.layerId, LAYER_ID]);
    expect(planning.layers[0].name).toBe("Annotations");
    expect(planning.layers[1].nodes[0]).toMatchObject({
      nodeId: node.nodeId,
      text: "A refined idea",
      geometry: { x: 95, width: 220 },
      styleId: state.document.styles[0].styleId,
    });
    expect(planning.layers[1].connections[0]).toEqual({
      ...connection,
      label: "Validated proposal",
    });
    expect(planning.layers[1].connections[1].targetNodeId).toBe(notes.nodes[0].nodeId);
    expect(reopened.value.document.styles).toEqual(state.document.styles);
    expect(reopened.value.document.pages[0].layers[0].connections[0].label).toBe("Deliver");
    expect(serializeDocument(reopened.value.document)).toEqual(serialized);
  });
});
