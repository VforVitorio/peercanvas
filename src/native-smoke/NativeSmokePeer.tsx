// SPDX-License-Identifier: Apache-2.0
// Test-only peer iframe inside the same native WebView as the smoke host.

import { useCallback, useEffect, useRef, useState } from "react";
import { getRelaySockets as getMqttRelaySockets } from "@trystero-p2p/mqtt";
import {
  getRelaySockets as getWebSocketRelaySockets,
  joinRoom as joinWebSocketRelay,
  selfId as webSocketRelaySelfId,
} from "@trystero-p2p/ws-relay";
import { createTrysteroPeerTransport } from "../collaboration/trystero-peer-transport";
import { PeerDocumentSession } from "../collaboration/peer-document-session";
import { serializeDocument } from "../document";
import { installNativeIceDiagnostics, readNativeIceDiagnostics } from "./ice-diagnostics";
import type {
  CommandReply,
  PeerNetworkDiagnostic,
  PeerTransportError,
} from "../collaboration/types";
import type { RoomFactory } from "../collaboration/trystero-peer-transport";

export type NativePeerConnectionOptions = {
  roomId: string;
  password: string;
  relayUrl: string;
  hostPeerId: string;
  rtcConfig?: RTCConfiguration;
};

export type NativePeerSnapshot = {
  status: string;
  revision: number | null;
  document: string | null;
  error: string | null;
};

export type NativePeerApi = {
  connect(options: NativePeerConnectionOptions): Promise<NativePeerSnapshot>;
  snapshot(): NativePeerSnapshot;
  debug(): Promise<NativePeerDebug>;
  submit(command: unknown): Promise<CommandReply>;
  diagnostics(): Promise<PeerNetworkDiagnostic[]>;
  close(): Promise<void>;
};

export type NativePeerDebug = {
  status: string;
  error: string | null;
  identityMatchesHost: boolean;
  transportPeerCount: number;
  network: Array<Omit<PeerNetworkDiagnostic, "peerId">>;
  errors: PeerTransportError[];
  signalingSockets: Array<{ readyState: number; protocol: string }>;
};

declare global {
  interface Window {
    __PEERCANVAS_NATIVE_PEER__?: NativePeerApi;
  }
}

export default function NativeSmokePeer() {
  const [status, setStatus] = useState("Waiting for local smoke harness.");
  const statusRef = useRef(status);
  const session = useRef<PeerDocumentSession | null>(null);
  const transport = useRef<Awaited<ReturnType<typeof createTrysteroPeerTransport>> | null>(null);
  const transportErrors = useRef<PeerTransportError[]>([]);
  const isPublicRelay = useRef(false);
  const identityMatchesHost = useRef(false);
  const updateStatus = useCallback((value: string) => {
    statusRef.current = value;
    setStatus(value);
  }, []);

  useEffect(() => {
    const api: NativePeerApi = {
      connect: async (options) => {
        await session.current?.close();
        installNativeIceDiagnostics();
        isPublicRelay.current = options.relayUrl === "public";
        updateStatus(
          options.relayUrl === "public"
            ? "Connecting to the host through public signaling brokers."
            : "Connecting to the host through the loopback relay.",
        );
        const localRelayOptions =
          options.relayUrl === "public"
            ? {}
            : {
                peerId: webSocketRelaySelfId,
                relayUrls: [options.relayUrl],
                joinRoom: joinWebSocketRelay as unknown as RoomFactory,
              };
        const nextTransport = await createTrysteroPeerTransport({
          roomId: options.roomId,
          password: options.password,
          ...localRelayOptions,
          ...(options.rtcConfig ? { rtcConfig: options.rtcConfig } : {}),
        });
        identityMatchesHost.current = nextTransport.peerId === options.hostPeerId;
        const nextSession = new PeerDocumentSession({
          role: "participant",
          hostPeerId: options.hostPeerId,
          transport: nextTransport,
        });
        transport.current = nextTransport;
        transportErrors.current = [];
        nextTransport.onError((error) => transportErrors.current.push(error));
        session.current = nextSession;
        try {
          await nextSession.start();
          updateStatus("Peer document is synchronized.");
        } catch (error) {
          updateStatus(error instanceof Error ? error.message : "Peer synchronization failed.");
          throw error;
        }
        return readSnapshot(nextSession);
      },
      snapshot: () =>
        session.current
          ? readSnapshot(session.current)
          : { status: statusRef.current, revision: null, document: null, error: null },
      debug: async () => {
        const snapshot = session.current?.getSnapshot();
        const diagnostics = transport.current
          ? await transport.current.getNetworkDiagnostics()
          : [];
        return {
          status: snapshot?.status ?? statusRef.current,
          error: snapshot?.error ?? null,
          identityMatchesHost: identityMatchesHost.current,
          transportPeerCount: transport.current?.getPeerIds().length ?? 0,
          network: diagnostics.map((diagnostic) => ({
            direct: diagnostic.direct,
            hops: diagnostic.hops,
            connectionState: diagnostic.connectionState,
            iceConnectionState: diagnostic.iceConnectionState,
            localCandidateType: diagnostic.localCandidateType,
            remoteCandidateType: diagnostic.remoteCandidateType,
          })),
          errors: [...transportErrors.current],
          ice: readNativeIceDiagnostics(),
          signalingSockets: Object.values(
            (isPublicRelay.current ? getMqttRelaySockets() : getWebSocketRelaySockets()) as Record<
              string,
              WebSocket
            >,
          ).map((socket) => ({ readyState: socket.readyState, protocol: socket.protocol })),
        };
      },
      submit: async (command) => {
        if (!session.current) throw new Error("The peer smoke session has not started.");
        return session.current.submitCommand(command);
      },
      diagnostics: () =>
        transport.current ? transport.current.getNetworkDiagnostics() : Promise.resolve([]),
      close: async () => {
        await session.current?.close();
        session.current = null;
        transport.current = null;
        updateStatus("Peer smoke session closed.");
      },
    };

    window.__PEERCANVAS_NATIVE_PEER__ = api;
    return () => {
      delete window.__PEERCANVAS_NATIVE_PEER__;
      void session.current?.close();
    };
  }, [updateStatus]);

  return (
    <main>
      <p role="status">{status}</p>
    </main>
  );
}

function readSnapshot(session: PeerDocumentSession): NativePeerSnapshot {
  const snapshot = session.getSnapshot();
  const serialized = snapshot.model ? serializeDocument(snapshot.model.document) : null;
  return {
    status: snapshot.status,
    revision: snapshot.model?.revision ?? null,
    document: serialized?.ok ? serialized.value : null,
    error: snapshot.error,
  };
}
