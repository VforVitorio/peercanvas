import { joinRoom as joinMqttRoom, selfId } from "@trystero-p2p/mqtt";
import type {
  JoinError,
  JoinRoomCallbacks,
  JoinRoomConfig,
  Room,
  TurnServerConfig,
} from "@trystero-p2p/mqtt";
import {
  MAX_SYNC_UPDATE_BYTES,
  type CommandProposal,
  type CommandReply,
  type PeerAwarenessState,
  type PeerDocumentTransport,
  type PeerTransportError,
  type SyncAcknowledgement,
  type SyncAcknowledgementReply,
} from "./types";

export const PEERCANVAS_TRYSTERO_APP_ID = "furancho-labs/peer2canvas";
export const PEERCANVAS_SIGNAL_RELAYS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
] as const;

const SYNC_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 10_000;

export type RoomFactory = (
  config: JoinRoomConfig,
  roomId: string,
  callbacks?: JoinRoomCallbacks,
) => Room;

export type TrysteroPeerTransportOptions = {
  roomId: string;
  password: string;
  peerId?: string;
  relayUrls?: readonly string[];
  turnConfig?: TurnServerConfig[];
  rtcConfig?: RTCConfiguration;
  joinRoom?: RoomFactory;
};

type AwarenessEnvelope = { state: PeerAwarenessState | null };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isPeerAwarenessState(value: unknown): value is PeerAwarenessState {
  if (!isPlainRecord(value)) return false;
  if (
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, "cursor") ||
    !Object.prototype.hasOwnProperty.call(value, "selectionId")
  )
    return false;

  const cursor = value.cursor;
  const selectionId = value.selectionId;
  if (selectionId !== null && (typeof selectionId !== "string" || selectionId.length > 128))
    return false;
  if (cursor === null) return true;
  return (
    isPlainRecord(cursor) &&
    Object.keys(cursor).length === 2 &&
    typeof cursor.x === "number" &&
    typeof cursor.y === "number" &&
    Number.isFinite(cursor.x) &&
    Number.isFinite(cursor.y) &&
    Math.abs(cursor.x) <= 1_000_000 &&
    Math.abs(cursor.y) <= 1_000_000
  );
}

function safeJoinError(error: JoinError): PeerTransportError {
  const failedAfterSignaling = error.error.includes("after exchanging SDP");
  return failedAfterSignaling
    ? {
        code: "peer-ice-failed",
        message: "Signaling succeeded, but the peers could not establish a WebRTC connection.",
      }
    : { code: "peer-connect-failed", message: "The peer network path could not connect." };
}

function isCommandReply(value: unknown): value is CommandReply {
  if (!isPlainRecord(value) || !isNonNegativeSafeInteger(value.revision)) return false;
  if (
    value.status === "accepted" &&
    Object.keys(value).length === 3 &&
    typeof value.changed === "boolean"
  )
    return true;
  return (
    value.status === "rejected" &&
    Object.keys(value).length === 4 &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    value.code.length <= 128 &&
    typeof value.message === "string" &&
    value.message.length <= 512
  );
}

function isSyncAcknowledgement(value: unknown): value is SyncAcknowledgement {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.epoch === "string" &&
    value.epoch.length > 0 &&
    value.epoch.length <= 128 &&
    isNonNegativeSafeInteger(value.revision)
  );
}

