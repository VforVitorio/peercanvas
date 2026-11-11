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
const node = (n: number, text = `Node ${n}`) => ({
  nodeId: id(n),
  type: "rectangle" as const,
  geometry: { x: 0, y: 0, width: 20, height: 10, rotation: 0 },
  text,
  styleId: null,
});
type TestDocument = {
  schemaVersion: number;
  documentId: string;
  metadata: { title: string; description: string; createdAt: string; updatedAt: string };
  pages: Array<{
    pageId: string;
    name: string;
    layers: Array<{
      layerId: string;
      name: string;
      nodes: ReturnType<typeof node>[];
      connections: unknown[];
    }>;
  }>;
  styles: unknown[];
  libraryReferences: unknown[];
  sourceCompatibility: null;
};
const initial = () =>
  createDocument({ documentId: id(1), pageId: id(2), layerId: id(3), title: "Stable", now });

function withNode() {
  const start = initial();
  if (!start.ok) throw new Error("fixture construction failed");
  const added = executeCommand(
    start.value,
    { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
    { expectedRevision: 0, now },
  );
  if (!added.ok) throw new Error("fixture command failed");
  return added.value.state.document;
}

describe("S1 shared-core compatibility regressions", () => {
  it("includes unchanged entity IDs when ownership changes in a batch", () => {
    const start = initial();
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const prepared = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          {
            type: "layer.add",
            pageId: id(2),
            layer: { layerId: id(5), name: "Destination", nodes: [], connections: [] },
            index: 1,
          },
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const movedNode = executeCommand(
      prepared.value.state,
      {
        type: "batch",
        commands: [
          { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) },
          { type: "node.add", pageId: id(2), layerId: id(5), node: node(4), index: 0 },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(movedNode).toMatchObject({
      ok: true,
      value: { changed: true, affectedIds: [id(1), id(2), id(3), id(4), id(5)] },
    });

    const secondPage = {
      pageId: id(8),
      name: "Second",
      layers: [{ layerId: id(9), name: "Destination", nodes: [], connections: [] }],
    };
    const withPages = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          {
            type: "layer.add",
            pageId: id(2),
            layer: { layerId: id(7), name: "Keep source nonempty", nodes: [], connections: [] },
            index: 1,
          },
          { type: "page.add", page: secondPage, index: 1 },
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(withPages.ok).toBe(true);
    if (!withPages.ok) return;

    const movedLayer = executeCommand(
      withPages.value.state,
      {
        type: "batch",
        commands: [
          { type: "layer.remove", pageId: id(2), layerId: id(3) },
          {
            type: "layer.add",
            pageId: id(8),
            layer: {
              layerId: id(3),
              name: "Layer 1",
              nodes: [node(4)],
              connections: [],
            },
            index: 1,
          },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(movedLayer).toMatchObject({
      ok: true,
      value: {
        changed: true,
        affectedIds: [id(1), id(2), id(3), id(4), id(8)],
      },
    });

    const reorderOnly = executeCommand(
      withPages.value.state,
      { type: "page.reorder", pageIds: [id(8), id(2)] },
      { expectedRevision: 1, now },
    );
    expect(reorderOnly).toMatchObject({
      ok: true,
      value: { changed: true, affectedIds: [id(1)] },
    });

    const movedAwayAndBack = executeCommand(
      prepared.value.state,
      {
        type: "batch",
        commands: [
          { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) },
          { type: "node.add", pageId: id(2), layerId: id(5), node: node(4), index: 0 },
          { type: "node.remove", pageId: id(2), layerId: id(5), nodeId: id(4) },
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(movedAwayAndBack).toEqual({
      ok: true,
      value: { state: prepared.value.state, changed: false, affectedIds: [] },
    });
  });

  it("rejects sparse arrays at every document collection level", () => {
    const base = withNode() as unknown as TestDocument;
    const cases: unknown[] = [];
    cases.push({ ...base, pages: new Array<TestDocument["pages"][number]>(1) });
    cases.push({
      ...base,
      pages: [
        { ...base.pages[0], layers: new Array<TestDocument["pages"][number]["layers"][number]>(1) },
      ],
    });
    cases.push({
      ...base,
      pages: [
        {
          ...base.pages[0],
          layers: [{ ...base.pages[0].layers[0], nodes: new Array<ReturnType<typeof node>>(1) }],
        },
      ],
    });
    cases.push({
      ...base,
      pages: [
        {
          ...base.pages[0],
          layers: [{ ...base.pages[0].layers[0], connections: new Array<unknown>(1) }],
        },
      ],
    });
    cases.push({ ...base, styles: new Array<unknown>(1) });
    for (const value of cases) expect(serializeDocument(value).ok).toBe(false);

    const start = initial();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const batch = executeCommand(
      start.value,
      { type: "batch", commands: new Array(1) },
      { expectedRevision: 0, now },
    );
    expect(batch.ok).toBe(false);
    const reorder = executeCommand(
      start.value,
      { type: "page.reorder", pageIds: new Array(1) },
      { expectedRevision: 0, now },
    );
    expect(reorder.ok).toBe(false);
    expect(
      executeCommand(
        start.value,
        { type: "layer.reorder", pageId: id(2), layerIds: new Array(1) },
        { expectedRevision: 0, now },
      ).ok,
    ).toBe(false);
  });

  it("rejects own map/forEach overrides without invoking callbacks at every array level", () => {
    const base = withNode() as unknown as TestDocument;
    for (let index = 0; index < 5; index++) {
      const value = structuredClone(base);
      const arrays = [
        value.pages,
        value.pages[0].layers,
        value.pages[0].layers[0].nodes,
        value.pages[0].layers[0].connections,
        value.styles,
      ];
      let calls = 0;
      for (const name of ["map", "forEach"] as const) {
        Object.defineProperty(arrays[index], name, {
          value: () => {
            calls++;
            return [];
          },
          enumerable: true,
        });
      }
      expect(serializeDocument(value).ok).toBe(false);
      expect(calls).toBe(0);
    }

    const batchCommands: unknown[] = [
      { type: "document.setMetadata", title: "Stable", description: "" },
    ];
    const pageIds = [id(2)];
    const layerIds = [id(3)];
    const addedPageLayers: unknown[] = [{ layerId: id(9), name: "L", nodes: [], connections: [] }];
    const addedLayerNodes: unknown[] = [node(8)];
    const addedLayerConnections: unknown[] = [];
    const commandArrays: Array<[unknown, unknown[]]> = [
      [{ type: "batch", commands: batchCommands }, batchCommands],
      [{ type: "page.reorder", pageIds }, pageIds],
      [{ type: "layer.reorder", pageId: id(2), layerIds }, layerIds],
      [
        { type: "page.add", index: 1, page: { pageId: id(8), name: "P", layers: addedPageLayers } },
        addedPageLayers,
      ],
      [
        {
          type: "layer.add",
          pageId: id(2),
          index: 1,
          layer: { layerId: id(8), name: "L", nodes: addedLayerNodes, connections: [] },
        },
        addedLayerNodes,
      ],
      [
        {
          type: "layer.add",
          pageId: id(2),
          index: 1,
          layer: { layerId: id(8), name: "L", nodes: [], connections: addedLayerConnections },
        },
        addedLayerConnections,
      ],
    ];
    for (const [command, array] of commandArrays) {
      let calls = 0;
      Object.defineProperty(array, "map", {
        value: () => {
          calls++;
          return [];
        },
        enumerable: true,
      });
      Object.defineProperty(array, "forEach", {
        value: () => {
          calls++;
        },
        enumerable: true,
      });
      const state = initial();
      expect(state.ok).toBe(true);
      if (!state.ok) continue;
      expect(executeCommand(state.value, command, { expectedRevision: 0, now }).ok).toBe(false);
      expect(calls).toBe(0);
    }
  });

  it("rejects symbols, non-enumerable fields, accessors, and toJSON without invoking hooks", () => {
    const base = withNode() as unknown as TestDocument;
    const symbol = Symbol("hidden");
    Object.defineProperty(base.metadata, symbol, { value: "x" });
    expect(serializeDocument(base).ok).toBe(false);
    const hidden = withNode() as unknown as TestDocument;
    Object.defineProperty(hidden.metadata, "extra", { value: "x", enumerable: false });
    expect(serializeDocument(hidden).ok).toBe(false);
    const getter = withNode() as unknown as TestDocument;
    let called = 0;
    Object.defineProperty(getter.metadata, "title", {
      enumerable: true,
      get() {
        called++;
        return "Stable";
      },
    });
    expect(serializeDocument(getter).ok).toBe(false);
    expect(called).toBe(0);
    const jsonHook = withNode() as unknown as TestDocument;
    Object.defineProperty(jsonHook.metadata, "toJSON", {
      enumerable: true,
      value() {
        called++;
        return {};
      },
    });
    expect(serializeDocument(jsonHook).ok).toBe(false);
    expect(called).toBe(0);
    const arrayProperties = withNode() as unknown as TestDocument;
    Object.defineProperty(arrayProperties.pages, Symbol("array symbol"), { value: 1 });
    expect(serializeDocument(arrayProperties).ok).toBe(false);
    const nonEnumerableArray = withNode() as unknown as TestDocument;
    Object.defineProperty(nonEnumerableArray.pages, "hidden", { value: 1 });
    expect(serializeDocument(nonEnumerableArray).ok).toBe(false);
    const accessorArray = withNode() as unknown as TestDocument;
    let arrayGetterCalls = 0;
    Object.defineProperty(accessorArray.pages, "0", {
      enumerable: true,
      get() {
        arrayGetterCalls++;
        return base.pages[0];
      },
    });
    expect(serializeDocument(accessorArray).ok).toBe(false);
    expect(arrayGetterCalls).toBe(0);
    const revoked = Proxy.revocable(withNode() as unknown as TestDocument, {});
    revoked.revoke();
    expect(() => serializeDocument(revoked.proxy)).not.toThrow();
    expect(serializeDocument(revoked.proxy).ok).toBe(false);
  });

  it("rejects descriptor traps without invoking accessors at each public boundary", () => {
    let calls = 0;
    const accessorDocument = withNode() as unknown as TestDocument;
    Object.defineProperty(accessorDocument.metadata, "title", {
      enumerable: true,
      get() {
        calls++;
        return "Stable";
      },
    });
    expect(validateDocument(accessorDocument).ok).toBe(false);
    expect(calls).toBe(0);

    const accessorInput = { documentId: id(1), pageId: id(2), layerId: id(3), now };
    Object.defineProperty(accessorInput, "title", {
      enumerable: true,
      get() {
        calls++;
        return "Stable";
      },
    });
    expect(createDocument(accessorInput as never).ok).toBe(false);
    expect(calls).toBe(0);

    const state = initial();
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const command: Record<string, unknown> = { type: "document.setMetadata", description: "" };
    Object.defineProperty(command, "title", {
      enumerable: true,
      get() {
        calls++;
        return "Other";
      },
    });
    expect(executeCommand(state.value, command, { expectedRevision: 0, now }).ok).toBe(false);
    expect(calls).toBe(0);

    const accessorState: Record<string, unknown> = { revision: 0 };
    Object.defineProperty(accessorState, "document", {
      enumerable: true,
      get() {
        calls++;
        return state.value.document;
      },
    });
    expect(
      executeCommand(
        accessorState as never,
        { type: "document.setMetadata", title: "Other", description: "" },
        { expectedRevision: 0, now },
      ).ok,
    ).toBe(false);
    expect(calls).toBe(0);

    const context: Record<string, unknown> = { expectedRevision: 0 };
    Object.defineProperty(context, "now", {
      enumerable: true,
      get() {
        calls++;
        return now;
      },
    });
    expect(
      executeCommand(
        state.value,
        { type: "document.setMetadata", title: "Other", description: "" },
        context as never,
      ).ok,
    ).toBe(false);
    expect(calls).toBe(0);
  });

  it("reparses a proxy-backed serialization candidate and returns the stable expected title", () => {
    const plain = withNode() as unknown as TestDocument;
    let titleReads = 0;
    const metadata = new Proxy(plain.metadata, {
      get(target, key, receiver) {
        if (key === "title") {
          titleReads++;
          return titleReads === 1 ? "Stable" : "Changed";
        }
        return Reflect.get(target, key, receiver);
      },
    });
    const result = serializeDocument({ ...plain, metadata });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(parseDocument(result.value)).toMatchObject({
        ok: true,
        value: { document: { metadata: { title: "Stable" } } },
      });
    }
    expect(titleReads).toBe(0);
  });

  it("captures aliased state and command objects once before comparison and execution", () => {
    const start = initial();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const inserted = executeCommand(
      start.value,
      { type: "node.add", pageId: id(2), layerId: id(3), node: node(4, "Initial"), index: 0 },
      { expectedRevision: 0, now },
    );
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    const existing = inserted.value.state.document.pages[0].layers[0].nodes[0];
    let descriptorReads = 0;
    let propertyReads = 0;
    const aliased = new Proxy(existing, {
      get(target, key, receiver) {
        if (key === "text") propertyReads++;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== "text" || !descriptor) return descriptor;
        descriptorReads++;
        return { ...descriptor, value: descriptorReads === 1 ? "Initial" : "Unstable" };
      },
    });
    const aliasedState = {
      revision: inserted.value.state.revision,
      document: {
        ...inserted.value.state.document,
        pages: inserted.value.state.document.pages.map((page) => ({
          ...page,
          layers: page.layers.map((layer) => ({
            ...layer,
            nodes: layer.nodes.map((entry) => (entry === existing ? aliased : entry)),
          })),
        })),
      },
    };
    const outcome = executeCommand(
      aliasedState,
      { type: "node.update", pageId: id(2), layerId: id(3), node: aliased },
      { expectedRevision: 1, now },
    );
    expect(outcome).toEqual({
      ok: true,
      value: { state: aliasedState, changed: false, affectedIds: [] },
    });
    expect(outcome.ok && outcome.value.state).toBe(aliasedState);
    expect(descriptorReads).toBe(1);
    expect(propertyReads).toBe(0);
  });

  it("rejects a parsed source whose canonical serialization exceeds 10 MiB", () => {
    const start = initial();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const doc = structuredClone(start.value.document) as unknown as TestDocument;
    doc.metadata.title = "Limit";
    const nodeCount = 30000;
    doc.pages[0].layers[0].nodes = Array.from({ length: nodeCount }, (_, index) => ({
      nodeId: id(index + 10),
      type: "rectangle" as const,
      geometry: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
      text: "",
      styleId: null,
    }));
    const compact = JSON.stringify(doc);
    expect(Buffer.byteLength(compact, "utf8")).toBe(4_590_439);
    expect(Buffer.byteLength(`${JSON.stringify(doc, null, 2)}\n`, "utf8")).toBe(10_920_617);
    expect(validateDocument(doc)).toMatchObject({
      ok: false,
      errors: [{ code: "LIMIT_EXCEEDED" }],
    });
    expect(serializeDocument(doc)).toMatchObject({
      ok: false,
      errors: [{ code: "LIMIT_EXCEEDED" }],
    });
    expect(parseDocument(compact)).toMatchObject({
      ok: false,
      errors: [{ code: "LIMIT_EXCEEDED" }],
    });

    const near = structuredClone(start.value.document) as unknown as TestDocument;
    near.metadata.title = "Limit";
    near.pages[0].layers[0].nodes = Array.from({ length: 28_700 }, (_, index) => ({
      nodeId: id(index + 10),
      type: "rectangle" as const,
      geometry: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
      text: "",
      styleId: null,
    }));
    const nearParse = parseDocument(JSON.stringify(near));
    expect(nearParse.ok).toBe(true);
    if (!nearParse.ok) return;
    const largerPage = {
      pageId: id(800_000),
      name: "Large",
      layers: [
        {
          layerId: id(800_001),
          name: "Layer",
          nodes: Array.from({ length: 200 }, (_, index) => ({
            nodeId: id(810_000 + index),
            type: "rectangle" as const,
            geometry: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            text: "",
            styleId: null,
          })),
          connections: [],
        },
      ],
    };
    expect(
      executeCommand(
        { document: nearParse.value.document, revision: 0 },
        { type: "page.add", page: largerPage, index: 1 },
        { expectedRevision: 0, now },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "LIMIT_EXCEEDED" }] });
  });

  it("reports semantic affected IDs for transient entities, restored entities, order, removal, and ancestors", () => {
    const start = initial();
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const transient = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
          { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) },
          { type: "document.setMetadata", title: "Other", description: "" },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(transient).toMatchObject({ ok: true, value: { affectedIds: [id(1)] } });

    const seeded = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(4), index: 0 },
          { type: "node.add", pageId: id(2), layerId: id(3), node: node(5), index: 1 },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    const removed = executeCommand(
      seeded.value.state,
      { type: "node.remove", pageId: id(2), layerId: id(3), nodeId: id(4) },
      { expectedRevision: 1, now },
    );
    expect(removed).toMatchObject({
      ok: true,
      value: { affectedIds: [id(1), id(2), id(3), id(4)] },
    });
    const renamePage = executeCommand(
      start.value,
      { type: "page.rename", pageId: id(2), name: "Renamed" },
      { expectedRevision: 0, now },
    );
    expect(renamePage).toMatchObject({ ok: true, value: { affectedIds: [id(1), id(2)] } });
    const addThenRestore = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          {
            type: "page.add",
            index: 1,
            page: {
              pageId: id(8),
              name: "Temporary",
              layers: [{ layerId: id(9), name: "Layer", nodes: [], connections: [] }],
            },
          },
          { type: "page.remove", pageId: id(8) },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(addThenRestore).toMatchObject({ ok: true, value: { changed: false, affectedIds: [] } });
    const reorderedPages = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          {
            type: "page.add",
            index: 1,
            page: {
              pageId: id(8),
              name: "Other",
              layers: [{ layerId: id(9), name: "Layer", nodes: [], connections: [] }],
            },
          },
          { type: "page.reorder", pageIds: [id(8), id(2)] },
          { type: "page.remove", pageId: id(8) },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(reorderedPages).toMatchObject({ ok: true, value: { changed: false, affectedIds: [] } });

    const originalNode = seeded.value.state.document.pages[0].layers[0].nodes[0];
    const reorderedKeys = {
      styleId: originalNode.styleId,
      text: originalNode.text,
      geometry: { ...originalNode.geometry },
      type: originalNode.type,
      nodeId: originalNode.nodeId,
    };
    const keyOrderOnly = executeCommand(
      seeded.value.state,
      {
        type: "batch",
        commands: [
          { type: "node.update", pageId: id(2), layerId: id(3), node: reorderedKeys },
          { type: "document.setMetadata", title: "Different", description: "" },
          { type: "document.setMetadata", title: "Stable", description: "" },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(keyOrderOnly).toMatchObject({ ok: true, value: { changed: false, affectedIds: [] } });

    const style = {
      styleId: id(6),
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      textColor: "#000000",
      fontSize: 16,
    };
    const styled = executeCommand(
      start.value,
      {
        type: "batch",
        commands: [
          { type: "style.put", style },
          {
            type: "node.add",
            pageId: id(2),
            layerId: id(3),
            node: { ...node(7), styleId: id(6) },
            index: 0,
          },
        ],
      },
      { expectedRevision: 0, now },
    );
    expect(styled.ok).toBe(true);
    if (!styled.ok) return;
    const storedNode = styled.value.state.document.pages[0].layers[0].nodes[0];
    const reversedNode = {
      styleId: storedNode.styleId,
      text: storedNode.text,
      geometry: {
        rotation: storedNode.geometry.rotation,
        height: storedNode.geometry.height,
        width: storedNode.geometry.width,
        y: storedNode.geometry.y,
        x: storedNode.geometry.x,
      },
      type: storedNode.type,
      nodeId: storedNode.nodeId,
    };
    const reversedStyle = {
      fontSize: 16,
      textColor: "#000000",
      strokeWidth: 1,
      stroke: "#000000",
      fill: "#ffffff",
      styleId: id(6),
    };
    const stableEntities = executeCommand(
      styled.value.state,
      {
        type: "batch",
        commands: [
          { type: "node.update", pageId: id(2), layerId: id(3), node: reversedNode },
          { type: "style.put", style: reversedStyle },
          { type: "document.setMetadata", title: "Changed", description: "" },
        ],
      },
      { expectedRevision: 1, now },
    );
    expect(stableEntities).toMatchObject({ ok: true, value: { affectedIds: [id(1)] } });
  });
});
