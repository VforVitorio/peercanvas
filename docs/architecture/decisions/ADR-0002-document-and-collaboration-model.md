# ADR-0002: One document model with replaceable collaboration transport

- **Status:** Host-sequenced synchronization and initial Trystero MQTT signaling selected for WP-07; network-matrix evidence remains in progress.
- **Date:** 2026-11-07.

## Context

The editor needs local-first documents and optional concurrent editing. The architecture must avoid separate mutable canvases, persisted models, and collaboration documents that can drift.

## Options

1. Canonical versioned model plus validated command boundary, with Yjs updates behind an adapter.
2. Treat the renderer's transient view state as the document.
3. Make one hosted server the authority for every document.

## Decision

Use one versioned document model as durable semantic state. Treat canvas view, selection, presence, and chat as derived or separate state. Yjs is the synchronization representation and Trystero/WebRTC is the initial replaceable transport. Weave remains a disposable projection; its renderer store is not the session's canonical state.

The host is the only writer to the session Y.Doc. Participant edits arrive as command proposals; the host validates them with `executeCommand`, sequences accepted commands, and distributes Yjs updates. A stale proposal may be rebased only if its affected IDs are disjoint from intervening accepted commands. Overlapping or expired proposals are rejected with the current snapshot. This is host-serialized collaboration, not multi-writer CRDT conflict resolution. Commits carry their origin; each participant keeps undo/redo history for its own accepted commands and submits inverse commands through the same host validator. Resynchronizing from a checkpoint clears local in-memory undo history.

Cursor/selection awareness uses ephemeral Trystero per-user state, not the document Y.Doc or local file. Browser identities are session-only in this initial integration.

## Rationale and consequences

The command boundary can validate UI, peer, import, AI, and MCP operations consistently. The architecture does not require a permanent PeerCanvas server. The initial adapter uses three explicit public MQTT-over-WebSocket signaling endpoints: `broker.emqx.io:8084`, `broker.hivemq.com:8884`, and `test.mosquitto.org:8081`. They are replaceable third-party services with no availability guarantee. Trystero 0.26's default ICE configuration uses public Google and Cloudflare STUN servers; no TURN provider or credentials are selected. The signaling services can observe connection activity and metadata; WP-07.3 records which paths work and WP-08 owns the product privacy disclosure and deployment policy.

The adapter is pinned to `@trystero-p2p/mqtt` 0.26.0 because 0.27.0 introduced BigInt syntax incompatible with the configured Safari 13 JavaScript build target. The target is a compilation setting, not a declared minimum supported OS or WebView version.

The transport accepts a caller-provided secret of at least 32 UTF-8 bytes; it does not generate the invitation secret or prove its entropy. WP-08 must supply it from the platform cryptographic RNG, keep it out of logs and ordinary URL requests, and enforce admission, roles, expiry, and peer limits before exposing share/join controls.

## Risks and validation

WP-07 uses the shared `src/document/**` command boundary for accepted collaboration changes. Yjs updates carry only host-authored checkpoints and accepted commits; peers do not mutate canonical state by applying arbitrary remote Yjs data. The Y.Doc remains transient under [ADR-0003](ADR-0003-local-persistence.md), and FR-034 is split between WP-07 transport loss and WP-08 session lifecycle events.

WP-07 must verify deterministic convergence, initial sync, awareness, LAN/NAT/STUN/TURN, disconnect, reconnect, and host loss. A direct peer connection is not guaranteed, and the current design has no TURN fallback until a provider and credentials are explicitly selected. WP-08 adds invitations, admission, and viewer/editor authorization; WP-07 does not expose a sharing UI.

### WP-07.3 evidence checkpoint (2026-11-13)

- macOS 27.2.1 arm64, WebKit 22625.2.8.11.9: the canvas-only native smoke passes. The optional peer smoke runs its host and peer in separate JavaScript contexts: the peer is an `<iframe>` inside the same Tauri window and native WebView, not a second WebView or application process. The loopback relay exchanged subscriptions/signaling; the public mode opened all three broker WebSockets with the `mqtt` subprotocol. A separate Node MQTT CONNECT check succeeded against each broker, but neither peer session became ready.
- Both same-Mac iframe peer modes gathered `host` and `srflx` ICE candidates, but both connections remained `checking` and no peer became ready within the 15-second sync timeout. This single-machine, single-WebView topology cannot distinguish NAT hairpinning from a WebKit/network restriction. It does not demonstrate connectivity between devices, separate native WebViews, LANs, NATs, or a successful STUN path.
- No TURN provider or credentials are available in this test environment, so forced TURN, relay candidate selection, network-change recovery, cross-device peer limits, and host-crash behavior remain unverified. A second device/network and valid TURN test credentials are required to close WP-07.3.
