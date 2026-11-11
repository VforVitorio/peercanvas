# ADR-0002: One document model with replaceable collaboration transport

- **Status:** Proposed, gated on WP-01/WP-02/WP-07.
- **Date:** 2026-11-07.

## Context

The editor needs local-first documents and optional concurrent editing. The architecture must avoid separate mutable canvases, persisted models, and collaboration documents that can drift.

## Options

1. Canonical versioned model plus validated command boundary, with Yjs updates behind an adapter.
2. Treat the renderer's transient view state as the document.
3. Make one hosted server the authority for every document.

## Decision

Use one versioned document model as durable semantic state. Treat canvas view, selection, presence, and chat as derived or separate state. Yjs is the initial collaboration candidate; Trystero/WebRTC is the initial replaceable transport candidate. A WeaveStoreP2P adapter is a proposed integration point.

## Rationale and consequences

The command boundary can validate UI, peer, import, AI, and MCP operations consistently. The architecture does not require a permanent PeerCanvas server. Peer discovery/signaling may still use external relays; TURN may be required.

## Risks and validation

The 2026-11-10 UI demonstration work separately authorizes a pure shared document/command implementation at `src/document/**`, with [a frozen contract](../shared-document-contract.md). Demo consumers import that same core and rebuild disposable Weave state after accepted commands. This is bounded demo evidence: it does not approve a persistence backend, implement synchronization, or close WP-02/WP-07 production acceptance. Integration with the S1 worktree requires comparing its current contract and acknowledging the queued handoff.

Confirm Weave's Yjs store contracts and how remote updates pass validation. WP-07 must test convergence, initial sync, awareness, LAN/NAT/TURN, disconnect, reconnect, and host loss. No assumption of universal direct peer connectivity is accepted.
