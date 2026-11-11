import { createDocument, executeCommand, type ModelState, type Node } from "../document";

export const PAGE_ID = "00000000-0000-4000-8000-000000000002";
export const LAYER_ID = "00000000-0000-4000-8000-000000000003";

export function createSample(now = new Date().toISOString()): ModelState {
  const created = createDocument({
    documentId: "00000000-0000-4000-8000-000000000001",
    pageId: PAGE_ID,
    layerId: LAYER_ID,
    title: "Untitled diagram",
    now,
  });
  if (!created.ok) throw new Error("Could not create the in-memory document.");
  const nodes: Node[] = [
    { nodeId: "00000000-0000-4000-8000-000000000004", text: "Idea", x: 80, y: 100 },
    { nodeId: "00000000-0000-4000-8000-000000000005", text: "Draft", x: 360, y: 100 },
    { nodeId: "00000000-0000-4000-8000-000000000006", text: "Review", x: 220, y: 290 },
  ].map(({ nodeId, text, x, y }) => ({
    nodeId,
    type: "rectangle",
    text,
    geometry: { x, y, width: 180, height: 90, rotation: 0 },
    styleId: null,
  }));
  const seeded = executeCommand(
    created.value,
    {
      type: "batch",
      commands: [
        ...nodes.map((node, index) => ({
          type: "node.add",
          pageId: PAGE_ID,
          layerId: LAYER_ID,
          node,
          index,
        })),
        {
          type: "style.put",
          style: {
            styleId: "00000000-0000-4000-8000-00000000000a",
            fill: "#e8efff",
            stroke: "#3155b7",
            strokeWidth: 2,
            textColor: "#182646",
            fontSize: 18,
          },
        },
        {
          type: "layer.add",
          pageId: PAGE_ID,
          index: 1,
          layer: {
            layerId: "00000000-0000-4000-8000-000000000007",
            name: "Notes",
            nodes: [
              {
                nodeId: "00000000-0000-4000-8000-000000000008",
                type: "text",
                text: "Explore, refine, review",
                geometry: { x: 220, y: 450, width: 260, height: 60, rotation: 0 },
                styleId: "00000000-0000-4000-8000-00000000000a",
              },
            ],
            connections: [],
          },
        },
        {
          type: "connection.add",
          pageId: PAGE_ID,
          layerId: LAYER_ID,
          index: 0,
          connection: {
            connectionId: "00000000-0000-4000-8000-000000000009",
            sourceNodeId: nodes[0].nodeId,
            targetNodeId: nodes[1].nodeId,
            routing: "straight",
            label: "Refine",
            styleId: "00000000-0000-4000-8000-00000000000a",
          },
        },
        {
          type: "connection.add",
          pageId: PAGE_ID,
          layerId: LAYER_ID,
          index: 1,
          connection: {
            connectionId: "00000000-0000-4000-8000-000000000010",
            sourceNodeId: nodes[2].nodeId,
            targetNodeId: "00000000-0000-4000-8000-000000000008",
            routing: "straight",
            label: "Capture findings",
            styleId: null,
          },
        },
        {
          type: "page.add",
          index: 1,
          page: {
            pageId: "00000000-0000-4000-8000-00000000000b",
            name: "Delivery",
            layers: [
              {
                layerId: "00000000-0000-4000-8000-00000000000c",
                name: "Main",
                nodes: [
                  {
                    nodeId: "00000000-0000-4000-8000-00000000000d",
                    type: "rectangle",
                    text: "Build",
                    geometry: { x: 80, y: 100, width: 180, height: 90, rotation: 0 },
                    styleId: "00000000-0000-4000-8000-00000000000a",
                  },
                  {
                    nodeId: "00000000-0000-4000-8000-00000000000e",
                    type: "rectangle",
                    text: "Share",
                    geometry: { x: 360, y: 100, width: 180, height: 90, rotation: 0 },
                    styleId: null,
                  },
                ],
                connections: [
                  {
                    connectionId: "00000000-0000-4000-8000-00000000000f",
                    sourceNodeId: "00000000-0000-4000-8000-00000000000d",
                    targetNodeId: "00000000-0000-4000-8000-00000000000e",
                    routing: "straight",
                    label: "Deliver",
                    styleId: null,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    { expectedRevision: created.value.revision, now },
  );
  if (!seeded.ok) throw new Error("Could not prepare the in-memory example.");
  return seeded.value.state;
}
