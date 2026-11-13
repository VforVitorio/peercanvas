import { describe, expect, it } from "vitest";
import {
  createDocument,
  executeCommand,
  parseDocument,
  serializeDocument,
  validateDocument,
  type Node,
} from "./index";
import { createDocumentHistory } from "./history";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
const createdAt = "2026-11-11T10:00:00.000Z";

function emptyDocument() {
  const result = createDocument({
    documentId: id(1),
    pageId: id(2),
    layerId: id(3),
    title: "Architecture",
    now: createdAt,
  });
  if (!result.ok) throw new Error("Valid document creation failed.");
  return result.value;
}

function rectangle(nodeId: string, text = "API"): Node {
  return {
    nodeId,
    type: "rectangle",
    geometry: { x: 20, y: 30, width: 180, height: 90, rotation: 0 },
    text,
    styleId: null,
    catalogReference: null,
  };
}

describe("canonical document contract", () => {
  it("creates versioned documents with the supplied stable IDs", () => {
    const state = emptyDocument();
    const page = state.document.pages[0];

    expect(state).toMatchObject({ revision: 0 });
    expect(state.document).toMatchObject({
      schemaVersion: 2,
      documentId: id(1),
      metadata: { title: "Architecture", createdAt, updatedAt: createdAt },
    });
    expect(page.pageId).toBe(id(2));
    expect(page.layers[0].layerId).toBe(id(3));
  });

  it("validates optional initial page and layer names without changing default initialization", () => {
    const input = {
      documentId: id(1),
      pageId: id(2),
      layerId: id(3),
      title: "Diagrama",
      now: createdAt,
    };
    const localized = createDocument({ ...input, pageName: "Página 1", layerName: "Capa 1" });
    expect(localized.ok).toBe(true);
    if (!localized.ok) throw new Error("Localized initialization was rejected.");
    expect(localized.value.revision).toBe(0);
    expect(localized.value.document.pages[0].name).toBe("Página 1");
    expect(localized.value.document.pages[0].layers[0].name).toBe("Capa 1");
    expect(emptyDocument().document.pages[0].name).toBe("Page 1");
    expect(createDocument({ ...input, pageName: "" }).ok).toBe(false);
    expect(createDocument({ ...input, layerName: "x".repeat(257) }).ok).toBe(false);
    const serialized = serializeDocument(localized.value.document);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) throw new Error("Localized document did not serialize.");
    const reopened = parseDocument(serialized.value);
    expect(reopened.ok && reopened.value.document).toEqual(localized.value.document);
  });

  it("rejects duplicate IDs without changing the original document", () => {
    const state = emptyDocument();
    const node = rectangle(id(4));
    const first = executeCommand(
      state,
      { type: "node.add", pageId: id(2), layerId: id(3), node, index: 0 },
      { expectedRevision: 0, now: createdAt },
    );
    if (!first.ok) throw new Error("Valid node was rejected.");

    const duplicate = executeCommand(
      first.value.state,
      {
        type: "node.add",
        pageId: id(2),
        layerId: id(3),
        node: rectangle(id(4), "Duplicate"),
        index: 1,
      },
      { expectedRevision: first.value.state.revision, now: createdAt },
    );

    expect(duplicate.ok).toBe(false);
    expect(duplicate.ok ? [] : duplicate.errors.map((error) => error.code)).toContain(
      "DUPLICATE_ID",
    );
    expect(first.value.state.document.pages[0].layers[0].nodes).toEqual([node]);
    expect(first.value.state.revision).toBe(1);
  });

  it("rolls back a batch with an invalid connection endpoint", () => {
    const state = emptyDocument();
    const before = structuredClone(state.document);
    const result = executeCommand(
      state,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), node: rectangle(id(4)), index: 0 },
          {
            type: "connection.add",
            pageId: id(2),
            layerId: id(3),
            index: 0,
            connection: {
              connectionId: id(5),
              sourceNodeId: id(4),
              targetNodeId: id(99),
              routing: "straight",
              label: "invalid",
              styleId: null,
            },
          },
        ],
      },
      { expectedRevision: state.revision, now: createdAt },
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.code)).toContain(
      "MISSING_REFERENCE",
    );
    expect(state.document).toEqual(before);
    expect(state.revision).toBe(0);
  });

  it("migrates the declared v0 format in memory and rejects unknown versions", () => {
    const state = emptyDocument();
    const source = serializeDocument(state.document);
    if (!source.ok) throw new Error("Valid document serialization failed.");
    const old = JSON.parse(source.value) as {
      schemaVersion: number;
      metadata: Record<string, unknown>;
    };
    old.schemaVersion = 0;
    delete old.metadata.updatedAt;
    const oldText = JSON.stringify(old);

    const migrated = parseDocument(oldText);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value).toMatchObject({ sourceVersion: 0, migrated: true });
    expect(migrated.value.document.metadata.updatedAt).toBe(createdAt);
    expect(oldText).toContain('"schemaVersion":0');

    const unsupported = parseDocument(
      source.value.replace('"schemaVersion": 2', '"schemaVersion": 99'),
    );
    expect(unsupported.ok).toBe(false);
    expect(unsupported.ok ? [] : unsupported.errors.map((error) => error.code)).toContain(
      "UNSUPPORTED_VERSION",
    );
  });

  it("preserves element IDs and semantic order through serialize and parse", () => {
    const state = emptyDocument();
    const firstNode = rectangle(id(4), "API");
    const secondNode = rectangle(id(5), "Database");
    const added = executeCommand(
      state,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), node: firstNode, index: 0 },
          { type: "node.add", pageId: id(2), layerId: id(3), node: secondNode, index: 1 },
        ],
      },
      { expectedRevision: state.revision, now: createdAt },
    );
    if (!added.ok) throw new Error("Valid nodes were rejected.");

    const encoded = serializeDocument(added.value.state.document);
    if (!encoded.ok) throw new Error("Valid document serialization failed.");
    const reopened = parseDocument(encoded.value);

    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.document).toEqual(added.value.state.document);
    expect(reopened.value.document.pages[0].layers[0].nodes.map((node) => node.nodeId)).toEqual([
      id(4),
      id(5),
    ]);
    expect(serializeDocument(reopened.value.document)).toEqual(encoded);
  });

  it("migrates schema v1 nodes without inventing catalog references", () => {
    const state = emptyDocument();
    const withNode = {
      ...state.document,
      pages: state.document.pages.map((page) => ({
        ...page,
        layers: page.layers.map((layer) => ({ ...layer, nodes: [rectangle(id(4))] })),
      })),
    };
    const serialized = serializeDocument(withNode);
    if (!serialized.ok) throw new Error("Valid document serialization failed.");
    const document = JSON.parse(serialized.value) as {
      schemaVersion: number;
      pages: { layers: { nodes: Record<string, unknown>[] }[] }[];
    };
    document.schemaVersion = 1;
    delete document.pages[0].layers[0].nodes[0].catalogReference;
    const migrated = parseDocument(JSON.stringify(document));

    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value).toMatchObject({ sourceVersion: 1, migrated: true });
    expect(migrated.value.document.schemaVersion).toBe(2);
    expect(migrated.value.document.pages[0].layers[0].nodes[0].catalogReference).toBeNull();
  });

  it("retains a stable catalog reference and bounded source fragments", () => {
    const state = emptyDocument();
    const document = {
      ...state.document,
      pages: state.document.pages.map((page) => ({
        ...page,
        layers: page.layers.map((layer) => ({
          ...layer,
          nodes: [
            {
              ...rectangle(id(4)),
              catalogReference: { shapeId: "basic-rectangle", version: "1.0.0" },
            },
          ],
        })),
      })),
      sourceCompatibility: {
        format: "drawio" as const,
        version: 1 as const,
        pages: [
          {
            pageId: id(2),
            sourcePageId: "source-page-1",
            cellIdMap: [{ sourceId: "source-node-1", elementId: id(4) }],
            fragments: ['<mxCell id="legacy" parent="1" />'],
          },
        ],
      },
    };
    const encoded = serializeDocument(document);

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const reopened = parseDocument(encoded.value);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.document.pages[0].layers[0].nodes[0].catalogReference).toEqual({
      shapeId: "basic-rectangle",
      version: "1.0.0",
    });
    expect(reopened.value.document.sourceCompatibility?.pages[0].fragments[0]).toBe(
      '<mxCell id="legacy" parent="1" />',
    );
  });

  it("serializes catalog reference keys canonically for semantic no-op detection", () => {
    const state = emptyDocument();
    const node = {
      ...rectangle(id(4)),
      catalogReference: { shapeId: "basic-rectangle", version: "1.0.0" },
    };
    const added = executeCommand(
      state,
      { type: "node.add", pageId: id(2), layerId: id(3), node, index: 0 },
      { expectedRevision: 0, now: createdAt },
    );
    if (!added.ok) throw new Error("Valid catalog node was rejected.");

    const updated = executeCommand(
      added.value.state,
      {
        type: "node.update",
        pageId: id(2),
        layerId: id(3),
        node: { ...node, catalogReference: { version: "1.0.0", shapeId: "basic-rectangle" } },
      },
      { expectedRevision: added.value.state.revision, now: createdAt },
    );

    expect(updated).toMatchObject({ ok: true, value: { changed: false, affectedIds: [] } });
    expect(updated.ok ? updated.value.state : null).toBe(added.value.state);
  });

  it("removes page-owned source fragments and restores them on undo", () => {
    const initial = emptyDocument();
    const pageToRemove = {
      pageId: id(4),
      name: "Other",
      layers: [{ layerId: id(5), name: "Layer 1", nodes: [], connections: [] }],
    };
    const validated = validateDocument({
      ...initial.document,
      pages: [...initial.document.pages, pageToRemove],
      sourceCompatibility: {
        format: "drawio",
        version: 1,
        pages: [
          {
            pageId: id(2),
            sourcePageId: "source-page-1",
            cellIdMap: [],
            fragments: ['<mxCell id="page-one" parent="1" />'],
          },
          {
            pageId: id(4),
            sourcePageId: "source-page-2",
            cellIdMap: [{ sourceId: "mapped-node", elementId: id(6) }],
            fragments: ['<mxCell id="page-two" parent="1" />'],
          },
        ],
      },
    });
    if (!validated.ok) throw new Error("Valid fixture document was rejected.");
    const state = { document: validated.value, revision: 0 };
    const command = { type: "page.remove", pageId: id(4) };
    const history = createDocumentHistory();
    history.record(state, command);
    const removed = executeCommand(state, command, { expectedRevision: 0, now: createdAt });
    if (!removed.ok) throw new Error("Page removal was rejected.");
    expect(removed.value.state.document.sourceCompatibility?.pages).toHaveLength(1);
    expect(removed.value.state.document.sourceCompatibility?.pages[0].pageId).toBe(id(2));

    const restored = history.undo(removed.value.state, { expectedRevision: 1, now: createdAt });
    expect(restored?.ok).toBe(true);
    if (!restored?.ok) return;
    expect(restored.value.state.document).toEqual(state.document);
  });
});
