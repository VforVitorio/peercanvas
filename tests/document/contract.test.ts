import { describe, expect, it } from "vitest";
import {
  createDocument,
  executeCommand,
  parseDocument,
  serializeDocument,
  validateDocument,
} from "../../src/document";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-01-01T00:00:00.000Z";
const created = () =>
  createDocument({ documentId: id(1), pageId: id(2), layerId: id(3), title: "Demo", now });
const node = (n: number, text = `Node ${n}`) => ({
  nodeId: id(n),
  type: "rectangle",
  geometry: { x: 0, y: 0, width: 20, height: 10, rotation: 0 },
  text,
  styleId: null,
  catalogReference: null,
});

describe("shared document contract", () => {
  it("constructs a complete deterministic empty graph and serialization", () => {
    const result = created();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      revision: 0,
      document: {
        schemaVersion: 2,
        documentId: id(1),
        metadata: { title: "Demo", description: "", createdAt: now, updatedAt: now },
        pages: [
          {
            pageId: id(2),
            name: "Page 1",
            layers: [{ layerId: id(3), name: "Layer 1", nodes: [], connections: [] }],
          },
        ],
        styles: [],
        libraryReferences: [],
        sourceCompatibility: null,
      },
    });
    expect(serializeDocument(result.value.document)).toEqual({
      ok: true,
      value: `${JSON.stringify(result.value.document, null, 2)}\n`,
    });
  });

  it("rejects invalid constructor IDs and timestamps without creating unstable identifiers", () => {
    expect(
      createDocument({ documentId: "x", pageId: id(2), layerId: id(3), title: "Demo", now }),
    ).toMatchObject({ ok: false });
    expect(
      createDocument({
        documentId: id(1),
        pageId: id(2),
        layerId: id(3),
        title: "Demo",
        now: "2026-02-30T00:00:00.000Z",
      }),
    ).toMatchObject({ ok: false });
    expect(created()).toEqual(created());
    expect(
      createDocument({ documentId: id(1), pageId: id(1), layerId: id(3), title: "Demo", now }),
    ).toMatchObject({ ok: false });
  });

  it("round trips in canonical two-space UTF-8 JSON and migrates only the exact v0 shape", () => {
    const start = created();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const serialized = serializeDocument(start.value.document);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(serialized.value.endsWith("\n")).toBe(true);
    expect(serialized.value.endsWith("\r\n")).toBe(false);
    expect(parseDocument(serialized.value)).toEqual({
      ok: true,
      value: { document: start.value.document, sourceVersion: 2, migrated: false },
    });
    const old = structuredClone(start.value.document) as unknown as {
      schemaVersion: number;
      metadata: Record<string, unknown>;
      [key: string]: unknown;
    };
    old.schemaVersion = 0;
    delete old.metadata.updatedAt;
    const migration = parseDocument(JSON.stringify(old));
    expect(migration.ok).toBe(true);
    if (migration.ok) {
      expect(migration.value).toEqual({
        document: start.value.document,
        sourceVersion: 0,
        migrated: true,
      });
      expect(old.schemaVersion).toBe(0);
      expect(old.metadata.updatedAt).toBeUndefined();
    }
    expect(
      parseDocument(JSON.stringify({ ...old, metadata: { ...old.metadata, updatedAt: now } })).ok,
    ).toBe(false);
  });

  it("rejects duplicate escaped JSON keys, unknown keys, unsupported versions and oversized input", () => {
    expect(parseDocument('{"a":1,"\\u0061":2}')).toMatchObject({
      ok: false,
      errors: [{ code: "INVALID_JSON" }],
    });
    expect(parseDocument('{"schemaVersion":1,"metadata":{"title":"a","title":"b"}}')).toMatchObject(
      { ok: false, errors: [{ code: "INVALID_JSON" }] },
    );
    const doc = created();
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(validateDocument({ ...doc.value.document, extra: true })).toMatchObject({
      ok: false,
      errors: [{ code: "INVALID_SCHEMA", path: "/extra" }],
    });
    expect(parseDocument('{"schemaVersion":99}')).toMatchObject({
      ok: false,
      errors: [{ code: "UNSUPPORTED_VERSION" }],
    });
    expect(parseDocument(" ".repeat(10 * 1024 * 1024 + 1))).toMatchObject({
      ok: false,
      errors: [{ code: "LIMIT_EXCEEDED" }],
    });
    const nestedUnknown = {
      ...doc.value.document,
      metadata: { ...doc.value.document.metadata, unsafe: true },
    };
    expect(validateDocument(nestedUnknown)).toMatchObject({
      ok: false,
      errors: [{ path: "/metadata/unsafe" }],
    });
    const nestedBad = {
      ...doc.value.document,
      pages: [
        {
          ...doc.value.document.pages[0],
          layers: [
            {
              ...doc.value.document.pages[0].layers[0],
              nodes: [{ ...node(50), unexpected: true }],
            },
          ],
        },
      ],
    };
    expect(validateDocument(nestedBad)).toMatchObject({
      ok: false,
      errors: [{ path: "/pages/0/layers/0/nodes/0/unexpected" }],
    });
  });

  it("bounds finite geometry and rejects JSON exponent overflow", () => {
    const doc = created();
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const add = executeCommand(
      doc.value,
      { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
      { expectedRevision: 0, now },
    );
    expect(add.ok).toBe(true);
    if (!add.ok) return;
    const raw = JSON.stringify(add.value.state.document).replace('"x":0', '"x":1e999');
    expect(parseDocument(raw)).toMatchObject({ ok: false, errors: [{ code: "INVALID_GEOMETRY" }] });
    expect(
      validateDocument({
        ...add.value.state.document,
        pages: [
          {
            ...add.value.state.document.pages[0],
            layers: [
              {
                ...add.value.state.document.pages[0].layers[0],
                nodes: [{ ...node(5), geometry: { ...node(5).geometry, x: Infinity } }],
              },
            ],
          },
        ],
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "INVALID_GEOMETRY" }] });
  });

  it("applies a batch atomically, preserves the caller graph on failure, and returns the same state for no-op", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const original = structuredClone(initial.value);
    const result = executeCommand(
      initial.value,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
          { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(99) },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(result).toMatchObject({ ok: false });
    expect(initial.value).toEqual(original);
    const noop = executeCommand(
      initial.value,
      { type: "document.setMetadata", title: "Demo", description: "" },
      { expectedRevision: 0, now: "2026-01-02T00:00:00.000Z" },
    );
    expect(noop).toEqual({
      ok: true,
      value: { state: initial.value, changed: false, affectedIds: [] },
    });
    if (noop.ok) expect(noop.value.state).toBe(initial.value);
    const changed = executeCommand(
      initial.value,
      { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
      { expectedRevision: 0, now },
    );
    expect(changed).toMatchObject({ ok: true, value: { changed: true, state: { revision: 1 } } });
  });

  it("rejects invalid insertion indices and incomplete reorder permutations atomically", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    for (const command of [
      { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: -1 },
      { type: "page.reorder", pageIds: [] },
    ]) {
      const result = executeCommand(initial.value, command, { expectedRevision: 0, now });
      expect(result.ok).toBe(false);
      expect(initial.value.revision).toBe(0);
      expect(initial.value.document.pages[0].layers[0].nodes).toEqual([]);
    }
  });

  it("rolls back a failed batch without mutating the existing nested input graph", () => {
    const empty = created();
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    const inserted = executeCommand(
      empty.value,
      { type: "node.add", pageId: id(2), layerId: id(3), node: node(4, "before"), index: 0 },
      { expectedRevision: 0, now },
    );
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    const document = inserted.value.state.document;
    const pagesRef = document.pages;
    const pageRef = document.pages[0];
    const layersRef = pageRef.layers;
    const nodesRef = layersRef[0].nodes;
    const nodeRef = nodesRef[0];
    const failed = executeCommand(
      inserted.value.state,
      {
        type: "batch",
        commands: [
          {
            type: "node.update",
            pageId: id(2),
            layerId: id(3),
            node: { ...nodeRef, text: "changed candidate" },
          },
          { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(99) },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(failed.ok).toBe(false);
    expect(document.pages).toBe(pagesRef);
    expect(document.pages[0]).toBe(pageRef);
    expect(pageRef.layers).toBe(layersRef);
    expect(layersRef[0].nodes).toBe(nodesRef);
    expect(nodesRef[0]).toBe(nodeRef);
    expect(nodeRef.text).toBe("before");
    expect(inserted.value.state.revision).toBe(1);
  });

  it("reports escaped duplicate identity and rejects prototype-shaped payload fields", () => {
    const doc = created();
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const poisoned = JSON.parse(JSON.stringify(doc.value.document));
    Object.defineProperty(poisoned, "__proto__", { value: { polluted: true }, enumerable: true });
    expect(validateDocument(poisoned)).toMatchObject({ ok: false });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("rejects sparse and decorated document or command arrays without invoking callbacks", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const document = initial.value.document;
    const page = document.pages[0];
    const layer = page.layers[0];
    const sparse = new Array(1);
    const invalidDocuments = [
      { ...document, pages: sparse },
      { ...document, pages: [{ ...page, layers: new Array(1) }] },
      { ...document, pages: [{ ...page, layers: [{ ...layer, nodes: new Array(1) }] }] },
      { ...document, pages: [{ ...page, layers: [{ ...layer, connections: new Array(1) }] }] },
      { ...document, styles: new Array(1) },
      { ...document, libraryReferences: new Array(1) },
    ];
    for (const invalid of invalidDocuments) {
      expect(validateDocument(invalid).ok).toBe(false);
      expect(serializeDocument(invalid).ok).toBe(false);
    }

    const decorated = [page];
    Object.defineProperty(decorated, "4294967295", { value: page, enumerable: true });
    expect(validateDocument({ ...document, pages: decorated }).ok).toBe(false);
    const leadingZeroIndex = [page];
    Object.defineProperty(leadingZeroIndex, "01", { value: page, enumerable: true });
    expect(validateDocument({ ...document, pages: leadingZeroIndex }).ok).toBe(false);

    let callbacks = 0;
    const accessor = new Array(1);
    Object.defineProperty(accessor, "0", {
      get() {
        callbacks++;
        return page;
      },
      enumerable: true,
    });
    expect(validateDocument({ ...document, pages: accessor }).ok).toBe(false);
    const withToJSON = [page] as typeof document.pages & { toJSON?: () => unknown };
    withToJSON.toJSON = () => {
      callbacks++;
      return [page];
    };
    expect(serializeDocument({ ...document, pages: withToJSON }).ok).toBe(false);
    expect(callbacks).toBe(0);

    expect(
      executeCommand(
        initial.value,
        { type: "batch", commands: new Array(1) },
        { expectedRevision: 0, now },
      ).ok,
    ).toBe(false);
    expect(
      executeCommand(
        initial.value,
        { type: "page.reorder", pageIds: new Array(1) },
        { expectedRevision: 0, now },
      ).ok,
    ).toBe(false);
  });

  it("accepts same-page cross-layer endpoints and rejects duplicate IDs and cross-page links", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const add = executeCommand(
      initial.value,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), index: 0, node: node(4) },
          {
            type: "layer.add",
            pageId: id(2),
            index: 1,
            layer: { layerId: id(5), name: "Other", nodes: [node(6)], connections: [] },
          },
          {
            type: "connection.add",
            pageId: id(2),
            layerId: id(5),
            index: 0,
            connection: {
              connectionId: id(7),
              sourceNodeId: id(4),
              targetNodeId: id(6),
              routing: "straight",
              label: "",
              styleId: null,
            },
          },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(add.ok).toBe(true);
    const duplicate = executeCommand(
      initial.value,
      { type: "node.add", pageId: id(2), layerId: id(3), index: 0, node: node(3) },
      { expectedRevision: 0, now },
    );
    expect(duplicate).toMatchObject({ ok: false, errors: [{ code: "DUPLICATE_ID" }] });
    if (!add.ok) return;
    const crossPage = executeCommand(
      add.value.state,
      {
        type: "batch",
        commands: [
          {
            type: "page.add",
            index: 1,
            page: {
              pageId: id(8),
              name: "Other",
              layers: [{ layerId: id(9), name: "Main", nodes: [], connections: [] }],
            },
          },
          {
            type: "connection.add",
            pageId: id(8),
            layerId: id(9),
            index: 0,
            connection: {
              connectionId: id(10),
              sourceNodeId: id(4),
              targetNodeId: id(6),
              routing: "straight",
              label: "",
              styleId: null,
            },
          },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(crossPage.ok).toBe(false);
    if (!crossPage.ok)
      expect(crossPage.errors.every((error) => error.code === "MISSING_REFERENCE")).toBe(true);
  });

  it("enforces graph minima, exact command fields, revision conflicts, and deterministic diagnostic cap/order", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const bad = executeCommand(
      initial.value,
      { type: "page.remove", pageId: id(2), extra: true },
      { expectedRevision: 0, now },
    );
    expect(bad).toMatchObject({ ok: false, errors: [{ code: "INVALID_COMMAND" }] });
    const staleNoop = executeCommand(
      initial.value,
      { type: "document.setMetadata", title: "Demo", description: "" },
      { expectedRevision: 1, now },
    );
    expect(staleNoop).toMatchObject({ ok: false, errors: [{ code: "REVISION_CONFLICT" }] });
    const lastPage = executeCommand(
      initial.value,
      { type: "page.remove", pageId: id(2) },
      { expectedRevision: 0, now },
    );
    expect(lastPage).toMatchObject({ ok: false, errors: [{ code: "LAST_PAGE" }] });
    const lastLayer = executeCommand(
      initial.value,
      { type: "layer.remove", pageId: id(2), layerId: id(3) },
      { expectedRevision: 0, now },
    );
    expect(lastLayer).toMatchObject({ ok: false, errors: [{ code: "LAST_LAYER" }] });
    const manyErrors = validateDocument({
      ...initial.value.document,
      pages: Array.from({ length: 101 }, (_, i) => ({ pageId: id(i + 20), name: "", layers: [] })),
    });
    expect(manyErrors.ok).toBe(false);
    if (!manyErrors.ok) {
      expect(manyErrors.errors.length).toBeLessThanOrEqual(100);
      expect(
        validateDocument({
          ...initial.value.document,
          pages: Array.from({ length: 101 }, (_, i) => ({
            pageId: id(i + 20),
            name: "",
            layers: [],
          })),
        }),
      ).toEqual(manyErrors);
      expect(manyErrors.errors[0].path).toBe("/pages");
      expect(manyErrors.errors[1].path).toBe("/pages/0/name");
    }
  });

  it("rejects style deletion while referenced and normalizes negative zero", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const style = {
      styleId: id(4),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      textColor: "#000000",
      fontSize: 16,
    };
    const seeded = executeCommand(
      initial.value,
      {
        type: "batch",
        commands: [
          { type: "style.put", style },
          {
            type: "node.add",
            pageId: id(2),
            layerId: id(3),
            index: 0,
            node: { ...node(5), styleId: id(4), geometry: { ...node(5).geometry, x: -0 } },
          },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    expect(seeded.value.state.document.pages[0].layers[0].nodes[0].geometry.x).toBe(0);
    const removeStyle = executeCommand(
      seeded.value.state,
      { type: "style.remove", styleId: id(4) },
      { expectedRevision: 1, now },
    );
    expect(removeStyle).toMatchObject({ ok: false, errors: [{ code: "STYLE_IN_USE" }] });
    expect(serializeDocument(seeded.value.state.document)).toMatchObject({ ok: true });
  });

  it("executes page, layer, node, connection, and style add/update/remove/reorder commands", () => {
    const start = created();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    let state = start.value;
    const run = (command: unknown) => {
      const result = executeCommand(state, command, { expectedRevision: state.revision, now });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      state = result.value.state;
    };
    const page = (pageId: string) => state.document.pages.find((p) => p.pageId === pageId)!;
    run({
      type: "page.add",
      index: 1,
      page: {
        pageId: id(4),
        name: "Second",
        layers: [{ layerId: id(5), name: "Main", nodes: [], connections: [] }],
      },
    });
    run({ type: "page.rename", pageId: id(4), name: "Renamed" });
    expect(page(id(4)).name).toBe("Renamed");
    run({ type: "page.reorder", pageIds: [id(4), id(2)] });
    expect(state.document.pages.map((value) => value.pageId)).toEqual([id(4), id(2)]);
    run({
      type: "layer.add",
      pageId: id(4),
      index: 1,
      layer: { layerId: id(6), name: "Annotations", nodes: [], connections: [] },
    });
    run({ type: "layer.rename", pageId: id(4), layerId: id(6), name: "Notes" });
    expect(page(id(4)).layers.find((value) => value.layerId === id(6))?.name).toBe("Notes");
    run({ type: "layer.reorder", pageId: id(4), layerIds: [id(6), id(5)] });
    expect(page(id(4)).layers.map((value) => value.layerId)).toEqual([id(6), id(5)]);
    run({
      type: "style.put",
      style: {
        styleId: id(7),
        fill: "#ffffff",
        stroke: "#000000",
        strokeWidth: 1,
        textColor: "#000000",
        fontSize: 16,
      },
    });
    expect(state.document.styles[0].fill).toBe("#ffffff");
    run({
      type: "style.put",
      style: {
        styleId: id(7),
        fill: "#abcdef",
        stroke: "#000000",
        strokeWidth: 1,
        textColor: "#000000",
        fontSize: 16,
      },
    });
    expect(state.document.styles[0].fill).toBe("#abcdef");
    run({
      type: "node.add",
      pageId: id(4),
      layerId: id(5),
      index: 0,
      node: { ...node(8), styleId: id(7) },
    });
    run({ type: "node.add", pageId: id(4), layerId: id(6), index: 0, node: node(9) });
    run({
      type: "node.update",
      pageId: id(4),
      layerId: id(5),
      node: { ...node(8, "Updated"), styleId: id(7) },
    });
    expect(page(id(4)).layers.find((value) => value.layerId === id(5))?.nodes[0].text).toBe(
      "Updated",
    );
    run({
      type: "connection.add",
      pageId: id(4),
      layerId: id(6),
      index: 0,
      connection: {
        connectionId: id(10),
        sourceNodeId: id(8),
        targetNodeId: id(9),
        routing: "straight",
        label: "one",
        styleId: null,
      },
    });
    run({
      type: "connection.update",
      pageId: id(4),
      layerId: id(6),
      connection: {
        connectionId: id(10),
        sourceNodeId: id(9),
        targetNodeId: id(8),
        routing: "straight",
        label: "two",
        styleId: null,
      },
    });
    expect(
      page(id(4)).layers.find((value) => value.layerId === id(6))?.connections[0],
    ).toMatchObject({ sourceNodeId: id(9), targetNodeId: id(8), label: "two" });
    run({ type: "node.add", pageId: id(4), layerId: id(5), index: 1, node: node(11) });
    run({ type: "node.remove", pageId: id(4), layerId: id(5), nodeId: id(11) });
    run({ type: "connection.remove", pageId: id(4), layerId: id(6), connectionId: id(10) });
    expect(page(id(4)).layers.find((value) => value.layerId === id(6))?.connections).toEqual([]);
    run({ type: "node.remove", pageId: id(4), layerId: id(5), nodeId: id(8) });
    expect(page(id(4)).layers.find((value) => value.layerId === id(5))?.nodes).toEqual([]);
    run({ type: "node.remove", pageId: id(4), layerId: id(6), nodeId: id(9) });
    run({ type: "layer.remove", pageId: id(4), layerId: id(6) });
    expect(page(id(4)).layers.some((value) => value.layerId === id(6))).toBe(false);
    run({ type: "style.remove", styleId: id(7) });
    expect(state.document.styles).toEqual([]);
    run({ type: "page.remove", pageId: id(4) });
    expect(state.document.pages.some((value) => value.pageId === id(4))).toBe(false);
    expect(state.document.pages).toEqual([page(id(2))]);
    expect(state.document.styles).toEqual([]);
    expect(state.revision).toBeGreaterThan(15);
  });

  it("serializes canonical property order regardless of input object insertion order", () => {
    const result = created();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.value.document;
    const reverse = {
      sourceCompatibility: null,
      libraryReferences: [],
      styles: [],
      pages: [
        {
          layers: [{ connections: [], nodes: [], name: "Layer 1", layerId: id(3) }],
          name: "Page 1",
          pageId: id(2),
        },
      ],
      metadata: { updatedAt: now, createdAt: now, description: "", title: "Demo" },
      documentId: id(1),
      schemaVersion: 2,
    };
    expect(serializeDocument(reverse)).toEqual(serializeDocument(doc));
  });

  it("rejects revision overflow and collection, string, and finite geometry bounds", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const overflow = executeCommand(
      { ...initial.value, revision: Number.MAX_SAFE_INTEGER },
      { type: "document.setMetadata", title: "Changed", description: "" },
      { expectedRevision: Number.MAX_SAFE_INTEGER, now },
    );
    expect(overflow).toMatchObject({ ok: false, errors: [{ code: "LIMIT_EXCEEDED" }] });
    const oversizedText = {
      ...initial.value.document,
      pages: [
        {
          ...initial.value.document.pages[0],
          layers: [
            {
              ...initial.value.document.pages[0].layers[0],
              nodes: [{ ...node(10, "x".repeat(100001)) }],
            },
          ],
        },
      ],
    };
    expect(validateDocument(oversizedText)).toMatchObject({
      ok: false,
      errors: [{ code: "INVALID_SCHEMA" }],
    });
    const width = (value: number) =>
      validateDocument({
        ...initial.value.document,
        pages: [
          {
            ...initial.value.document.pages[0],
            layers: [
              {
                ...initial.value.document.pages[0].layers[0],
                nodes: [{ ...node(11), geometry: { ...node(11).geometry, width: value } }],
              },
            ],
          },
        ],
      });
    for (const invalid of [0, 1000001, NaN, Infinity])
      expect(width(invalid)).toMatchObject({ ok: false, errors: [{ code: "INVALID_GEOMETRY" }] });
    for (const valid of [Number.MIN_VALUE, 1000000]) expect(width(valid).ok).toBe(true);
    const geometryResult = (geometry: Record<string, number>) =>
      validateDocument({
        ...initial.value.document,
        pages: [
          {
            ...initial.value.document.pages[0],
            layers: [
              {
                ...initial.value.document.pages[0].layers[0],
                nodes: [{ ...node(12), geometry: { ...node(12).geometry, ...geometry } }],
              },
            ],
          },
        ],
      });
    for (const value of [-1000001, 1000001]) {
      expect(geometryResult({ x: value })).toMatchObject({
        ok: false,
        errors: [{ code: "INVALID_GEOMETRY" }],
      });
      expect(geometryResult({ y: value })).toMatchObject({
        ok: false,
        errors: [{ code: "INVALID_GEOMETRY" }],
      });
    }
    for (const value of [-1000000, 1000000]) {
      expect(geometryResult({ x: value }).ok).toBe(true);
      expect(geometryResult({ y: value }).ok).toBe(true);
    }
    for (const value of [-1, 360])
      expect(geometryResult({ rotation: value })).toMatchObject({
        ok: false,
        errors: [{ code: "INVALID_GEOMETRY" }],
      });
    for (const value of [0, 359.999]) expect(geometryResult({ rotation: value }).ok).toBe(true);
  });

  it("requires reserved fields, validates scalar types, and timestamps only forward edits", () => {
    const initial = created();
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const missingReserved = JSON.parse(JSON.stringify(initial.value.document)) as Record<
      string,
      unknown
    >;
    delete missingReserved.sourceCompatibility;
    const missing = validateDocument(missingReserved);
    expect(missing.ok).toBe(false);
    if (!missing.ok)
      expect(missing.errors.some((error) => error.path === "/sourceCompatibility")).toBe(true);
    expect(
      validateDocument({ ...initial.value.document, libraryReferences: ["external"] }),
    ).toMatchObject({ ok: false });
    expect(
      validateDocument({
        ...initial.value.document,
        metadata: { ...initial.value.document.metadata, title: 7 },
      }),
    ).toMatchObject({ ok: false });
    const later = "2026-01-02T00:00:00.000Z";
    const changed = executeCommand(
      initial.value,
      { type: "document.setMetadata", title: "Later", description: "" },
      { expectedRevision: 0, now: later },
    );
    expect(changed).toMatchObject({
      ok: true,
      value: { state: { revision: 1, document: { metadata: { updatedAt: later } } } },
    });
    if (!changed.ok) return;
    expect(
      executeCommand(
        changed.value.state,
        { type: "document.setMetadata", title: "Earlier", description: "" },
        { expectedRevision: 1, now },
      ),
    ).toMatchObject({ ok: false });
  });
});
