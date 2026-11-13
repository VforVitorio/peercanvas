import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JoinRoomCallbacks, JoinRoomConfig, Room } from "@trystero-p2p/mqtt";
import {
  createTrysteroPeerTransport,
  isPeerAwarenessState,
  type RoomFactory,
} from "./trystero-peer-transport";

type FakeAction = {
  onMessage: ((data: unknown, context: { peerId: string }) => void | Promise<void>) | null;
  onRequest: ((data: unknown, context: { peerId: string }) => unknown) | null;
  send: (data: unknown, options?: { target?: string }) => Promise<void>;
  request: (data: unknown, options: { target: string; timeoutMs?: number }) => Promise<unknown>;
  sent: Array<{ data: unknown; options?: { target?: string } }>;
  response: unknown;
};

function makeRoom(peerIds: string[] = [], peerConnections: Record<string, RTCPeerConnection> = {}) {
  const actions = new Map<string, FakeAction>();
  const connections = Object.fromEntries(
    peerIds.map((peerId) => [peerId, peerConnections[peerId] ?? ({} as RTCPeerConnection)]),
  );
  const room = {
    makeAction: (namespace: string) => {
      const action: FakeAction = {
        onMessage: null,
        onRequest: null,
        sent: [],
        response: null,
        send: async (data, options) => {
          action.sent.push({ data, options });
        },
        request: async () => action.response,
      };
      actions.set(namespace, action);
      return action;
    },
    getPeers: () => connections,
    onPeerJoin: null as ((peerId: string) => void) | null,
    onPeerLeave: null as ((peerId: string) => void) | null,
    leave: vi.fn(async () => {}),
  };
  return { room: room as unknown as Room, actions };
}

function roomFactory(room: Room) {
  let callbacks: JoinRoomCallbacks | undefined;
  let config: JoinRoomConfig | undefined;
  let calls = 0;
  const joinRoom: RoomFactory = (suppliedConfig, _roomId, suppliedCallbacks) => {
    calls++;
    config = suppliedConfig;
    callbacks = suppliedCallbacks;
    return room;
  };
  return {
    joinRoom,
    getConfig: () => config,
    getCalls: () => calls,
    getCallbacks: () => callbacks,
  };
}

const validOptions = {
  roomId: "test-room",
  password: "0".repeat(64),
  relayUrls: ["wss://relay.example.invalid/mqtt"],
};