function isSyncAcknowledgementReply(value: unknown): value is SyncAcknowledgementReply {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.ready === "boolean" &&
    isNonNegativeSafeInteger(value.revision)
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export async function createTrysteroPeerTransport(
  options: TrysteroPeerTransportOptions,
): Promise<PeerDocumentTransport> {
  if (options.roomId.trim().length === 0) throw new Error("A peer room identifier is required.");
  if (new TextEncoder().encode(options.password).byteLength < 32)
    throw new Error("A session secret of at least 32 UTF-8 bytes is required.");
  const localPeerId = options.peerId ?? selfId;
  if (localPeerId.trim().length === 0) throw new Error("A peer identity is required.");

  const updateListeners = new Set<(update: Uint8Array, peerId: string) => void>();
  const peerJoinListeners = new Set<(peerId: string) => void>();
  const peerLeaveListeners = new Set<(peerId: string) => void>();
  const errorListeners = new Set<(error: PeerTransportError) => void>();
  const awarenessListeners = new Set<() => void>();
  const awareness = new Map<string, PeerAwarenessState>();
  const pendingErrors: PeerTransportError[] = [];
  const connectedPeers = new Set<string>();
  let syncRequestHandler: ((peerId: string) => Promise<Uint8Array>) | null = null;
  let syncAcknowledgementHandler:
    | ((acknowledgement: SyncAcknowledgement, peerId: string) => Promise<SyncAcknowledgementReply>)
    | null = null;
  let commandRequestHandler:
    ((proposal: CommandProposal, peerId: string) => Promise<CommandReply>) | null = null;
  let localAwareness: PeerAwarenessState | null = null;
  let closed = false;

  const reportJoinError = (error: JoinError) => {
    if (closed) return;
    const safe = safeJoinError(error);
    if (errorListeners.size === 0) {
      if (pendingErrors.length < 8) pendingErrors.push(safe);
    } else {
      for (const listener of errorListeners) listener(safe);
    }
  };
  let room: Room;
  try {
    room = (options.joinRoom ?? joinMqttRoom)(
      {
        appId: PEERCANVAS_TRYSTERO_APP_ID,
        password: options.password,
        maxReceiveBytes: MAX_SYNC_UPDATE_BYTES,
        relayConfig: {
          urls: [...(options.relayUrls ?? PEERCANVAS_SIGNAL_RELAYS)],
          warnOnRelayFailure: false,
        },
        ...(options.turnConfig ? { turnConfig: options.turnConfig } : {}),
        ...(options.rtcConfig ? { rtcConfig: options.rtcConfig } : {}),
      },
      options.roomId,
      { onJoinError: reportJoinError },
    );
  } catch {
    throw new Error("The peer room could not be created.");
  }

  const peerId = localPeerId;
  const updateAction = room.makeAction<Uint8Array>("pc-yjs-update");
  const syncAction = room.makeAction<null, Uint8Array>("pc-yjs-sync", { kind: "request" });
  const syncAckAction = room.makeAction<SyncAcknowledgement, SyncAcknowledgementReply>(
    "pc-yjs-sync-ack",
    { kind: "request" },
  );
  const commandAction = room.makeAction<CommandProposal, CommandReply>("pc-command", {
    kind: "request",
  });
  const awarenessAction = room.makeAction<AwarenessEnvelope>("pc-awareness");

  updateAction.onMessage = (update, context) => {
    if (update instanceof Uint8Array && update.byteLength <= MAX_SYNC_UPDATE_BYTES)
      for (const listener of updateListeners) listener(update, context.peerId);
  };
  syncAction.onRequest = (_request, context) =>
    syncRequestHandler?.(context.peerId) ?? new Uint8Array();
  syncAckAction.onRequest = (acknowledgement, context) => {
    if (!isSyncAcknowledgement(acknowledgement)) return { ready: false, revision: 0 };
    return (
      syncAcknowledgementHandler?.(acknowledgement, context.peerId) ?? {
        ready: false,
        revision: 0,
      }
    );
  };
  commandAction.onRequest = (proposal, context) =>
    commandRequestHandler?.(proposal, context.peerId) ?? {
      status: "rejected",
      revision: 0,
      code: "HOST_NOT_READY",
      message: "The host session is not ready.",
    };
  awarenessAction.onMessage = (message, context) => {
    if (!isPlainRecord(message) || Object.keys(message).length !== 1) return;
    if (message.state === null) awareness.delete(context.peerId);
    else if (isPeerAwarenessState(message.state)) awareness.set(context.peerId, message.state);
    else return;
    for (const listener of awarenessListeners) listener();
  };

  room.onPeerJoin = (remotePeerId) => {
    connectedPeers.add(remotePeerId);
    for (const listener of peerJoinListeners) listener(remotePeerId);
    if (localAwareness !== null)
      void awarenessAction
        .send({ state: localAwareness }, { target: remotePeerId })
        .catch(() => {});
  };
  room.onPeerLeave = (remotePeerId) => {
    connectedPeers.delete(remotePeerId);
    awareness.delete(remotePeerId);
    for (const listener of peerLeaveListeners) listener(remotePeerId);
    for (const listener of awarenessListeners) listener();
  };
  for (const remotePeerId of Object.keys(room.getPeers())) connectedPeers.add(remotePeerId);

  const transport: PeerDocumentTransport = {
    peerId,
    ready: Promise.resolve(),
    getPeerIds: () => [...connectedPeers],
    getNetworkDiagnostics: async () =>
      Promise.all(
        Object.entries(room.getPeers()).map(async ([remotePeerId, connection]) => {
          let localCandidateType: string | null = null;
          let remoteCandidateType: string | null = null;
          try {
            const stats = await connection.getStats();
            for (const value of stats.values()) {
              if (value.type !== "candidate-pair") continue;
              const pair = value as RTCStats & {
                state?: string;
                nominated?: boolean;
                localCandidateId?: string;
                remoteCandidateId?: string;
              };
              if (pair.state !== "succeeded") continue;
              const local = stats.get(pair.localCandidateId ?? "") as
                { candidateType?: string } | undefined;
              const remote = stats.get(pair.remoteCandidateId ?? "") as
                { candidateType?: string } | undefined;
              localCandidateType = local?.candidateType ?? null;
              remoteCandidateType = remote?.candidateType ?? null;
              if (pair.nominated) break;
            }
          } catch {
            // Some WebViews do not expose selected ICE candidate details.
          }
          const candidatesKnown = localCandidateType !== null && remoteCandidateType !== null;
          const relayPath = localCandidateType === "relay" || remoteCandidateType === "relay";
          return {
            peerId: remotePeerId,
            direct: candidatesKnown ? !relayPath : null,
            hops: candidatesKnown ? (relayPath ? 2 : 1) : null,
            connectionState: connection.connectionState,
            iceConnectionState: connection.iceConnectionState,
            localCandidateType,
            remoteCandidateType,
          };
        }),
      ),
    onPeerJoin: (handler, replay = false) => {
      peerJoinListeners.add(handler);
      if (replay) for (const remotePeerId of Object.keys(room.getPeers())) handler(remotePeerId);
      return () => peerJoinListeners.delete(handler);
    },
    onPeerLeave: (handler) => {
      peerLeaveListeners.add(handler);
      return () => peerLeaveListeners.delete(handler);
    },
    onError: (handler) => {
      errorListeners.add(handler);
      for (const error of pendingErrors.splice(0)) handler(error);
      return () => errorListeners.delete(handler);
    },
    onYjsUpdate: (handler) => {
      updateListeners.add(handler);
      return () => updateListeners.delete(handler);
    },
    broadcastYjsUpdate: async (update) => {
      if (closed) throw new Error("Peer transport is closed.");
      if (!(update instanceof Uint8Array) || update.byteLength > MAX_SYNC_UPDATE_BYTES)
        throw new Error("Yjs update exceeds the session size limit.");
      try {
        await updateAction.send(update);
      } catch {
        throw new Error("The Yjs update could not be sent to peers.");
      }
    },
    onSyncRequest: (handler) => {
      syncRequestHandler = handler;
      return () => {
        if (syncRequestHandler === handler) syncRequestHandler = null;
      };
    },
    requestSync: async (targetPeerId) => {
      try {
        const update = await syncAction.request(null, {
          target: targetPeerId,
          timeoutMs: SYNC_TIMEOUT_MS,
        });
        if (!(update instanceof Uint8Array) || update.byteLength > MAX_SYNC_UPDATE_BYTES)
          throw new Error("invalid update");
        return update;
      } catch {
        throw new Error("The host did not provide a complete synchronization update.");
      }
    },
    onSyncAcknowledgement: (handler) => {
      syncAcknowledgementHandler = handler;
      return () => {
        if (syncAcknowledgementHandler === handler) syncAcknowledgementHandler = null;
      };
    },
    requestSyncAcknowledgement: async (targetPeerId, acknowledgement) => {
      try {
        const response = await syncAckAction.request(acknowledgement, {
          target: targetPeerId,
          timeoutMs: SYNC_TIMEOUT_MS,
        });
        if (!isSyncAcknowledgementReply(response)) throw new Error("invalid response");
        return response;
      } catch {
        throw new Error("The host did not acknowledge initial synchronization.");
      }
    },
    onCommandRequest: (handler) => {
      commandRequestHandler = handler;
      return () => {
        if (commandRequestHandler === handler) commandRequestHandler = null;
      };
    },
    requestCommand: async (targetPeerId, proposal) => {
      try {
        const reply = await commandAction.request(proposal, {
          target: targetPeerId,
          timeoutMs: COMMAND_TIMEOUT_MS,
        });
        if (!isCommandReply(reply)) throw new Error("invalid reply");
        return reply;
      } catch {
        throw new Error("The host did not acknowledge the command.");
      }
    },
    getAwareness: () => Object.fromEntries(awareness),
    onAwarenessChange: (handler) => {
      awarenessListeners.add(handler);
      return () => awarenessListeners.delete(handler);
    },
    setAwareness: async (state) => {
      if (closed) throw new Error("Peer transport is closed.");
      if (state !== null && !isPeerAwarenessState(state))
        throw new Error("Peer awareness state is invalid.");
      if (state === null) awareness.delete(peerId);
      else awareness.set(peerId, state);
      localAwareness = state;
      for (const listener of awarenessListeners) listener();
      try {
        await awarenessAction.send({ state });
      } catch {
        throw new Error("Peer awareness could not be sent.");
      }
    },
    close: async () => {
      if (closed) return;
      if (localAwareness !== null) await awarenessAction.send({ state: null }).catch(() => {});
      closed = true;
      room.onPeerJoin = null;
      room.onPeerLeave = null;
      updateAction.onMessage = null;
      syncAction.onRequest = null;
      syncAckAction.onRequest = null;
      commandAction.onRequest = null;
      awarenessAction.onMessage = null;
      try {
        await room.leave();
      } finally {
        peerJoinListeners.clear();
        peerLeaveListeners.clear();
        updateListeners.clear();
        awarenessListeners.clear();
        errorListeners.clear();
        pendingErrors.length = 0;
        connectedPeers.clear();
        awareness.clear();
      }
    },
  };

  return transport;
}
