import type { JsonValue } from "@trystero-p2p/mqtt";
import type { ModelState } from "../document";

export type Unsubscribe = () => void;

export const MAX_SYNC_UPDATE_BYTES = 16 * 1024 * 1024;

export type PeerAwarenessState = {
  cursor: { x: number; y: number } | null;
  selectionId: string | null;
};

export type PeerSessionStatus =
  "starting" | "waiting" | "connecting" | "syncing" | "ready" | "disconnected" | "error" | "closed";

export type CommandProposal = {
  commandId: string;
  baseRevision: number;
  command: JsonValue;
};

export type CommandReply =
  | { status: "accepted"; revision: number; changed: boolean }
  | { status: "rejected"; revision: number; code: string; message: string };

export type SyncAcknowledgement = {
  epoch: string;
  revision: number;
};

export type SyncAcknowledgementReply = {
  ready: boolean;
  revision: number;
};

export type PeerTransportError = {
  code: string;
  message: string;
};

export type PeerNetworkDiagnostic = {
  peerId: string;
  direct: boolean | null;
  hops: number | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  localCandidateType: string | null;
  remoteCandidateType: string | null;
};

export interface PeerDocumentTransport {
  readonly peerId: string;
  readonly ready: Promise<void>;
  getPeerIds(): string[];
  getNetworkDiagnostics(): Promise<PeerNetworkDiagnostic[]>;
  onPeerJoin(handler: (peerId: string) => void, replay?: boolean): Unsubscribe;
  onPeerLeave(handler: (peerId: string) => void): Unsubscribe;
  onError(handler: (error: PeerTransportError) => void): Unsubscribe;
  onYjsUpdate(handler: (update: Uint8Array, peerId: string) => void): Unsubscribe;
  broadcastYjsUpdate(update: Uint8Array): Promise<void>;
  onSyncRequest(handler: (peerId: string) => Promise<Uint8Array>): Unsubscribe;
  requestSync(peerId: string): Promise<Uint8Array>;
  onSyncAcknowledgement(
    handler: (
      acknowledgement: SyncAcknowledgement,
      peerId: string,
    ) => Promise<SyncAcknowledgementReply>,
  ): Unsubscribe;
  requestSyncAcknowledgement(
    peerId: string,
    acknowledgement: SyncAcknowledgement,
  ): Promise<SyncAcknowledgementReply>;
  onCommandRequest(
    handler: (proposal: CommandProposal, peerId: string) => Promise<CommandReply>,
  ): Unsubscribe;
  requestCommand(peerId: string, proposal: CommandProposal): Promise<CommandReply>;
  getAwareness(): Readonly<Record<string, PeerAwarenessState | null>>;
  onAwarenessChange(handler: () => void): Unsubscribe;
  setAwareness(state: PeerAwarenessState | null): Promise<void>;
  close(): Promise<void>;
}

export type PeerDocumentSnapshot = {
  role: "host" | "participant";
  status: PeerSessionStatus;
  error: string | null;
  model: ModelState | null;
  hostPeerId: string;
  peerCount: number;
  readyPeerCount: number;
  awareness: Readonly<Record<string, PeerAwarenessState | null>>;
};

export type PeerDocumentChange = {
  state: ModelState;
  command: JsonValue | null;
  originPeerId: string | null;
  checkpoint: boolean;
  historyReset: boolean;
};