describe("Trystero peer transport", () => {
  beforeEach(() => {
    vi.stubGlobal("RTCPeerConnection", class RTCPeerConnection {});
  });

  afterEach(() => vi.unstubAllGlobals());

  it("rejects invalid room credentials before joining", async () => {
    const { room } = makeRoom();
    const factory = roomFactory(room);

    await expect(
      createTrysteroPeerTransport({ ...validOptions, roomId: "   ", joinRoom: factory.joinRoom }),
    ).rejects.toThrow("A peer room identifier is required.");
    await expect(
      createTrysteroPeerTransport({
        ...validOptions,
        password: "short",
        joinRoom: factory.joinRoom,
      }),
    ).rejects.toThrow("A session secret of at least 32 UTF-8 bytes is required.");
    await expect(
      createTrysteroPeerTransport({
        ...validOptions,
        peerId: "  ",
        joinRoom: factory.joinRoom,
      }),
    ).rejects.toThrow("A peer identity is required.");
    expect(factory.getCalls()).toBe(0);
  });

  it("reports a WebView without WebRTC before creating a room", async () => {
    const joinRoom = vi.fn(() => makeRoom().room);
    vi.stubGlobal("RTCPeerConnection", undefined);

    await expect(
      createTrysteroPeerTransport({ ...validOptions, joinRoom: joinRoom as RoomFactory }),
    ).rejects.toThrow("WebRTC is unavailable in this WebView.");
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it("uses the identity associated with an injected Trystero strategy", async () => {
    const { room } = makeRoom();
    const transport = await createTrysteroPeerTransport({
      ...validOptions,
      peerId: "strategy-peer-id",
      joinRoom: () => room,
    });

    expect(transport.peerId).toBe("strategy-peer-id");
    await transport.close();
  });

  it("sanitizes relay failures, enforces update limits, and closes idempotently", async () => {
    const { room, actions } = makeRoom();
    const factory = roomFactory(room);
    const transport = await createTrysteroPeerTransport({
      ...validOptions,
      joinRoom: factory.joinRoom,
    });
    expect(factory.getConfig()).toMatchObject({
      appId: "furancho-labs/peer2canvas",
      maxReceiveBytes: 16 * 1024 * 1024,
      relayConfig: { urls: validOptions.relayUrls, warnOnRelayFailure: false },
    });
    factory.getCallbacks()?.onJoinError?.({
      error: "secret broker detail",
      appId: "private-app",
      roomId: "private-room",
      peerId: "private-peer",
    });
    const onError = vi.fn();
    transport.onError(onError);
    expect(onError).toHaveBeenCalledWith({
      code: "peer-connect-failed",
      message: "The peer network path could not connect.",
    });
    factory.getCallbacks()?.onJoinError?.({
      error:
        "could not connect to peer private-peer after exchanging SDP; TURN credentials missing",
      appId: "private-app",
      roomId: "private-room",
      peerId: "private-peer",
    });
    expect(onError).toHaveBeenLastCalledWith({
      code: "peer-ice-failed",
      message: "Signaling succeeded, but the peers could not establish a WebRTC connection.",
    });
    expect(JSON.stringify(onError.mock.calls)).not.toContain("secret broker detail");
    expect(JSON.stringify(onError.mock.calls)).not.toContain("private-peer");

    await expect(
      transport.broadcastYjsUpdate(new Uint8Array(16 * 1024 * 1024 + 1)),
    ).rejects.toThrow("Yjs update exceeds the session size limit.");
    await transport.broadcastYjsUpdate(new Uint8Array([1, 2, 3]));
    expect(actions.get("pc-yjs-update")?.sent[0]?.data).toEqual(new Uint8Array([1, 2, 3]));

    await transport.close();
    await transport.close();
    expect(room.leave).toHaveBeenCalledTimes(1);
  });

  it("tracks peer lifecycle and accepts only bounded awareness", async () => {
    const { room, actions } = makeRoom(["existing-peer"]);
    const transport = await createTrysteroPeerTransport({ ...validOptions, joinRoom: () => room });
    expect(transport.getPeerIds()).toEqual(["existing-peer"]);

    const onJoin = vi.fn();
    const onLeave = vi.fn();
    const onAwareness = vi.fn();
    transport.onPeerJoin(onJoin, true);
    transport.onPeerLeave(onLeave);
    transport.onAwarenessChange(onAwareness);
    expect(onJoin).toHaveBeenCalledWith("existing-peer");

    const awareness = actions.get("pc-awareness");
    await awareness?.onMessage?.(
      { state: { cursor: { x: 20, y: 40 }, selectionId: "node-1" } },
      { peerId: "existing-peer" },
    );
    await awareness?.onMessage?.(
      { state: { cursor: { x: Number.POSITIVE_INFINITY, y: 0 }, selectionId: null } },
      { peerId: "untrusted-peer" },
    );
    expect(transport.getAwareness()).toEqual({
      "existing-peer": { cursor: { x: 20, y: 40 }, selectionId: "node-1" },
    });

    room.onPeerJoin?.("new-peer");
    expect(onJoin).toHaveBeenCalledWith("new-peer");
    room.onPeerLeave?.("existing-peer");
    expect(onLeave).toHaveBeenCalledWith("existing-peer");
    expect(transport.getAwareness()).toEqual({});
    expect(onAwareness).toHaveBeenCalled();
    await transport.close();
  });

  it("validates sync acknowledgements in both directions", async () => {
    const { room, actions } = makeRoom();
    const transport = await createTrysteroPeerTransport({ ...validOptions, joinRoom: () => room });
    const handler = vi.fn(async () => ({ ready: true, revision: 7 }));
    transport.onSyncAcknowledgement(handler);

    const action = actions.get("pc-yjs-sync-ack");
    const invalidRequest = await action?.onRequest?.(
      { epoch: "e", revision: -1 },
      { peerId: "remote-peer" },
    );
    expect(invalidRequest).toEqual({ ready: false, revision: 0 });
    expect(handler).not.toHaveBeenCalled();

    action!.response = { ready: true, revision: -1 };
    await expect(
      transport.requestSyncAcknowledgement("host-peer", { epoch: "e", revision: 0 }),
    ).rejects.toThrow("The host did not acknowledge initial synchronization.");
    action!.response = { ready: true, revision: 7 };
    await expect(
      transport.requestSyncAcknowledgement("host-peer", { epoch: "e", revision: 0 }),
    ).resolves.toEqual({ ready: true, revision: 7 });
    await transport.close();
  });

  it("reports an unknown path when ICE stats are unavailable and a relay path accurately", async () => {
    const directConnection = {
      connectionState: "connected",
      iceConnectionState: "connected",
      getStats: async () =>
        new Map([
          [
            "pair",
            {
              type: "candidate-pair",
              state: "succeeded",
              nominated: true,
              localCandidateId: "local",
              remoteCandidateId: "remote",
            },
          ],
          ["local", { candidateType: "host" }],
          ["remote", { candidateType: "srflx" }],
        ]),
    } as unknown as RTCPeerConnection;
    const relayConnection = {
      connectionState: "connected",
      iceConnectionState: "connected",
      getStats: async () =>
        new Map([
          [
            "pair",
            {
              type: "candidate-pair",
              state: "succeeded",
              nominated: true,
              localCandidateId: "local",
              remoteCandidateId: "remote",
            },
          ],
          ["local", { candidateType: "host" }],
          ["remote", { candidateType: "relay" }],
        ]),
    } as unknown as RTCPeerConnection;
    const { room } = makeRoom(["direct", "relay", "unknown"], {
      direct: directConnection,
      relay: relayConnection,
      unknown: {} as RTCPeerConnection,
    });
    const transport = await createTrysteroPeerTransport({
      ...validOptions,
      joinRoom: () => room,
    });

    await expect(transport.getNetworkDiagnostics()).resolves.toMatchObject([
      { peerId: "direct", direct: true, hops: 1, remoteCandidateType: "srflx" },
      { peerId: "relay", direct: false, hops: 2, remoteCandidateType: "relay" },
      { peerId: "unknown", direct: null, hops: null },
    ]);
    await transport.close();
  });

  it("accepts only finite cursor coordinates and bounded selection IDs", () => {
    expect(isPeerAwarenessState({ cursor: null, selectionId: null })).toBe(true);
    expect(isPeerAwarenessState({ cursor: { x: 1_000_001, y: 0 }, selectionId: "node-1" })).toBe(
      false,
    );
    expect(isPeerAwarenessState({ cursor: { x: 0, y: 0 }, selectionId: "x".repeat(129) })).toBe(
      false,
    );
    expect(isPeerAwarenessState({ cursor: { x: 0, y: 0, z: 0 }, selectionId: null })).toBe(false);
  });
});
