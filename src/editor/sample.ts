import { createDocument, executeCommand, type ModelState, type Node } from "../document";

export const PAGE_ID = "00000000-0000-4000-8000-000000000002";
export const LAYER_ID = "00000000-0000-4000-8000-000000000003";

export function createSample(): ModelState {
  const now = new Date().toISOString();
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
      commands: nodes.map((node, index) => ({
        type: "node.add",
        pageId: PAGE_ID,
        layerId: LAYER_ID,
        node,
        index,
      })),
    },
    { expectedRevision: created.value.revision, now },
  );
  if (!seeded.ok) throw new Error("Could not prepare the in-memory example.");
  return seeded.value.state;
}
