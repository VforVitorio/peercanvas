import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { serializeDocument, type ModelState } from "../document";
import { createSample } from "../editor/sample";
import { PeerDocumentSession } from "./peer-document-session";
import type {
  CommandProposal,
  CommandReply,
  PeerAwarenessState,
  PeerDocumentTransport,
  PeerTransportError,
  SyncAcknowledgement,
  SyncAcknowledgementReply,
} from "./types";

type YjsListener = (update: Uint8Array, peerId: string) => void;

class FakePeerNetwork {
  readonly transports = new Map<string, FakePeerTransport>();
  readonly awareness = new Map<string, PeerAwarenessState>();
  readonly pendingUpdates: Array<{ from: string; to: string; update: Uint8Array }> = [];
  pauseUpdates = false;

  add(peerId: string): FakePeerTransport {
    const transport = new FakePeerTransport(peerId, this);
    this.transports.set(peerId, transport);
    return transport;
  }

  connect(left: FakePeerTransport, right: FakePeerTransport): void {
    left.peers.add(right.peerId);
    right.peers.add(left.peerId);
    left.notifyPeerJoin(right.peerId);
    right.notifyPeerJoin(left.peerId);
  }

  async sendUpdate(from: string, update: Uint8Array): Promise<void> {
    const sender = this.transports.get(from);
    if (!sender) return;
    for (const target of sender.peers) {
      if (this.pauseUpdates) {
        this.pendingUpdates.push({ from, to: target, update: update.slice() });
      } else {
        this.deliverUpdate(from, target, update);
      }
    }
  }

  async flushUpdates(): Promise<void> {
    const pending = this.pendingUpdates.splice(0);
    for (const item of pending) this.deliverUpdate(item.from, item.to, item.update);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  injectUpdate(target: string, from: string, update: Uint8Array): void {
    this.deliverUpdate(from, target, update);
  }

  async setAwareness(peerId: string, state: PeerAwarenessState | null): Promise<void> {
    if (state === null) this.awareness.delete(peerId);
    else this.awareness.set(peerId, state);
    for (const transport of this.transports.values()) transport.notifyAwareness();
  }

  disconnect(left: FakePeerTransport): void {
    for (const peerId of [...left.peers]) {
      const peer = this.transports.get(peerId);
      peer?.peers.delete(left.peerId);
      peer?.notifyPeerLeave(left.peerId);
    }
    left.peers.clear();
    void this.setAwareness(left.peerId, null);
  }

  private deliverUpdate(from: string, to: string, update: Uint8Array): void {
    this.transports.get(to)?.notifyYjsUpdate(update.slice(), from);
  }
}

class FakePeerTransport implements PeerDocumentTransport {
  readonly ready = Promise.resolve();
  readonly peers = new Set<string>();
  private readonly network: FakePeerNetwork;
  private readonly peerJoin = new Set<(peerId: string) => void>();
  private readonly peerLeave = new Set<(peerId: string) => void>();
  private readonly errors = new Set<(error: PeerTransportError) => void>();
  private readonly yjsUpdates = new Set<YjsListener>();
  private readonly awarenessChanges = new Set<() => void>();
  private syncRequest?: (peerId: string) => Promise<Uint8Array>;
  private syncAcknowledgement?: (
    acknowledgement: SyncAcknowledgement,
    peerId: string,
  ) => Promise<SyncAcknowledgementReply>;
  private commandRequest?: (proposal: CommandProposal, peerId: string) => Promise<CommandReply>;

  constructor(
    readonly peerId: string,
    network: FakePeerNetwork,
  ) {
    this.network = network;
  }

  getPeerIds(): string[] {
    return [...this.peers];
  }

  async getNetworkDiagnostics() {
    return [];
  }

  onPeerJoin(handler: (peerId: string) => void, replay = false): () => void {
    this.peerJoin.add(handler);
    if (replay) for (const peerId of this.peers) handler(peerId);
    return () => this.peerJoin.delete(handler);
  }

  onPeerLeave(handler: (peerId: string) => void): () => void {
    this.peerLeave.add(handler);
    return () => this.peerLeave.delete(handler);
  }

  onError(handler: (error: PeerTransportError) => void): () => void {
    this.errors.add(handler);
    return () => this.errors.delete(handler);
  }

