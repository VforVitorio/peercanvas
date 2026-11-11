import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoService } from "../../src/ui-mock/services/demo-service";
import { validateDocument } from "../../src/document";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

describe("in-memory demo service", () => {
  let service: ReturnType<typeof createDemoService>;
  beforeEach(() => {
    vi.useFakeTimers();
    service = createDemoService();
  });
  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });
  const finish = async () => {
    await vi.runAllTimersAsync();
    await Promise.resolve();
  };
  const countNodes = () =>
    service.getSnapshot().document?.pages.flatMap((p) => p.layers.flatMap((l) => l.nodes)).length ??
    0;
  const addCommand = (suffix: string) => {
    const s = service.getSnapshot();
    const page = s.document!.pages[0];
    const layer = page.layers[0];
    return {
      type: "node.add",
      pageId: page.pageId,
      layerId: layer.layerId,
      index: layer.nodes.length,
      node: {
        nodeId: `00000000-0000-4000-8000-${suffix}`,
        type: "rectangle",
        text: "test",
        geometry: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        styleId: null,
      },
    };
  };

  it("activates every deterministic fixture as a valid snapshot with frozen document data", () => {
    for (const fixture of ["empty", "diagram", "collaboration", "proposal"] as const) {
      service.reset(fixture);
      const snapshot = service.getSnapshot();
      expect(snapshot.fixture).toBe(fixture);
      expect(Object.isFrozen(snapshot)).toBe(true);
      if (snapshot.document) {
        expect(validateDocument(snapshot.document).ok).toBe(true);
        const assertFrozen = (value: unknown) => {
          if (value && typeof value === "object") {
            expect(Object.isFrozen(value)).toBe(true);
            Object.values(value).forEach(assertFrozen);
          }
        };
        assertFrozen(snapshot.document);
        expect(snapshot.document.pages.length).toBeGreaterThan(0);
      }
    }
  });

  it("publishes immutable replacement snapshots and unsubscribes listeners", () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    const first = service.getSnapshot();
    service.setScenario("wait");
    const second = service.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(second).not.toBe(first);
    expect(first.scenario).toBe("success");
    expect(second.scenario).toBe("wait");
    unsubscribe();
    service.setScenario("success");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps selection and page navigation transient while preserving semantic document and revision", () => {
    service.reset("diagram");
    const before = service.getSnapshot();
    const document = before.document;
    const revision = before.revision;
    const node = document!.pages[0].layers[0].nodes[0];
    service.select(node.nodeId);
    service.setPage(document!.pages[1].pageId);
    const after = service.getSnapshot();
    expect(after.document).toBe(document);
    expect(after.revision).toBe(revision);
    expect(after.selection).toBeNull();
    expect(after.pageId).toBe(document!.pages[1].pageId);
  });

  it("denies viewer commands at the service boundary and permits local editing after disconnect", () => {
    service.reset("diagram");
    service.setRole("viewer");
    const before = service.getSnapshot().document;
    const revision = service.getSnapshot().revision;
    service.execute(addCommand("000000000901"));
    expect(service.getSnapshot().document).toBe(before);
    expect(service.getSnapshot().revision).toBe(revision);
    service.setRole("editor");
    service.toggleConnection();
    expect(service.getSnapshot().connected).toBe(false);
    service.execute(addCommand("000000000902"));
    expect(service.getSnapshot().revision).toBe(revision + 1);
    expect(countNodes()).toBeGreaterThan(0);
  });

  it("denies viewer mutations through every exposed editing helper, including undo and redo", () => {
    service.reset("diagram");
    service.execute(addCommand("000000000903"));
    service.execute(addCommand("000000000905"));
    service.undo();
    const initialPage = service.getSnapshot().document!.pages[0];
    service.select(initialPage.layers[0].nodes[0].nodeId);
    const before = service.getSnapshot().document;
    const revision = service.getSnapshot().revision;
    service.setRole("viewer");
    service.execute(addCommand("000000000904"));
    service.addShape("rectangle");
    service.updateSelected({ text: "forbidden" });
    service.removeSelected();
    service.addPage();
    service.renamePage("forbidden");
    service.removePage();
    service.addLayer();
    service.renameLayer("forbidden");
    service.removeLayer();
    service.undo();
    service.redo();
    expect(service.getSnapshot().document).toBe(before);
    expect(service.getSnapshot().revision).toBe(revision);
  });

  it("adds, updates, removes, cascades incident connections, and inverses accepted commands", () => {
    service.reset("empty");
    service.execute(addCommand("000000000911"));
    expect(countNodes()).toBe(1);
    expect(service.getSnapshot().canUndo).toBe(true);
    service.undo();
    expect(countNodes()).toBe(0);
    service.redo();
    expect(countNodes()).toBe(1);
    const current = service.getSnapshot();
    const page = current.document!.pages[0];
    const layer = page.layers[0];
    const target = { ...layer.nodes[0], text: "updated" };
    service.execute({
      type: "node.update",
      pageId: page.pageId,
      layerId: layer.layerId,
      node: target,
    });
    expect(service.getSnapshot().document!.pages[0].layers[0].nodes[0].text).toBe("updated");
    service.undo();
    expect(service.getSnapshot().document!.pages[0].layers[0].nodes[0].text).toBe("test");
    service.reset("diagram");
    const doc = service.getSnapshot().document!;
    const firstPage = doc.pages[0];
    const main = firstPage.layers[0];
    const victim = main.nodes[0];
    service.execute({
      type: "node.remove",
      pageId: firstPage.pageId,
      layerId: main.layerId,
      nodeId: victim.nodeId,
    });
    expect(
      service
        .getSnapshot()
        .document!.pages[0].layers.flatMap((l) => l.connections)
        .some((c) => c.sourceNodeId === victim.nodeId || c.targetNodeId === victim.nodeId),
    ).toBe(false);
    service.undo();
    expect(
      service
        .getSnapshot()
        .document!.pages[0].layers[0].nodes.some((n) => n.nodeId === victim.nodeId),
    ).toBe(true);
  });

  it("restores full semantic snapshots across undo/redo of node and layer cascades", () => {
    service.reset("diagram");
    const beforeNodeRemoval = structuredClone(service.getSnapshot().document);
    const doc = service.getSnapshot().document!;
    const page = doc.pages[0];
    const layer = page.layers[0];
    service.execute({
      type: "node.remove",
      pageId: page.pageId,
      layerId: layer.layerId,
      nodeId: layer.nodes[0].nodeId,
    });
    service.undo();
    expect(service.getSnapshot().document).toEqual(beforeNodeRemoval);
    service.redo();
    expect(service.getSnapshot().document).not.toEqual(beforeNodeRemoval);
    service.undo();
    expect(service.getSnapshot().document).toEqual(beforeNodeRemoval);
    const currentPage = service.getSnapshot().document!.pages[0];
    const primaryLayer = currentPage.layers[0];
    service.execute({
      type: "layer.add",
      pageId: currentPage.pageId,
      index: currentPage.layers.length,
      layer: {
        layerId: "00000000-0000-4000-8000-000000000886",
        name: "Cross-layer endpoint",
        nodes: [
          {
            nodeId: "00000000-0000-4000-8000-000000000887",
            type: "rectangle",
            text: "endpoint",
            geometry: { x: 5, y: 5, width: 20, height: 20, rotation: 0 },
            styleId: null,
          },
        ],
        connections: [],
      },
    });
    service.execute({
      type: "layer.add",
      pageId: page.pageId,
      index: page.layers.length,
      layer: {
        layerId: "00000000-0000-4000-8000-000000000888",
        name: "Spare",
        nodes: [],
        connections: [],
      },
    });
    service.execute({
      type: "connection.add",
      pageId: page.pageId,
      layerId: "00000000-0000-4000-8000-000000000886",
      index: 0,
      connection: {
        connectionId: "00000000-0000-4000-8000-000000000889",
        sourceNodeId: primaryLayer.nodes[0].nodeId,
        targetNodeId: "00000000-0000-4000-8000-000000000887",
        routing: "straight",
        label: "cross-layer",
        styleId: null,
      },
    });
    const beforeLayerRemoval = structuredClone(service.getSnapshot().document);
    service.execute({ type: "layer.remove", pageId: page.pageId, layerId: page.layers[0].layerId });
    const afterLayerRemoval = structuredClone(service.getSnapshot().document);
    expect(
      service
        .getSnapshot()
        .document!.pages[0].layers.flatMap((layer) => layer.connections)
        .some((connection) => connection.connectionId === "00000000-0000-4000-8000-000000000889"),
    ).toBe(false);
    service.undo();
    expect(service.getSnapshot().document).toEqual(beforeLayerRemoval);
    service.redo();
    expect(service.getSnapshot().document).toEqual(afterLayerRemoval);
  });

  it("requires decisions for dirty replacement and preserves state on cancel, failed save, and failed operation", async () => {
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Changed", description: "" });
    const original = service.getSnapshot().document;
    service.open("diagram");
    expect(service.getSnapshot().needsDecision).toBe(true);
    await service.resolveDecision("cancel");
    expect(service.getSnapshot().document).toBe(original);
    service.setScenario("error");
    const saving = service.save();
    await finish();
    await saving;
    expect(service.getSnapshot().document).toBe(original);
    expect(service.getSnapshot().savedRevision).not.toBe(service.getSnapshot().revision);
    service.startOperation("import");
    await finish();
    expect(service.getSnapshot().document).toBe(original);
    expect(service.getSnapshot().proposal).toBeNull();
    expect(service.getSnapshot().operation?.status).toBe("error");
  });

  it("prevents save continuations and pending decisions from replacing a reset session", async () => {
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Dirty", description: "" });
    service.setScenario("wait");
    const opening = service.open("collaboration", "save");
    expect(service.getSnapshot().operation?.status).toBe("waiting");
    service.reset("diagram");
    const resetSnapshot = service.getSnapshot();
    await finish();
    await opening;
    expect(service.getSnapshot()).toBe(resetSnapshot);

    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Dirty again", description: "" });
    service.open("proposal");
    service.setScenario("wait");
    const decision = service.resolveDecision("save");
    expect(service.getSnapshot().operation?.status).toBe("waiting");
    service.reset("collaboration");
    const secondReset = service.getSnapshot();
    await finish();
    await decision;
    expect(service.getSnapshot()).toBe(secondReset);
  });

  it("does not replace a saved document when save is cancelled, fails, or is already busy", async () => {
    for (const scenario of ["cancel", "error"] as const) {
      service.reset("diagram");
      service.setScenario(scenario);
      const before = service.getSnapshot();
      expect(before.savedRevision).toBe(before.revision);
      const opening = service.open("collaboration", "save");
      await finish();
      await opening;
      expect(service.getSnapshot().document).toBe(before.document);
      expect(service.getSnapshot().fixture).toBe("diagram");
      expect(service.getSnapshot().savedRevision).toBe(before.savedRevision);
      expect(service.getSnapshot().operation?.status).toBe(
        scenario === "cancel" ? "cancelled" : "error",
      );
    }
    service.reset("diagram");
    service.setScenario("wait");
    service.startOperation("export");
    const before = service.getSnapshot();
    expect(before.savedRevision).toBe(before.revision);
    const opening = service.open("collaboration", "save");
    await opening;
    expect(service.getSnapshot().document).toBe(before.document);
    expect(service.getSnapshot().fixture).toBe("diagram");
    expect(service.getSnapshot().operation?.kind).toBe("export");
    service.cancelOperation();
    await finish();
  });

  it("keeps edits made during replacement save and honors a cancelled save decision intent", async () => {
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Draft", description: "" });
    service.open("collaboration");
    service.setScenario("wait");
    const savingDecision = service.resolveDecision("save");
    const beforeEdit = service.getSnapshot().document;
    service.execute({
      type: "document.setMetadata",
      title: "Edited while saving",
      description: "",
    });
    const editedDocument = service.getSnapshot().document;
    expect(editedDocument).not.toBe(beforeEdit);
    service.finishWaiting();
    await savingDecision;
    expect(service.getSnapshot().fixture).toBe("empty");
    expect(service.getSnapshot().document).toBe(editedDocument);
    expect(service.getSnapshot().document?.metadata.title).toBe("Edited while saving");
    expect(service.getSnapshot().savedRevision).not.toBe(service.getSnapshot().revision);

    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Draft", description: "" });
    const original = service.getSnapshot().document;
    service.open("collaboration");
    service.setScenario("wait");
    const pendingSave = service.resolveDecision("save");
    await service.resolveDecision("cancel");
    service.finishWaiting();
    await pendingSave;
    expect(service.getSnapshot().document).toBe(original);
    expect(service.getSnapshot().fixture).toBe("empty");
    expect(service.getSnapshot().needsDecision).toBe(false);
  });

  it("keeps accepted command values and labels when callers mutate the submitted object", () => {
    service.reset("empty");
    const command = addCommand("000000000933");
    const acceptedNode = structuredClone(command.node);
    service.execute(command);
    command.node.text = "caller mutation";
    command.node.geometry.x = 999;
    command.node.nodeId = "caller-mutated-id";
    expect(service.getSnapshot().history.at(-1)?.label).toBe("Add shape");
    service.undo();
    service.redo();
    expect(service.getSnapshot().document?.pages[0].layers[0].nodes[0]).toMatchObject(acceptedNode);
    expect(service.getSnapshot().history.at(-1)?.label).toBe("Add shape");
  });

  it("uses one descriptor snapshot for command execution and undo/redo history", () => {
    service.reset("empty");
    const command = addCommand("000000000934");
    const acceptedNode = structuredClone(command.node);
    let reads = 0;
    let nodeDescriptors = 0;
    const proxy = new Proxy(command, {
      get() {
        reads++;
        throw new Error("Caller property reads are forbidden");
      },
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key === "node" && ++nodeDescriptors > 1)
          return { ...descriptor, value: { ...command.node, text: "changed on reread" } };
        return descriptor;
      },
    });
    expect(() => service.execute(proxy)).not.toThrow();
    expect(reads).toBe(0);
    expect(nodeDescriptors).toBe(1);
    expect(service.getSnapshot().document?.pages[0].layers[0].nodes[0]).toEqual(acceptedNode);
    service.undo();
    service.redo();
    expect(service.getSnapshot().document?.pages[0].layers[0].nodes[0]).toEqual(acceptedNode);
  });

  it("rejects accessor and throwing proxy commands without invoking caller callbacks", () => {
    service.reset("empty");
    const before = service.getSnapshot();
    let calls = 0;
    const command = {
      type: "document.setMetadata",
      description: "",
      get title() {
        calls++;
        return "unexpected";
      },
    };
    service.execute(command);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(() => service.execute(revoked.proxy)).not.toThrow();
    expect(calls).toBe(0);
    expect(service.getSnapshot().document).toBe(before.document);
    expect(service.getSnapshot().revision).toBe(before.revision);
    expect(service.getSnapshot().history).toEqual(before.history);
  });

  it("supports dirty save/discard/cancel decisions and preserves the active document on failed or cancelled replacement", async () => {
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Dirty", description: "" });
    const original = service.getSnapshot().document;
    service.open("diagram");
    expect(service.getSnapshot().needsDecision).toBe(true);
    const discard = service.resolveDecision("discard");
    await finish();
    await discard;
    expect(service.getSnapshot().fixture).toBe("diagram");
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Dirty", description: "" });
    service.setScenario("success");
    const replacement = service.open("collaboration", "save");
    await vi.advanceTimersByTimeAsync(360);
    await vi.advanceTimersByTimeAsync(360);
    await replacement;
    expect(service.getSnapshot().fixture).toBe("collaboration");
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Dirty", description: "" });
    const retained = service.getSnapshot().document;
    service.setScenario("error");
    const failed = service.open("diagram", "discard");
    await finish();
    await failed;
    expect(service.getSnapshot().document).toBe(retained);
    service.setScenario("cancel");
    const cancelled = service.open("diagram", "discard");
    await finish();
    await cancelled;
    expect(service.getSnapshot().document).toBe(retained);
    expect(original).not.toBeNull();
  });

  it("keeps edits made during a save dirty, cancels delayed work on reset, and handles waiting completion", async () => {
    service.reset("empty");
    service.execute({ type: "document.setMetadata", title: "Draft", description: "" });
    const save = service.save();
    service.execute({ type: "document.setMetadata", title: "Later edit", description: "" });
    await finish();
    await save;
    expect(service.getSnapshot().savedRevision).toBeLessThan(service.getSnapshot().revision);
    service.setScenario("wait");
    service.startOperation("assistant");
    expect(service.getSnapshot().operation?.status).toBe("waiting");
    service.reset("diagram");
    await finish();
    expect(service.getSnapshot().proposal).toBeNull();
    expect(service.getSnapshot().fixture).toBe("diagram");
    service.reset("empty");
    service.setScenario("wait");
    service.startOperation("assistant");
    service.finishWaiting();
    expect(service.getSnapshot().proposal?.status).toBe("pending");
    service.reset("diagram");
    service.startOperation("export");
    service.cancelOperation();
    await finish();
    expect(service.getSnapshot().operation?.status).toBe("cancelled");
    service.reset("empty");
    service.startOperation("assistant");
    service.reset("diagram");
    await finish();
    expect(service.getSnapshot().proposal).toBeNull();
    expect(service.getSnapshot().fixture).toBe("diagram");
  });

  it("gates proposals behind one approval and rejects stale, cancelled, or replaced-session proposals", async () => {
    service.reset("empty");
    service.startOperation("assistant");
    await finish();
    expect(service.getSnapshot().proposal?.status).toBe("pending");
    const before = service.getSnapshot().document;
    service.rejectProposal();
    expect(service.getSnapshot().document).toBe(before);
    service.startOperation("assistant");
    await finish();
    service.approveProposal();
    expect(countNodes()).toBe(1);
    const revision = service.getSnapshot().revision;
    service.approveProposal();
    expect(service.getSnapshot().revision).toBe(revision);
    service.startOperation("assistant");
    await finish();
    service.execute({ type: "document.setMetadata", title: "new revision", description: "" });
    const staleRevision = service.getSnapshot().revision;
    service.approveProposal();
    expect(service.getSnapshot().proposal?.status).toBe("stale");
    expect(service.getSnapshot().revision).toBe(staleRevision);
    service.startOperation("assistant");
    await finish();
    service.cancelOperation();
    expect(service.getSnapshot().proposal?.status).toBe("rejected");
    const rejectedDoc = service.getSnapshot().document;
    const rejectedRevision = service.getSnapshot().revision;
    service.approveProposal();
    expect(service.getSnapshot().document).toBe(rejectedDoc);
    expect(service.getSnapshot().revision).toBe(rejectedRevision);
    service.startOperation("assistant");
    await finish();
    service.setRole("viewer");
    service.approveProposal();
    expect(service.getSnapshot().document).toBe(rejectedDoc);
    expect(service.getSnapshot().revision).toBe(rejectedRevision);
    service.setRole("editor");
    service.startOperation("assistant");
    await finish();
    const beforeReplacement = service.getSnapshot().document;
    const replacing = service.open("diagram");
    expect(service.getSnapshot().needsDecision).toBe(true);
    const discard = service.resolveDecision("discard");
    await finish();
    await discard;
    await replacing;
    expect(service.getSnapshot().document).not.toBe(beforeReplacement);
    expect(service.getSnapshot().proposal).toBeNull();
  });

  it("drops a simulated provider response when the document changes before its timer completes", async () => {
    service.reset("empty");
    service.sendMessage("suggest a queue");
    service.execute({
      type: "document.setMetadata",
      title: "edited while waiting",
      description: "",
    });
    const revision = service.getSnapshot().revision;
    await finish();
    expect(service.getSnapshot().revision).toBe(revision);
    expect(service.getSnapshot().proposal).toBeNull();
    expect(service.getSnapshot().messages.some((message) => message.role === "assistant")).toBe(
      false,
    );
    expect(service.getSnapshot().notice?.message).toContain("Document changed");
  });

  it("reorders pages, adds/removes layers through validated commands, and retains a final layer", () => {
    service.reset("diagram");
    const initial = service.getSnapshot().document!;
    const pageIds = initial.pages.map((p) => p.pageId).reverse();
    service.execute({ type: "page.reorder", pageIds });
    expect(service.getSnapshot().document!.pages.map((p) => p.pageId)).toEqual(pageIds);
    const pageId = service.getSnapshot().pageId!;
    const page = service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!;
    service.addLayer();
    expect(
      service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!.layers.length,
    ).toBe(page.layers.length + 1);
    const activeLayerId = service.getSnapshot().layerId;
    service.removeLayer();
    expect(
      service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!.layers.length,
    ).toBe(page.layers.length);
    service.setLayer(
      service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!.layers[0].layerId,
    );
    service.removeLayer();
    expect(
      service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!.layers.length,
    ).toBe(1);
    expect(
      service.getSnapshot().document!.pages.find((p) => p.pageId === pageId)!.layers[0].layerId,
    ).toBeTruthy();
    expect(activeLayerId).toBeTruthy();
  });

  it("supports recovery preview without replacement, fictional invitations, admission, and import/export simulation", async () => {
    service.reset("empty");
    const document = service.getSnapshot().document;
    service.previewRecovery("recovery-architecture");
    expect(service.getSnapshot().document).toBe(document);
    expect(service.getSnapshot().notice?.message).toContain("preview");
    service.invite();
    expect(service.getSnapshot().invitation).toContain("NOT-A-REAL-LINK");
    service.admit("sam", "viewer");
    expect(service.getSnapshot().participants.find((p) => p.id === "sam")).toMatchObject({
      role: "viewer",
      status: "connected",
    });
    service.startOperation("import");
    await finish();
    expect(service.getSnapshot().proposal?.status).toBe("pending");
    service.rejectProposal();
    expect(service.getSnapshot().document).toBe(document);
    service.startOperation("import");
    await finish();
    expect(service.getSnapshot().document).toBe(document);
    service.approveProposal();
    expect(countNodes()).toBe(1);
    const approvedRevision = service.getSnapshot().revision;
    service.approveProposal();
    expect(service.getSnapshot().revision).toBe(approvedRevision);
    service.startOperation("export");
    await finish();
    expect(service.getSnapshot().notice?.message).toContain("No file was generated");
    expect(service.getSnapshot().revision).toBe(approvedRevision);
  });

  it("simulates admission denial and revocation without changing the local document", () => {
    service.reset("collaboration");
    service.deny("sam");
    expect(service.getSnapshot().participants.some((participant) => participant.id === "sam")).toBe(
      false,
    );
    service.reset("collaboration");
    const documentAfterReset = service.getSnapshot().document;
    service.admit("sam", "viewer");
    expect(
      service.getSnapshot().participants.find((participant) => participant.id === "sam"),
    ).toMatchObject({ role: "viewer" });
    service.revoke("sam");
    expect(service.getSnapshot().participants.some((participant) => participant.id === "sam")).toBe(
      false,
    );
    expect(service.getSnapshot().document).toBe(documentAfterReset);
  });

  it("scans core and in-memory service TypeScript sources for direct external I/O APIs", () => {
    const root = resolve(process.cwd());
    const sourceRoots = ["src/document", "src/ui-mock"];
    const files: string[] = [];
    const collect = (relative: string) => {
      const absolute = resolve(root, relative);
      if (statSync(absolute).isDirectory()) {
        for (const entry of readdirSync(absolute)) collect(join(relative, entry));
      } else if (
        /\.tsx?$/.test(relative) &&
        !/(?:^|\/)(?:__tests__|tests?)(?:\/|\.)/i.test(relative)
      )
        files.push(relative);
    };
    sourceRoots.forEach(collect);
    const forbiddenModules = [
      "@tauri-apps/api",
      "node:fs",
      "node:http",
      "node:https",
      "node:net",
      "node:child_process",
      "node:dgram",
      "node:tls",
    ];
    const forbiddenCalls = new Set([
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "invoke",
      "setItem",
      "getItem",
      "removeItem",
    ]);
    const forbiddenProperties = new Set([
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "cookie",
      "credentials",
      "clipboard",
      "WebSocket",
      "XMLHttpRequest",
      "fetch",
    ]);
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(resolve(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const violations: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const moduleName = node.moduleSpecifier.text;
          if (
            forbiddenModules.some(
              (value) => moduleName === value || moduleName.startsWith(`${value}/`),
            )
          )
            violations.push(`import:${moduleName}`);
        }
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const name = ts.isIdentifier(expression)
            ? expression.text
            : ts.isPropertyAccessExpression(expression)
              ? expression.name.text
              : "";
          if (forbiddenCalls.has(name)) violations.push(`call:${name}`);
        }
        if (ts.isNewExpression(node)) {
          const name = ts.isIdentifier(node.expression) ? node.expression.text : "";
          if (forbiddenProperties.has(name)) violations.push(`new:${name}`);
        }
        if (ts.isPropertyAccessExpression(node) && forbiddenProperties.has(node.name.text)) {
          violations.push(`property:${node.name.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(violations, file).toEqual([]);
    }
  });
});
