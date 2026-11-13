import * as Y from "yjs";
import { executeCommand, parseDocument, serializeDocument, type ModelState } from "../document";
import { MAX_SYNC_UPDATE_BYTES } from "./types";
import type {
  CommandProposal,
  CommandReply,
  PeerAwarenessState,
  PeerDocumentChange,
  PeerDocumentSnapshot,
  PeerDocumentTransport,
  PeerSessionStatus,
  SyncAcknowledgement,
  SyncAcknowledgementReply,
} from "./types";

const ROOT_KEY = "peer2canvas";
const COMMIT_LOG_KEY = "commits";
const PROTOCOL_VERSION = 1;
const MAX_COMMAND_BYTES = 2 * 1024 * 1024;
const MAX_PROPOSAL_BYTES = MAX_COMMAND_BYTES + 1024;
const MAX_COMMIT_LOG_BYTES = 8 * 1024 * 1024;
const MAX_COMMIT_LOG_ENTRIES = 64;
const MAX_REBASE_REVISIONS = 256;
const MAX_PENDING_COMMANDS = 32;
const MAX_SYNC_ATTEMPTS = 3;
const MAX_PENDING_UPDATE_BYTES = MAX_SYNC_UPDATE_BYTES * 2;
const SYNC_TIMEOUT_MS = 15_000;
const COMMIT_ORIGIN = "peer2canvas-host-commit";
const REMOTE_ORIGIN = "peer2canvas-host-update";

function secureId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type Checkpoint = {
  version: 1;
  epoch: string;
  hostPeerId: string;
  baseRevision: number;
  revision: number;
  document: string;
};

type CommitRecord = {
  version: 1;
  epoch: string;
  revision: number;
  commandId: string;
  originPeerId: string;
  now: string;
  command: JsonValue;
  affectedIds: string[];
};

type ParsedCommitState = {
  state: ModelState;
  epoch: string;
  baseRevision: number;
  complete: boolean;
  events: PeerDocumentChange[];
};

export type PeerDocumentSessionOptions =
  | {
      role: "host";
      initialState: ModelState;
      transport: PeerDocumentTransport;
      commandId?: () => string;
    }
  | {
      role: "participant";
      hostPeerId: string;
      transport: PeerDocumentTransport;
      commandId?: () => string;
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodeJson(value: unknown, maxBytes: number): { text: string; value: JsonValue } | null {
  try {
    const text = JSON.stringify(value);
    if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > maxBytes)
      return null;
    return { text, value: JSON.parse(text) as JsonValue };
  } catch {
    return null;
  }
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseCheckpoint(value: unknown): Checkpoint | null {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > MAX_SYNC_UPDATE_BYTES
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isPlainRecord(parsed) ||
      parsed.version !== PROTOCOL_VERSION ||
      typeof parsed.epoch !== "string" ||
      typeof parsed.hostPeerId !== "string" ||
      !isNonNegativeSafeInteger(parsed.baseRevision) ||
      !isNonNegativeSafeInteger(parsed.revision) ||
      parsed.baseRevision > parsed.revision ||
      typeof parsed.document !== "string"
    )
      return null;
    return parsed as Checkpoint;
  } catch {
    return null;
  }
}

function parseCommit(value: unknown, epoch: string): CommitRecord | null {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).byteLength > MAX_COMMAND_BYTES * 2
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isPlainRecord(parsed) ||
      parsed.version !== PROTOCOL_VERSION ||
      parsed.epoch !== epoch ||
      !isNonNegativeSafeInteger(parsed.revision) ||
      typeof parsed.commandId !== "string" ||
      parsed.commandId.length === 0 ||
      parsed.commandId.length > 128 ||
      typeof parsed.originPeerId !== "string" ||
      typeof parsed.now !== "string" ||
      !isPlainRecord(parsed.command) ||
      !Array.isArray(parsed.affectedIds) ||
      !parsed.affectedIds.every((id) => typeof id === "string")
    )
      return null;
    return parsed as CommitRecord;
  } catch {
    return null;
  }
}