  onYjsUpdate(handler: YjsListener): () => void {
    this.yjsUpdates.add(handler);
    return () => this.yjsUpdates.delete(handler);
  }

  broadcastYjsUpdate(update: Uint8Array): Promise<void> {
    return this.network.sendUpdate(this.peerId, update);
  }

  onSyncRequest(handler: (peerId: string) => Promise<Uint8Array>): () => void {
    this.syncRequest = handler;
    return () => {
      this.syncRequest = undefined;
    };
  }

  async requestSync(peerId: string): Promise<Uint8Array> {
    const target = this.network.transports.get(peerId);
    if (!target || !this.peers.has(peerId) || !target.syncRequest)
      throw new Error("Target peer is disconnected.");
    return target.syncRequest(this.peerId);
  }

  onSyncAcknowledgement(
    handler: (
      acknowledgement: SyncAcknowledgement,
      peerId: string,
    ) => Promise<SyncAcknowledgementReply>,
  ): () => void {
    this.syncAcknowledgement = handler;
    return () => {
      this.syncAcknowledgement = undefined;
    };
  }

  async requestSyncAcknowledgement(
    peerId: string,
    acknowledgement: SyncAcknowledgement,
  ): Promise<SyncAcknowledgementReply> {
    const target = this.network.transports.get(peerId);
    if (!target || !this.peers.has(peerId) || !target.syncAcknowledgement)
      throw new Error("Target peer is disconnected.");
    return target.syncAcknowledgement(acknowledgement, this.peerId);
  }

  onCommandRequest(
    handler: (proposal: CommandProposal, peerId: string) => Promise<CommandReply>,
  ): () => void {
    this.commandRequest = handler;
    return () => {
      this.commandRequest = undefined;
    };
  }

  async requestCommand(peerId: string, proposal: CommandProposal): Promise<CommandReply> {
    const target = this.network.transports.get(peerId);
    if (!target || !this.peers.has(peerId) || !target.commandRequest)
      throw new Error("Target peer is disconnected.");
    return target.commandRequest(proposal, this.peerId);
  }

  getAwareness(): Readonly<Record<string, PeerAwarenessState | null>> {
    return Object.fromEntries(
      [...this.network.awareness.entries()].filter(
        ([peerId]) => peerId === this.peerId || this.peers.has(peerId),
      ),
    );
  }

  onAwarenessChange(handler: () => void): () => void {
    this.awarenessChanges.add(handler);
    return () => this.awarenessChanges.delete(handler);
  }

  setAwareness(state: PeerAwarenessState | null): Promise<void> {
    return this.network.setAwareness(this.peerId, state);
  }

  async close(): Promise<void> {
    this.network.disconnect(this);
  }

  notifyPeerJoin(peerId: string): void {
    for (const handler of this.peerJoin) handler(peerId);
  }

  notifyPeerLeave(peerId: string): void {
    for (const handler of this.peerLeave) handler(peerId);
  }

  notifyYjsUpdate(update: Uint8Array, peerId: string): void {
    for (const handler of this.yjsUpdates) handler(update, peerId);
  }

  notifyAwareness(): void {
    for (const handler of this.awarenessChanges) handler();
  }
}

async function makeConnectedSessions(options?: { pauseUpdates?: boolean }) {
  const network = new FakePeerNetwork();
  const hostTransport = network.add("host-peer");
  const peerTransport = network.add("participant-peer");
  network.connect(hostTransport, peerTransport);
  if (options?.pauseUpdates) network.pauseUpdates = true;

  const initial = createSample();
  const savedBefore = serializeDocument(initial.document);
  if (!savedBefore.ok) throw new Error("Test fixture document is invalid.");
  const host = new PeerDocumentSession({
    role: "host",
    initialState: initial,
    transport: hostTransport,
  });
  await host.start();
  const participant = new PeerDocumentSession({
    role: "participant",
    hostPeerId: hostTransport.peerId,
    transport: peerTransport,
  });
  await participant.start();
  return { network, host, participant, initial, savedBefore: savedBefore.value };
}

function updateNode(state: ModelState, nodeId: string, x: number) {
  const page = state.document.pages[0];
  const layer = page.layers.find((candidate) =>
    candidate.nodes.some((node) => node.nodeId === nodeId),
  );
  const node = layer?.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!layer || !node) throw new Error("Test node not found.");
  return {
    type: "node.update",
    pageId: page.pageId,
    layerId: layer.layerId,
    node: { ...node, geometry: { ...node.geometry, x } },
  };
}

