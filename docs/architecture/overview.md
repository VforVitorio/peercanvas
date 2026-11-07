# PeerCanvas architecture overview

Status: proposed architecture baseline, 2026-11-07. This is a design, not evidence that the components interoperate.

## Constraints and verified baseline

- Desktop shell: Tauri 2.12.x candidate with Rust.
- UI: React 18.3.1, TypeScript, and Vite 8. React 18 is retained because the selected Weave renderer's published peer dependency range excludes React 19.
- Canvas engine: Weave.js 5.7.1 candidate, including its React renderer and Konva integration.
- Document collaboration candidate: Yjs state; an adapter tentatively named WeaveStoreP2P; Trystero over WebRTC.
- Platforms: Windows, macOS, Linux. Tauri uses each platform's WebView; exact minimum versions and native behavior must be measured.
- AI candidate: optional Codex app-server process using Sign in with ChatGPT for eligible open-source/local-app plan usage, subject to preview terms and registration.

The compatibility spike in WP-01 is a gate. A package version in this list is not proof that the integrated app works.

## Logical component view

```mermaid
flowchart LR
  User[Local user]
  Peer[Peer participant]
  Shell[Tauri desktop shell]
  UI[React UI]
  Canvas[Weave renderer and plugins]
  Model[Canonical document model and commands]
  Store[Local persistence adapter]
  Sync[Yjs synchronization adapter]
  Transport[Trystero and WebRTC transport]
  Relay[External signaling relay and optional TURN]
  AI[Optional Codex app-server]
  MCP[PeerCanvas MCP server]
  Provider[ChatGPT plan or another provider]

  User --> Shell
  Peer --> Shell
  Shell --> UI
  UI --> Canvas
  UI --> Model
  Canvas <--> Model
  Model <--> Store
  Model <--> Sync
  Sync <--> Transport
  Transport <--> Relay
  Transport <--> Peer
  UI --> AI
  AI <--> Provider
  AI <--> MCP
  MCP --> Model
  MCP --> UI
```

The model command boundary is the security and consistency boundary for UI, peer, import, AI, and MCP mutations. Render state, selection, presence, and conversation state are not independent copies of the document.

## Component responsibilities

| Component                  | Responsibility                                                                                     | Must not own                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Tauri shell                | Window lifecycle, native dialogs, secure storage, deep links, controlled child processes           | Diagram semantics                                 |
| React UI                   | Toolbars, panels, session controls, chat, previews, errors, accessibility                          | A separate mutable diagram document               |
| Weave adapter              | Canvas rendering, selection, transforms, connectors, plugins, history integration where compatible | Authorization or durable storage policy           |
| Canonical document model   | Versioned pages/layers/nodes/edges/styles; command validation; migrations and stable IDs           | Provider tokens or transport credentials          |
| Persistence adapter        | Atomic local save/open, checkpoints, migration and recovery                                        | Collaboration policy                              |
| Yjs adapter                | Encode/apply validated document changes; initial sync and awareness                                | Trusting peer input without command validation    |
| Transport adapter          | Peer discovery, signaling and WebRTC lifecycle                                                     | Claiming that all peers can connect directly      |
| Invitation/session service | Secret generation, expiry, admission, roles, revocation and session lifecycle                      | Centralized identity in the initial design        |
| Codex app-server adapter   | Optional conversations, streaming, cancellation and provider lifecycle                             | Direct access to unsafe arbitrary model mutations |
| MCP server                 | Versioned, bounded document tools that use the model command boundary                              | Bypassing approval or role enforcement            |

## Canonical document model

Proposed top-level shape:

```text
Document
  schemaVersion
  documentId
  metadata
  pages[]
    pageId
    name
    layers[]
      layerId
      name
      nodes[]
      connections[]
  styles
  libraryReferences[]
  sourceCompatibility
```

Each node or connection has a stable ID, a declared type, validated properties, and optional extension data. The final schema, normalization rules, and serialized format are WP-02 deliverables. Imported extension data must be bounded and treated as untrusted.

## Core data flows

### Local edit and save

```mermaid
sequenceDiagram
  actor User
  participant UI as React UI
  participant Model as Command boundary
  participant Weave as Weave adapter
  participant Store as Local store
  User->>UI: Add or change an element
  UI->>Model: Validated command
  Model->>Model: Check IDs, schema, invariants and permissions
  Model-->>Weave: Accepted model update
  Weave-->>UI: Render and selection state
  Model->>Store: Persist update/checkpoint
  Store-->>UI: Saved or recoverable error
```

### Peer update

The intended flow is a validated local command, durable local update, Yjs update encoding, encrypted WebRTC transport, remote validation/application, and acknowledgement or visible failure. The exact boundary between Weave's Yjs store and the persistence adapter is unresolved until WP-01 and WP-03.

### AI-proposed change

The provider returns a proposed operation list. The MCP/assistant adapter parses and validates the list, presents a diff-like preview, and waits for the user. Approval submits normal model commands; denial or cancellation leaves the document unchanged. The user-visible history records approved operations and their origin without retaining credentials.

## Decisions and boundaries

- Tauri owns native integration; React runs inside the system WebView. Do not assume Chromium behavior on every OS.
- The renderer is a replaceable adapter around the canonical model. Reuse Weave capabilities where verified rather than rebuilding them.
- Local-only functionality has no network dependency. Collaboration and AI are optional adapters.
- P2P does not mean zero infrastructure. Signaling may use public or configured relays; NAT/firewall conditions may require TURN.
- The invitation secret is a bearer capability. A link alone does not establish a person's identity or guarantee that an admitted peer cannot copy data.
- OpenAI access tokens remain in the native process/token store and are passed only to the Codex child process as required by the documented app-server integration. No token is exposed to the renderer or logs.
- No installer format, signing, update mechanism, database engine, network relay operator, or AI provider is fixed by this baseline.

## Validation gates

| Gate                | Required evidence                                                                              | Owner package |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------- |
| Tauri/Weave         | renderer mounts, edit operations work, native smoke matrix on the declared OS targets          | WP-01         |
| Persistence         | save/open, migration, interrupted write and recovery experiments on each OS                    | WP-03         |
| draw.io             | safe parser, golden fixtures, round-trip subset, loss report                                   | WP-06         |
| P2P                 | LAN/NAT/TURN matrix, sync convergence, host disconnect and reconnect                           | WP-07/WP-08   |
| Invitation security | entropy, deep-link handling, logs, expiry, admission, role enforcement and revocation tests    | WP-08         |
| Codex/MCP           | current auth eligibility/terms, app-server protocol, token boundary, approval and denial tests | WP-09/WP-10   |
| Release             | CI plus real OS/WebView smoke checklist, licenses, accessibility and recovery                  | WP-11         |

## Sources

- [Weave.js 5.7.1 release](https://github.com/InditexTech/weavejs/releases/tag/5.7.1)
- [Weave React package metadata](https://github.com/InditexTech/weavejs/blob/5.7.1/code/packages/react/package.json)
- [Weave setup guide](https://github.com/InditexTech/weavejs/blob/5.7.1/docs/src/modules/sdk/pages/setup.adoc)
- [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/)
- [Tauri Vite setup](https://v2.tauri.app/start/frontend/vite/)
- [Yjs document updates](https://docs.yjs.dev/api/document-updates)
- [Trystero signaling strategies](https://trystero.dev/docs/signaling-strategies/)
- [Trystero connections](https://trystero.dev/docs/connections/)
