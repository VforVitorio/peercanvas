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

- The optional peer smoke uses two JavaScript contexts in one Tauri window/native WebView; the participant is an `<iframe>`, not a second WebView, process, or device.
- Manual GitHub runner run [43426758968](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43426758968) passed one synchronization/edit/reconnect/graceful-host-loss attempt on macOS 26.7.2 / WKWebView 21624.5.1.11.3 and Windows Server 2025 / WebView2 156.0.4314.58. Both selected host candidates. These are same-runner iframe tests, not separate-network results.
- The Linux runner's WebKitGTK 2.52.6 did not expose `RTCPeerConnection`. A smoke-only call to `WebKitSettings.enable-webrtc` in follow-up run [43429007418](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43429007418) still did not expose the API. This check is not present in the production app. WebKitGTK 2.54.2 also disables WebRTC in its stable build while replacing the backend; see the [2.54 release notes](https://webkitgtk.org/2026/09/16/webkitgtk-2.54-highlights.html). This makes the peer transport unavailable on standard Linux WebKitGTK builds unless a supported runtime or transport is selected.
- The same follow-up run did not produce peer results on macOS or Windows because the test-only probe failed compilation on an unused closure argument; that warning is fixed in the current branch and awaits the pull-request CI rerun.
- No TURN provider or credentials are available. Separate devices/networks, representative NAT/firewall routes, signaling loss, STUN success/failure, forced TURN, network changes, peer limits, abrupt host crash, timings/byte counts, and durable-file hash comparison remain unverified. Keep #37 and S4 open; do not claim complete cross-platform peer support.
