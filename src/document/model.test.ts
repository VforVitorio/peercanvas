import { describe, expect, it } from "vitest";
import {
  createDocument,
  executeCommand,
  parseDocument,
  serializeDocument,
  type Node,
} from "./index";

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
  };
}

describe("canonical document contract", () => {
  it("creates versioned documents with the supplied stable IDs", () => {
    const state = emptyDocument();
    const page = state.document.pages[0];

    expect(state).toMatchObject({ revision: 0 });
    expect(state.document).toMatchObject({
      schemaVersion: 1,
      documentId: id(1),
      metadata: { title: "Architecture", createdAt, updatedAt: createdAt },
    });
    expect(page.pageId).toBe(id(2));
    expect(page.layers[0].layerId).toBe(id(3));
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
      source.value.replace('"schemaVersion": 1', '"schemaVersion": 99'),
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
});