function documentJson(state: ModelState): string {
  const result = serializeDocument(state.document);
  if (!result.ok) throw new Error("Test result is invalid.");
  return result.value;
}

async function waitUntil(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

describe("host-sequenced Yjs document sessions", () => {
  it("validates a joining snapshot before ready and replicates accepted commands", async () => {
    const { host, participant, initial, savedBefore } = await makeConnectedSessions();
    const hostState = host.getSnapshot().model;
    const node = hostState?.document.pages[0].layers[0].nodes[0];
    if (!hostState || !node) throw new Error("Host did not load the document.");

    expect(participant.getSnapshot().status).toBe("ready");
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(hostState),
    );

    const reply = await participant.submitCommand(
      updateNode(hostState, node.nodeId, node.geometry.x + 24),
    );
    expect(reply).toMatchObject({ status: "accepted", changed: true });
    await waitUntil(
      () => participant.getSnapshot().model?.revision === host.getSnapshot().model?.revision,
      "the accepted Yjs commit",
    );
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );
    expect(documentJson(initial)).toBe(savedBefore);

    await participant.close();
    await host.close();
  });

  it("rebases simultaneous edits to different elements in host order", async () => {
    const { host, participant, network } = await makeConnectedSessions({ pauseUpdates: true });
    const hostState = host.getSnapshot().model as ModelState;
    const [first, second] = hostState.document.pages[0].layers[0].nodes;
    if (!first || !second) throw new Error("Test fixture nodes are missing.");

    const hostReply = await host.submitCommand(
      updateNode(hostState, first.nodeId, first.geometry.x + 12),
    );
    expect(hostReply).toMatchObject({ status: "accepted", changed: true });

    const participantState = participant.getSnapshot().model as ModelState;
    const pending = participant.submitCommand(
      updateNode(participantState, second.nodeId, second.geometry.x + 28),
    );
    await waitUntil(
      () => (host.getSnapshot().model?.revision ?? 0) === hostState.revision + 2,
      "the host to accept the rebased command",
    );
    await network.flushUpdates();
    const participantReply = await pending;
    expect(participantReply).toMatchObject({ status: "accepted", changed: true });
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );

    await participant.close();
    await host.close();
  });

  it("rejects overlapping stale edits and returns the current validated state", async () => {
    const { host, participant, network } = await makeConnectedSessions({ pauseUpdates: true });
    const initial = participant.getSnapshot().model as ModelState;
    const node = initial.document.pages[0].layers[0].nodes[0];
    if (!node) throw new Error("Test fixture node is missing.");

    await host.submitCommand(
      updateNode(host.getSnapshot().model as ModelState, node.nodeId, node.geometry.x + 10),
    );
    const reply = await participant.submitCommand(
      updateNode(initial, node.nodeId, node.geometry.x + 40),
    );
    expect(reply).toMatchObject({ status: "rejected", code: "REVISION_CONFLICT" });
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );
    await network.flushUpdates();
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );

    await participant.close();
    await host.close();
  });

  it("deduplicates command retries and rejects malformed commands atomically", async () => {
    const { host, participant } = await makeConnectedSessions();
    const before = documentJson(host.getSnapshot().model as ModelState);
    const state = participant.getSnapshot().model as ModelState;
    const node = state.document.pages[0].layers[0].nodes[0];
    if (!node) throw new Error("Test fixture node is missing.");
    const command = updateNode(state, node.nodeId, node.geometry.x + 4);
    const commandId = "same-command-retry";
    const first = await participant.submitCommand(command, commandId);
    const committed = documentJson(host.getSnapshot().model as ModelState);
    const revision = host.getSnapshot().model?.revision;
    const duplicate = await participant.submitCommand(command, commandId);
    expect(first).toEqual(duplicate);
    expect(host.getSnapshot().model?.revision).toBe(revision);
    expect(committed).not.toBe(before);

    const invalid = await participant.submitCommand({
      type: "node.remove",
      pageId: "missing-page",
      layerId: "missing-layer",
      nodeId: "missing-node",
    });
    expect(invalid.status).toBe("rejected");
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );
    await participant.close();
    await host.close();
  });

  it("rejects oversized remote proposals before placing them on the host queue", async () => {
    const { network, host, participant } = await makeConnectedSessions();
    const hostState = host.getSnapshot().model as ModelState;
    const before = documentJson(hostState);
    const remote = network.transports.get("participant-peer");
    if (!remote) throw new Error("Participant transport is missing.");

    const reply = await remote.requestCommand("host-peer", {
      commandId: "oversized-proposal",
      baseRevision: hostState.revision,
      command: { type: "node.update", payload: "x".repeat(2 * 1024 * 1024 + 1) },
    });

    expect(reply).toMatchObject({ status: "rejected", code: "INVALID_COMMAND" });
    expect(documentJson(host.getSnapshot().model as ModelState)).toBe(before);
    await participant.close();
    await host.close();
  });

  it("ignores Yjs updates from anyone other than the host", async () => {
    const { network, host, participant } = await makeConnectedSessions();
    const hostDocument = documentJson(host.getSnapshot().model as ModelState);
    const malicious = new Y.Doc();
    malicious.getMap("peer2canvas").set(
      "checkpoint",
      JSON.stringify({
        version: 1,
        epoch: "forged-session",
        hostPeerId: "attacker-peer",
        baseRevision: 0,
        revision: 999,
        document: "{}",
      }),
    );
    malicious.getMap("peer2canvas").set("latestRevision", "999");
    network.injectUpdate("participant-peer", "attacker-peer", Y.encodeStateAsUpdate(malicious));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(participant.getSnapshot().status).toBe("ready");
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(hostDocument);
    malicious.destroy();
    await participant.close();
    await host.close();
  });

  it("recovers initial state from a checkpoint and bounded commit tail", async () => {
    const network = new FakePeerNetwork();
    const hostTransport = network.add("host-peer");
    const initial = createSample();
    const host = new PeerDocumentSession({
      role: "host",
      initialState: initial,
      transport: hostTransport,
    });
    await host.start();
    const savedBefore = documentJson(initial);
    const initialState = host.getSnapshot().model as ModelState;
    const node = initialState.document.pages[0].layers[0].nodes[0];
    if (!node) throw new Error("Test fixture node is missing.");

    for (let step = 1; step <= 65; step++) {
      const current = host.getSnapshot().model as ModelState;
      const currentNode = current.document.pages[0].layers[0].nodes[0];
      if (!currentNode) throw new Error("Test fixture node disappeared.");
      const reply = await host.submitCommand(
        updateNode(current, currentNode.nodeId, node.geometry.x + step),
      );
      expect(reply.status).toBe("accepted");
    }

    const participantTransport = network.add("late-peer");
    network.connect(hostTransport, participantTransport);
    const participant = new PeerDocumentSession({
      role: "participant",
      hostPeerId: hostTransport.peerId,
      transport: participantTransport,
    });
    await participant.start();
    expect(participant.getSnapshot().status).toBe("ready");
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(
      documentJson(host.getSnapshot().model as ModelState),
    );
    expect(documentJson(initial)).toBe(savedBefore);
    await participant.close();
    await host.close();
  });

  it("keeps awareness out of the canonical document and retains state after host loss", async () => {
    const { host, participant, initial } = await makeConnectedSessions();
    const before = documentJson(participant.getSnapshot().model as ModelState);
    await participant.setAwareness({ cursor: { x: 180, y: 220 }, selectionId: null });
    expect(host.getSnapshot().awareness["participant-peer"]).toEqual({
      cursor: { x: 180, y: 220 },
      selectionId: null,
    });
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(before);
    expect(documentJson(initial)).toBe(documentJson(host.getSnapshot().model as ModelState));

    const lastState = documentJson(participant.getSnapshot().model as ModelState);
    await host.close();
    expect(participant.getSnapshot().status).toBe("disconnected");
    expect(documentJson(participant.getSnapshot().model as ModelState)).toBe(lastState);
    await participant.close();
  });
});