function commandReferences(command: JsonValue): Set<string> {
  const references = new Set<string>();
  const visit = (value: JsonValue): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isPlainRecord(value)) return;
    if (value.type === "batch" && Array.isArray(value.commands)) {
      value.commands.forEach((child) => visit(child as JsonValue));
      return;
    }
    if (value.type === "node.add" || value.type === "node.update") {
      const node = value.node;
      if (isPlainRecord(node)) {
        if (typeof node.nodeId === "string") references.add(node.nodeId);
        if (
          isPlainRecord(node.catalogReference) &&
          typeof node.catalogReference.shapeId === "string"
        )
          references.add(node.catalogReference.shapeId);
        if (typeof node.styleId === "string") references.add(node.styleId);
      }
    }
    if (value.type === "connection.add" || value.type === "connection.update") {
      const connection = value.connection;
      if (isPlainRecord(connection)) {
        for (const id of [
          connection.connectionId,
          connection.sourceNodeId,
          connection.targetNodeId,
          connection.styleId,
        ])
          if (typeof id === "string") references.add(id);
      }
    }
  };
  visit(command);
  return references;
}

function sameIdSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const id of left) if (right.has(id)) return true;
  return false;
}

function safeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class PeerDocumentSession {
  private readonly role: "host" | "participant";
  private readonly hostPeerId: string;
  private readonly commandId: () => string;
  private readonly transport: PeerDocumentTransport;
  private readonly listeners = new Set<() => void>();
  private readonly documentListeners = new Set<(change: PeerDocumentChange) => void>();
  private readonly readyPeers = new Set<string>();
  private readonly commandResults = new Map<string, CommandReply>();
  private readonly rebaseHistory = new Map<number, ReadonlySet<string>>();
  private readonly unsubscribers: Array<() => void> = [];
  private commandQueue: Promise<void> = Promise.resolve();
  private pendingCommands = 0;
  private incomingUpdates: Promise<void> = Promise.resolve();
  private pendingUpdates: Uint8Array[] = [];
  private pendingUpdateBytes = 0;
  private syncing: Promise<void> | null = null;
  private started = false;
  private closed = false;
  private epoch: string | null = null;
  private sessionBaseRevision = 0;
  private modelState: ModelState | null = null;
  private doc = new Y.Doc();
  private status: PeerSessionStatus = "starting";
  private error: string | null = null;
  private snapshot: PeerDocumentSnapshot;

  constructor(options: PeerDocumentSessionOptions) {
    this.role = options.role;
    this.transport = options.transport;
    this.hostPeerId = options.role === "host" ? options.transport.peerId : options.hostPeerId;
    this.commandId = options.commandId ?? secureId;
    this.snapshot = {
      role: this.role,
      status: this.status,
      error: null,
      model: null,
      hostPeerId: this.hostPeerId,
      peerCount: this.transport.getPeerIds().length,
      readyPeerCount: 0,
      awareness: this.transport.getAwareness(),
    };
    if (options.role === "host") this.modelState = options.initialState;
  }

  getSnapshot = (): PeerDocumentSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onDocumentChange(listener: (change: PeerDocumentChange) => void): () => void {
    this.documentListeners.add(listener);
    return () => this.documentListeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      await this.transport.ready;
      this.attachTransport();
      if (this.role === "host") {
        this.initializeHostDocument(this.modelState as ModelState);
        this.setStatus("waiting", null);
        return;
      }
      this.setStatus("connecting", null);
      await this.waitForHost();
      await this.syncFromHost();
    } catch (error) {
      this.setStatus("error", safeError(error, "The peer session could not start."));
      throw error;
    }
  }

  async submitCommand(command: unknown, commandId = this.commandId()): Promise<CommandReply> {
    if (!this.modelState || this.closed || this.status === "closed")
      return this.reject("SESSION_NOT_READY", "The peer session is not ready.");
    const encoded = encodeJson(command, MAX_COMMAND_BYTES);
    if (!encoded || !isPlainRecord(encoded.value))
      return this.reject("INVALID_COMMAND", "The command payload is invalid or too large.");
    const proposal: CommandProposal = {
      commandId,
      baseRevision: this.modelState.revision,
      command: encoded.value,
    };
    if (this.role === "host") return this.enqueueProposal(proposal, this.transport.peerId);
    if (this.status !== "ready")
      return this.reject(
        "PEER_DISCONNECTED",
        "The host is not connected; the command was not applied.",
      );

    try {
      const reply = await this.transport.requestCommand(this.hostPeerId, proposal);
      if (reply.status === "rejected") {
        await this.syncFromHost();
        return reply;
      }
      if (reply.changed && reply.revision > (this.modelState?.revision ?? -1)) {
        try {
          await this.waitForRevision(reply.revision, 5000);
        } catch {
          await this.syncFromHost();
        }
      }
      return reply;
    } catch (error) {
      this.setStatus("disconnected", "The host did not acknowledge the command.");
      return this.reject(
        "ACK_TIMEOUT",
        safeError(error, "The host did not acknowledge the command."),
      );
    }
  }

  async setAwareness(state: PeerAwarenessState | null): Promise<void> {
    await this.transport.setAwareness(state);
    this.refreshSnapshot();
  }

  async retry(): Promise<void> {
    if (this.role !== "participant" || this.closed) return;
    await this.waitForHost();
    await this.syncFromHost();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.doc.destroy();
    await this.transport.close();
    this.setStatus("closed", null);
  }

  private attachTransport(): void {
    this.unsubscribers.push(
      this.transport.onPeerJoin((peerId) => {
        this.refreshSnapshot();
        if (
          this.role === "participant" &&
          peerId === this.hostPeerId &&
          this.status === "disconnected"
        )
          void this.syncFromHost().catch((error: unknown) =>
            this.setStatus("error", safeError(error, "Peer synchronization failed.")),
          );
      }, true),
      this.transport.onPeerLeave((peerId) => {
        this.readyPeers.delete(peerId);
        this.refreshSnapshot();
        if (this.role === "participant" && peerId === this.hostPeerId)
          this.setStatus(
            "disconnected",
            "The host disconnected; the current document remains in memory.",
          );
        else if (this.role === "host" && this.readyPeers.size === 0)
          this.setStatus("waiting", null);
      }),
      this.transport.onError((transportError) => {
        this.setStatus("error", transportError.message);
      }),
      this.transport.onAwarenessChange(() => this.refreshSnapshot()),
    );

    if (this.role === "host") {
      this.unsubscribers.push(
        this.transport.onSyncRequest(async () => this.serveSync()),
        this.transport.onSyncAcknowledgement((acknowledgement, peerId) =>
          this.acceptSyncAcknowledgement(acknowledgement, peerId),
        ),
        this.transport.onCommandRequest((proposal, peerId) =>
          this.enqueueProposal(proposal, peerId),
        ),
      );
      this.doc.on("update", (update, origin) => {
        if (origin !== COMMIT_ORIGIN || this.closed) return;
        void this.transport.broadcastYjsUpdate(update).catch((error: unknown) => {
          this.setStatus("error", safeError(error, "A peer update could not be sent."));
        });
      });
    } else {
      this.unsubscribers.push(
        this.transport.onYjsUpdate((update, peerId) => {
          if (peerId !== this.hostPeerId || this.closed) return;
          if (this.syncing || !this.modelState) {
            this.pendingUpdateBytes += update.byteLength;
            if (
              this.pendingUpdateBytes > MAX_PENDING_UPDATE_BYTES ||
              this.pendingUpdates.length >= 128
            ) {
              this.pendingUpdates = [];
              this.pendingUpdateBytes = 0;
              this.setStatus(
                "error",
                "Peer updates arrived too quickly while synchronizing. Retry the connection.",
              );
              return;
            }
            this.pendingUpdates.push(update);
            return;
          }
          this.incomingUpdates = this.incomingUpdates
            .then(() => this.applyHostUpdate(update))
            .catch((error: unknown) => {
              this.setStatus("error", safeError(error, "A peer update could not be validated."));
            });
        }),
      );
    }
    this.refreshSnapshot();
  }

  private initializeHostDocument(state: ModelState): void {
    const serialized = serializeDocument(state.document);
    if (!serialized.ok) throw new Error("The host document failed canonical validation.");
    const parsed = parseDocument(serialized.value);
    if (!parsed.ok) throw new Error("The host document failed canonical validation.");
    if (!isNonNegativeSafeInteger(state.revision)) throw new Error("The host revision is invalid.");
    this.modelState = { document: parsed.value.document, revision: state.revision };
    this.epoch = secureId();
    this.sessionBaseRevision = state.revision;
    this.doc.getMap<string>(ROOT_KEY).set("checkpoint", this.encodeCheckpoint(this.modelState));
    this.doc.getMap<string>(ROOT_KEY).set("latestRevision", String(this.modelState.revision));
    this.doc.getMap<string>(ROOT_KEY).set("hostPeerId", this.hostPeerId);
    this.refreshSnapshot();
  }

  private async waitForHost(): Promise<void> {
    if (this.transport.getPeerIds().includes(this.hostPeerId)) return;
    await new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("The host could not be reached through the configured signaling relays."));
      }, SYNC_TIMEOUT_MS);
      unsubscribe = this.transport.onPeerJoin((peerId) => {
        if (peerId !== this.hostPeerId) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }, true);
      if (this.transport.getPeerIds().includes(this.hostPeerId)) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  }

  private syncFromHost(): Promise<void> {
    if (this.role !== "participant" || this.closed) return Promise.resolve();
    if (this.syncing) return this.syncing;
    this.syncing = this.performSync().finally(() => {
      this.syncing = null;
      this.drainPendingUpdates();
    });
    return this.syncing;
  }

  private async performSync(): Promise<void> {
    this.setStatus("syncing", null);
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt++) {
      const update = await this.transport.requestSync(this.hostPeerId);
      if (!(update instanceof Uint8Array) || update.byteLength > MAX_SYNC_UPDATE_BYTES)
        throw new Error("The host returned an invalid or oversized synchronization update.");
      await this.incomingUpdates;
      this.installFullState(update);
      const state = this.modelState;
      const epoch = this.epoch;
      if (!state || !epoch) throw new Error("The host returned an incomplete session snapshot.");
      const acknowledgement = await this.transport.requestSyncAcknowledgement(this.hostPeerId, {
        epoch,
        revision: state.revision,
      });
      if (acknowledgement.ready && acknowledgement.revision === state.revision) {
        this.setStatus("ready", null);
        return;
      }
    }
    throw new Error("The host kept changing during initial synchronization. Retry the connection.");
  }

  private installFullState(update: Uint8Array): void {
    const candidate = new Y.Doc();
    try {
      Y.applyUpdate(candidate, update, REMOTE_ORIGIN);
      const result = this.readDocumentState(candidate, null, true);
      if (!result.complete) throw new Error("The host snapshot is missing accepted commands.");
      this.doc.destroy();
      this.doc = candidate;
      this.epoch = result.epoch;
      this.sessionBaseRevision = result.baseRevision;
      this.modelState = result.state;
      for (const change of result.events) this.emitDocumentChange(change);
      this.refreshSnapshot();
    } catch (error) {
      candidate.destroy();
      throw error;
    }
  }

  private async applyHostUpdate(update: Uint8Array): Promise<void> {
    if (update.byteLength > MAX_SYNC_UPDATE_BYTES)
      throw new Error("The host update exceeds the size limit.");
    try {
      Y.applyUpdate(this.doc, update, REMOTE_ORIGIN);
      const result = this.readDocumentState(this.doc, this.modelState, false);
      this.epoch = result.epoch;
      this.sessionBaseRevision = result.baseRevision;
      this.modelState = result.state;
      for (const change of result.events) this.emitDocumentChange(change);
      if (result.complete) {
        this.refreshSnapshot();
      } else {
        this.setStatus("syncing", null);
        void this.syncFromHost().catch((error: unknown) =>
          this.setStatus("error", safeError(error, "The peer session could not resynchronize.")),
        );
      }
    } catch (error) {
      this.setStatus("error", safeError(error, "The host update was rejected."));
      void this.syncFromHost().catch((syncError: unknown) =>
        this.setStatus("error", safeError(syncError, "The peer session could not resynchronize.")),
      );
    }
  }

  private drainPendingUpdates(): void {
    const pending = this.pendingUpdates;
    this.pendingUpdates = [];
    this.pendingUpdateBytes = 0;
    for (const update of pending) {
      this.incomingUpdates = this.incomingUpdates
        .then(() => this.applyHostUpdate(update))
        .catch((error: unknown) => {
          this.setStatus("error", safeError(error, "A peer update could not be validated."));
        });
    }
  }

  private readDocumentState(
    doc: Y.Doc,
    current: ModelState | null,
    resetFromCheckpoint: boolean,
  ): ParsedCommitState {
    const root = doc.getMap<string>(ROOT_KEY);
    const checkpoint = parseCheckpoint(root.get("checkpoint"));
    if (!checkpoint || checkpoint.hostPeerId !== this.hostPeerId)
      throw new Error("The peer update does not contain a valid host checkpoint.");
    const parsedSnapshot = parseDocument(checkpoint.document);
    if (!parsedSnapshot.ok) throw new Error("The host checkpoint failed document validation.");

    const shouldReset =
      resetFromCheckpoint ||
      !current ||
      this.epoch !== checkpoint.epoch ||
      checkpoint.revision > current.revision;
    let state: ModelState = shouldReset
      ? { document: parsedSnapshot.value.document, revision: checkpoint.revision }
      : current;
    const events: PeerDocumentChange[] = [];
    if (shouldReset) {
      events.push({
        state,
        command: null,
        originPeerId: null,
        checkpoint: true,
        historyReset: true,
      });
    }

    const records = doc
      .getArray<string>(COMMIT_LOG_KEY)
      .toArray()
      .map((record) => parseCommit(record, checkpoint.epoch))
      .sort((left, right) => (left?.revision ?? -1) - (right?.revision ?? -1));
    if (records.some((record) => record === null))
      throw new Error("The host commit log contains an invalid record.");

    for (const record of records as CommitRecord[]) {
      if (record.revision <= state.revision) continue;
      if (record.revision !== state.revision + 1) break;
      const result = executeCommand(state, record.command, {
        expectedRevision: state.revision,
        now: record.now,
      });
      if (!result.ok || !result.value.changed || result.value.state.revision !== record.revision)
        throw new Error("A host commit failed canonical command validation.");
      state = result.value.state;
      events.push({
        state,
        command: record.command,
        originPeerId: record.originPeerId,
        checkpoint: false,
        historyReset: false,
      });
    }

    const latestRevision = Number(root.get("latestRevision"));
    if (!isNonNegativeSafeInteger(latestRevision) || latestRevision < checkpoint.revision)
      throw new Error("The host session revision is invalid.");
    return {
      state,
      epoch: checkpoint.epoch,
      baseRevision: checkpoint.baseRevision,
      complete: state.revision === latestRevision,
      events,
    };
  }

  private async acceptSyncAcknowledgement(
    acknowledgement: SyncAcknowledgement,
    peerId: string,
  ): Promise<SyncAcknowledgementReply> {
    const revision = this.modelState?.revision ?? 0;
    if (
      !isPlainRecord(acknowledgement) ||
      acknowledgement.epoch !== this.epoch ||
      acknowledgement.revision !== revision ||
      !this.transport.getPeerIds().includes(peerId)
    )
      return { ready: false, revision };
    this.readyPeers.add(peerId);
    this.setStatus("ready", null);
    return { ready: true, revision };
  }

  private async serveSync(): Promise<Uint8Array> {
    if (this.role !== "host" || !this.modelState) throw new Error("The host session is not ready.");
    return Y.encodeStateAsUpdate(this.doc);
  }

  private enqueueProposal(proposal: unknown, peerId: string): Promise<CommandReply> {
    if (this.pendingCommands >= MAX_PENDING_COMMANDS)
      return Promise.resolve(
        this.reject("SESSION_BUSY", "The host is processing too many commands."),
      );
    const encoded = encodeJson(proposal, MAX_PROPOSAL_BYTES);
    if (
      !encoded ||
      !isPlainRecord(encoded.value) ||
      Object.keys(encoded.value).length !== 3 ||
      typeof encoded.value.commandId !== "string" ||
      encoded.value.commandId.length === 0 ||
      encoded.value.commandId.length > 128 ||
      !isNonNegativeSafeInteger(encoded.value.baseRevision)
    )
      return Promise.resolve(
        this.reject("INVALID_PROPOSAL", "The command proposal is invalid or too large."),
      );
    const command = encodeJson(encoded.value.command, MAX_COMMAND_BYTES);
    if (!command || !isPlainRecord(command.value))
      return Promise.resolve(
        this.reject("INVALID_COMMAND", "The command payload is invalid or too large."),
      );
    const queuedProposal: CommandProposal = {
      commandId: encoded.value.commandId,
      baseRevision: encoded.value.baseRevision,
      command: command.value,
    };
    this.pendingCommands++;
    const result = this.commandQueue.then(() => this.acceptProposal(queuedProposal, peerId));
    this.commandQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.pendingCommands--;
    });
  }

  private async acceptProposal(
    proposal: CommandProposal,
    originPeerId: string,
  ): Promise<CommandReply> {
    if (this.role !== "host" || !this.modelState || !this.epoch)
      return this.reject("HOST_NOT_READY", "The host session is not ready.");
    if (originPeerId !== this.transport.peerId && !this.readyPeers.has(originPeerId))
      return this.reject("PEER_NOT_READY", "The peer has not completed initial synchronization.");
    if (
      !isPlainRecord(proposal) ||
      typeof proposal.commandId !== "string" ||
      proposal.commandId.length === 0 ||
      proposal.commandId.length > 128 ||
      !isNonNegativeSafeInteger(proposal.baseRevision)
    )
      return this.reject("INVALID_PROPOSAL", "The command proposal is invalid.");

    const proposalKey = `${originPeerId}:${proposal.commandId}`;
    const cached = this.commandResults.get(proposalKey);
    if (cached) return cached;
    const encoded = encodeJson(proposal.command, MAX_COMMAND_BYTES);
    if (!encoded || !isPlainRecord(encoded.value))
      return this.reject("INVALID_COMMAND", "The command payload is invalid or too large.");
    if (proposal.baseRevision > this.modelState.revision)
      return this.cacheResult(
        proposalKey,
        this.reject("REVISION_CONFLICT", "The proposal is based on a newer session revision."),
      );
    if (proposal.baseRevision < this.sessionBaseRevision)
      return this.cacheResult(
        proposalKey,
        this.reject(
          "STALE_PROPOSAL",
          "The proposal predates this session. Synchronize and retry it.",
        ),
      );
    if (this.modelState.revision - proposal.baseRevision > MAX_REBASE_REVISIONS)
      return this.cacheResult(
        proposalKey,
        this.reject("STALE_PROPOSAL", "The proposal is too old; synchronize and retry it."),
      );

    const now = new Date().toISOString();
    const result = executeCommand(this.modelState, encoded.value, {
      expectedRevision: this.modelState.revision,
      now,
    });
    if (!result.ok) {
      return this.cacheResult(proposalKey, {
        status: "rejected",
        revision: this.modelState.revision,
        code: result.errors[0]?.code ?? "INVALID_COMMAND",
        message: result.errors.map((error) => error.message).join(" "),
      });
    }
    if (!result.value.changed)
      return this.cacheResult(proposalKey, {
        status: "accepted",
        revision: this.modelState.revision,
        changed: false,
      });

    const affectedIds = new Set([...result.value.affectedIds, ...commandReferences(encoded.value)]);
    if (proposal.baseRevision < this.modelState.revision) {
      for (const [revision, interveningIds] of this.rebaseHistory) {
        if (revision > proposal.baseRevision && sameIdSet(affectedIds, interveningIds))
          return this.cacheResult(proposalKey, {
            status: "rejected",
            revision: this.modelState.revision,
            code: "REVISION_CONFLICT",
            message: "A newer command changed the same document elements. Synchronize and retry.",
          });
      }
    }

    const commit: CommitRecord = {
      version: PROTOCOL_VERSION,
      epoch: this.epoch as string,
      revision: result.value.state.revision,
      commandId: proposal.commandId,
      originPeerId,
      now,
      command: encoded.value,
      affectedIds: [...affectedIds].sort(),
    };
    const encodedCommit = JSON.stringify(commit);
    const commitBytes = new TextEncoder().encode(encodedCommit).byteLength;
    const log = this.doc.getArray<string>(COMMIT_LOG_KEY);
    const logBytes = log
      .toArray()
      .reduce((total, item) => total + new TextEncoder().encode(item).byteLength, 0);
    if (log.length >= MAX_COMMIT_LOG_ENTRIES || logBytes + commitBytes > MAX_COMMIT_LOG_BYTES)
      this.writeCheckpoint(this.modelState);

    this.modelState = result.value.state;
    this.rebaseHistory.set(this.modelState.revision, affectedIds);
    while (this.rebaseHistory.size > MAX_REBASE_REVISIONS) {
      const oldestRevision = this.rebaseHistory.keys().next().value;
      if (oldestRevision === undefined) break;
      this.rebaseHistory.delete(oldestRevision);
    }
    this.doc.transact(() => {
      log.push([encodedCommit]);
      this.doc.getMap<string>(ROOT_KEY).set("latestRevision", String(this.modelState?.revision));
    }, COMMIT_ORIGIN);
    const reply = this.cacheResult(proposalKey, {
      status: "accepted",
      revision: this.modelState.revision,
      changed: true,
    });
    this.emitDocumentChange({
      state: this.modelState,
      command: encoded.value,
      originPeerId,
      checkpoint: false,
      historyReset: false,
    });
    this.refreshSnapshot();
    return reply;
  }

  private writeCheckpoint(state: ModelState): void {
    const serialized = serializeDocument(state.document);
    if (!serialized.ok) throw new Error("The host document failed canonical serialization.");
    const checkpoint: Checkpoint = {
      version: PROTOCOL_VERSION,
      epoch: this.epoch as string,
      hostPeerId: this.hostPeerId,
      baseRevision: this.sessionBaseRevision,
      revision: state.revision,
      document: serialized.value,
    };
    const log = this.doc.getArray<string>(COMMIT_LOG_KEY);
    this.doc.transact(() => {
      this.doc.getMap<string>(ROOT_KEY).set("checkpoint", JSON.stringify(checkpoint));
      log.delete(0, log.length);
    }, COMMIT_ORIGIN);
  }

  private encodeCheckpoint(state: ModelState): string {
    const serialized = serializeDocument(state.document);
    if (!serialized.ok) throw new Error("The host document failed canonical serialization.");
    if (!this.epoch) throw new Error("The host session epoch is unavailable.");
    return JSON.stringify({
      version: PROTOCOL_VERSION,
      epoch: this.epoch,
      hostPeerId: this.hostPeerId,
      baseRevision: this.sessionBaseRevision,
      revision: state.revision,
      document: serialized.value,
    } satisfies Checkpoint);
  }

  private async waitForRevision(revision: number, timeoutMs: number): Promise<void> {
    if ((this.modelState?.revision ?? -1) >= revision) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("The host accepted the command but the update did not arrive in time."));
      }, timeoutMs);
      const unsubscribe = this.subscribe(() => {
        if ((this.modelState?.revision ?? -1) < revision) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });
  }

  private cacheResult(key: string, reply: CommandReply): CommandReply {
    this.commandResults.set(key, reply);
    if (this.commandResults.size > 512) {
      const oldest = this.commandResults.keys().next().value;
      if (oldest !== undefined) this.commandResults.delete(oldest);
    }
    return reply;
  }

  private reject(code: string, message: string): CommandReply {
    return {
      status: "rejected",
      revision: this.modelState?.revision ?? 0,
      code,
      message,
    };
  }

  private setStatus(status: PeerSessionStatus, error: string | null): void {
    this.status = status;
    this.error = error;
    this.refreshSnapshot();
  }

  private refreshSnapshot(): void {
    this.snapshot = {
      role: this.role,
      status: this.status,
      error: this.error,
      model: this.modelState,
      hostPeerId: this.hostPeerId,
      peerCount: this.transport.getPeerIds().length,
      readyPeerCount: this.readyPeers.size,
      awareness: this.transport.getAwareness(),
    };
    this.listeners.forEach((listener) => listener());
  }

  private emitDocumentChange(change: PeerDocumentChange): void {
    this.documentListeners.forEach((listener) => listener(change));
  }
}
