import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoService, type MoveNodeRequest } from "../../src/ui-mock/services/demo-service";

describe("demo service moveNode", () => {
  let service: ReturnType<typeof createDemoService>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createDemoService();
    service.reset("diagram");
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  const requestForFirstNode = (): MoveNodeRequest => {
    const snapshot = service.getSnapshot();
    const page = snapshot.document!.pages.find(
      (candidate) => candidate.pageId === snapshot.pageId,
    )!;
    const layer = page.layers.find((candidate) => candidate.layerId === snapshot.layerId)!;
    return {
      documentId: snapshot.document!.documentId,
      pageId: page.pageId,
      layerId: layer.layerId,
      nodeId: layer.nodes[0].nodeId,
      x: -25,
      y: 42,
      expectedRevision: snapshot.revision,
    };
  };

  const nodeById = (nodeId: string) =>
    service
      .getSnapshot()
      .document!.pages.flatMap((page) => page.layers.flatMap((layer) => layer.nodes))
      .find((node) => node.nodeId === nodeId)!;

  it("moves a node through the validated command boundary and supports inverse undo/redo", () => {
    const request = requestForFirstNode();
    const before = nodeById(request.nodeId);
    const selection = service.getSnapshot().selection;
    const beforeRevision = service.getSnapshot().revision;

    expect(service.moveNode(request)).toBe(true);
    expect(service.getSnapshot().revision).toBe(beforeRevision + 1);
    expect(nodeById(request.nodeId)).toEqual({
      ...before,
      geometry: { ...before.geometry, x: -25, y: 42 },
    });
    expect(nodeById(request.nodeId).text).toBe(before.text);
    expect(service.getSnapshot().selection).toBe(selection);
    expect(service.getSnapshot().canUndo).toBe(true);
    expect(service.getSnapshot().history).toHaveLength(1);

    service.undo();
    expect(nodeById(request.nodeId)).toEqual(before);
    service.redo();
    expect(nodeById(request.nodeId).geometry).toEqual({ ...before.geometry, x: -25, y: 42 });
  });

  it("treats a no-op as success without replacing state or clearing redo", () => {
    const request = requestForFirstNode();
    const node = nodeById(request.nodeId);
    const moved = { ...request, x: -25, y: 42 };
    expect(service.moveNode(moved)).toBe(true);
    service.undo();

    const before = service.getSnapshot();
    const redoAvailable = before.canRedo;
    expect(
      service.moveNode({
        ...request,
        x: node.geometry.x,
        y: node.geometry.y,
        expectedRevision: before.revision,
      }),
    ).toBe(true);
    expect(service.getSnapshot()).toBe(before);
    expect(service.getSnapshot().canRedo).toBe(redoAvailable);

    service.redo();
    expect(nodeById(request.nodeId).geometry).toEqual({ ...node.geometry, x: -25, y: 42 });
  });

  it("rejects stale revisions, viewers, invalid identities, and changed active context atomically", () => {
    const request = requestForFirstNode();
    const before = service.getSnapshot();
    const rejected = [
      { ...request, expectedRevision: request.expectedRevision + 1 },
      { ...request, documentId: "invalid-document" },
      { ...request, pageId: "invalid-page" },
      { ...request, layerId: "invalid-layer" },
      { ...request, nodeId: "invalid-node" },
      {
        ...request,
        nodeId: before.document!.pages[1].layers[0].nodes[0].nodeId,
      },
    ];
    for (const candidate of rejected) {
      expect(service.moveNode(candidate)).toBe(false);
      expect(service.getSnapshot().document).toBe(before.document);
      expect(service.getSnapshot().revision).toBe(before.revision);
    }

    service.setPage(before.document!.pages[1].pageId);
    const changedPage = service.getSnapshot();
    expect(service.moveNode(request)).toBe(false);
    expect(service.getSnapshot().document).toBe(changedPage.document);
    expect(service.getSnapshot().revision).toBe(changedPage.revision);

    service.setPage(before.pageId!);
    service.setLayer(before.document!.pages[0].layers[1].layerId);
    const changedLayer = service.getSnapshot();
    expect(service.moveNode(request)).toBe(false);
    expect(service.getSnapshot().document).toBe(changedLayer.document);
    expect(service.getSnapshot().revision).toBe(changedLayer.revision);

    service.setLayer(before.layerId!);
    const active = service.getSnapshot();
    service.setRole("viewer");
    const viewer = service.getSnapshot();
    expect(service.moveNode({ ...request, expectedRevision: viewer.revision })).toBe(false);
    expect(service.getSnapshot().document).toBe(viewer.document);
    expect(service.getSnapshot().revision).toBe(viewer.revision);
    expect(active.document).toBe(viewer.document);
  });

  it("rejects non-finite and out-of-range coordinates without changing content", () => {
    const request = requestForFirstNode();
    const before = service.getSnapshot();
    for (const coordinates of [
      { x: Number.NaN, y: 1 },
      { x: Number.POSITIVE_INFINITY, y: 1 },
      { x: 1, y: Number.NEGATIVE_INFINITY },
      { x: -1_000_001, y: 1 },
      { x: 1_000_001, y: 1 },
      { x: 1, y: -1_000_001 },
      { x: 1, y: 1_000_001 },
    ]) {
      expect(service.moveNode({ ...request, ...coordinates })).toBe(false);
      expect(service.getSnapshot().document).toBe(before.document);
      expect(service.getSnapshot().revision).toBe(before.revision);
    }
  });

  it("rejects missing documents and missing or cross-layer nodes", async () => {
    const request = requestForFirstNode();
    const before = service.getSnapshot();
    expect(service.moveNode({ ...request, nodeId: "00000000-0000-4000-8000-000000000099" })).toBe(
      false,
    );
    expect(service.getSnapshot().document).toBe(before.document);
    expect(service.getSnapshot().revision).toBe(before.revision);

    service.close("discard");
    await vi.runAllTimersAsync();
    const closed = service.getSnapshot();
    expect(closed.document).toBeNull();
    expect(service.moveNode(request)).toBe(false);
    expect(service.getSnapshot().document).toBeNull();
    expect(service.getSnapshot().revision).toBe(closed.revision);
  });
});
