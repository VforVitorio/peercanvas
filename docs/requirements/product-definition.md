# PeerCanvas product definition

Status: proposed baseline, 2026-11-07. Requirements are derived from the project handoff and have not yet been approved as a release contract. Stable IDs should not be reused.

## Product context

The [isolated UI demonstration](../development/ui-mock.md) is a review surface for the requirements below. It uses fictional outcomes and the shared pure command core; it does not satisfy durable persistence, transport, real-provider, or native workflow acceptance. Stable requirement IDs and production acceptance criteria remain unchanged.

PeerCanvas is an open-source desktop diagram editor for creating architecture, UML, BPMN, network, cloud, database, process, and workflow diagrams. It is local-first and must work as an editor without a network connection or AI account. Optional capabilities add peer-to-peer collaboration, private session invitations, draw.io interchange, and an embedded Codex assistant with model-level MCP tools.

The first product goal is a useful local editor. Collaboration and AI must not be prerequisites for opening, editing, saving, or exporting a local document. PeerCanvas is an independent community project and must not imply endorsement by Weave.js, InditexTech, OpenPencil, draw.io, or OpenAI.

## Scope

### First product scope

- Windows, macOS, and Linux desktop shell built with Tauri 2, React, TypeScript, and Vite.
- Weave.js as the proposed canvas/rendering foundation, subject to the compatibility spike.
- A single versioned document model with pages, layers, nodes, connectors, styles, and metadata.
- Local document editing, save/open, history, and crash recovery.
- Searchable shape catalog with verified asset provenance and SVG handling.
- A declared draw.io compatibility subset with import/export and loss reporting.
- Optional Yjs synchronization over a Trystero/WebRTC transport.
- Optional temporary sharing with host-controlled admission and permissions.
- Optional Codex assistant and MCP tools, with user-approved changes.

### Explicitly out of scope for the foundation

- SaaS-hosted editing, accounts, or a mandatory application server.
- Keycloak or centralized identity for the first release.
- Guaranteed direct WebRTC connectivity or a free/managed TURN service.
- Full draw.io parity or unreviewed third-party logos/stencils.
- Automatic AI mutation of a diagram without a user-visible preview and approval.
- User-facing Codex skills before the underlying MCP tools exist and pass security review.
- Installer formats, signing, auto-update, mobile clients, or release dates.

## Stakeholders, actors, and roles

Actors describe who or what participates. Roles describe permissions. A person can have different roles in different documents or sessions.

| Actor                  | Goal                                              | Possible roles               |
| ---------------------- | ------------------------------------------------- | ---------------------------- |
| Local user             | Create and manage diagrams on one device          | Document owner, editor       |
| Session host           | Share a local document and control admission      | Host, editor                 |
| Peer participant       | Join and collaborate through an invitation        | Editor or read-only viewer   |
| Codex provider         | Answer prompts and request document operations    | Untrusted proposer           |
| MCP client             | Call PeerCanvas tools through a declared protocol | Read-only caller or proposer |
| Maintainer/contributor | Build, review, release, and maintain the project  | Maintainer, contributor      |

The AI provider and MCP client are not trusted authorities. They may propose commands, but the application validates the document boundary and applies mutating commands only after the user approves them. A session role must be enforced by the command/model boundary, not only by hiding controls.

## Constraints and assumptions

- The stack is Tauri 2 + React + TypeScript + Vite; Weave.js is the intended engine. Compatibility is not proven by the current shell.
- The target desktop OS families are Windows, macOS (Apple Silicon and Intel where viable), and Linux. Exact OS minimum versions are undecided.
- Weave.js 5.7.1 and React 18.3.1 are the pinned research baseline. Recheck current releases and peer dependencies before changing either.
- Yjs + Trystero + WebRTC is a proposed collaboration path. Signaling, STUN, TURN, NAT traversal, and relay availability remain external dependencies.
- Local diagrams use versioned `.peercanvas` JSON through the Rust persistence adapter selected in [ADR-0003](../architecture/decisions/ADR-0003-local-persistence.md). Application preferences remain separate from diagram content.
- The initial release does not rely on centralized user identity.
- The current OpenAI documentation describes a Sign in with ChatGPT plan-usage path for eligible open-source/local apps. It is a preview; verify registration, eligibility, rate/usage limits, terms, and storage requirements before implementation.
- Effort and sprint estimates in PLANS.md are planning estimates, not promises or measured velocity.

## Business rules

| ID     | Rule                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-001 | A local document remains editable without collaboration or AI services.                                                                      |
| BR-002 | The durable local document is the user-visible source of truth; derived render state must be rebuildable.                                    |
| BR-003 | Any mutating assistant or MCP action is a proposal until the user approves it.                                                               |
| BR-004 | Session permission checks run at the model command boundary; UI state alone is not authorization.                                            |
| BR-005 | An invitation secret is a bearer capability, not a verified human identity.                                                                  |
| BR-006 | Revocation blocks future session access but cannot erase content already copied by a participant.                                            |
| BR-007 | Unsupported draw.io constructs must be reported and preserved where safe; they must not be silently represented as fully compatible.         |
| BR-008 | No asset is redistributed until its source, version, license, attribution, and permitted use are recorded and reviewed.                      |
| BR-009 | No private credentials, OAuth tokens, or session secrets are written to logs or repository files.                                            |
| BR-010 | OpenSpec planning is not approval to implement. An approved change and explicit user authorization are required before product feature work. |

## Functional requirements

The OpenSpec capability names below are the planned canonical capability contracts. The requirements matrix is the stable high-level index; details and scenarios live in the matching OpenSpec change/spec files.

| ID     | Requirement                                                                                                            | Capability                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| FR-001 | The application shall launch as a desktop app on each declared supported OS.                                           | Desktop Application            |
| FR-002 | The UI shall host the selected Weave renderer without requiring Next.js.                                               | Desktop Application            |
| FR-003 | The canvas shall render and select diagram elements through model-backed state.                                        | Canvas Editing                 |
| FR-004 | The canvas shall support basic node selection, movement, resize, and connector editing.                                | Canvas Editing                 |
| FR-005 | Each document element shall have a stable unique identifier.                                                           | Document Model                 |
| FR-006 | A document shall contain ordered pages, layers, nodes, connections, styles, and metadata.                              | Document Model                 |
| FR-007 | Mutations shall enter through validated typed commands and return explicit success or error results.                   | Document Model                 |
| FR-008 | Nodes shall support a declared initial set of shapes and properties.                                                   | Diagram Shapes                 |
| FR-009 | Connections shall reference valid endpoints and preserve connector style and routing metadata.                         | Diagram Shapes                 |
| FR-010 | The editor shall support undo and redo for accepted model mutations.                                                   | History & Recovery             |
| FR-011 | Selection state shall be available to editor tools without becoming a second document source of truth.                 | Canvas Editing                 |
| FR-012 | Users shall create, open, save, rename, and close local documents.                                                     | Local Persistence              |
| FR-013 | Persisted documents shall carry a schema version and use explicit migrations.                                          | Local Persistence              |
| FR-014 | The application shall create recoverable snapshots or equivalent durable checkpoints.                                  | History & Recovery             |
| FR-015 | The application shall detect incomplete/corrupt recovery state and offer a non-destructive recovery path.              | History & Recovery             |
| FR-016 | Local preferences shall be stored separately from diagram content.                                                     | Local Persistence              |
| FR-017 | Shape libraries shall be described by a manifest with stable IDs and categories.                                       | Shape Catalog                  |
| FR-018 | Users shall browse and add approved offline shapes with stable catalog references.                                     | Shape Catalog                  |
| FR-019 | Every bundled asset shall record source, version, license, attribution, and review status.                             | Shape Catalog                  |
| FR-020 | SVG previews and imported SVG content shall be sanitized before use.                                                   | Security & Privacy             |
| FR-021 | The application shall import a declared subset of draw.io XML and compressed pages.                                    | draw.io Compatibility          |
| FR-022 | The application shall export supported document semantics to draw.io format.                                           | Import & Export                |
| FR-023 | The application shall report unsupported or lossy transformations before the user confirms them.                       | draw.io Compatibility          |
| FR-024 | The adapter shall preserve safe, bounded unsupported draw.io source fragments.                                         | draw.io Compatibility          |
| FR-025 | Concurrent document edits shall synchronize through Yjs updates.                                                       | P2P Collaboration              |
| FR-026 | The proposed peer transport shall use a replaceable adapter and support Trystero/WebRTC as the initial candidate.      | P2P Collaboration              |
| FR-027 | Joining a peer session shall receive an initial document state before declaring the peer ready.                        | P2P Collaboration              |
| FR-028 | The session shall surface connection state, reconnection, and presence/awareness separately from saved document state. | Presence & Awareness           |
| FR-029 | The host shall generate an invitation with a random session identifier and a high-entropy secret.                      | Secure Session Invitations     |
| FR-030 | Invitations shall support expiry and a host-controlled admission decision.                                             | Secure Session Invitations     |
| FR-031 | The host shall inspect participants and assign editor or viewer roles.                                                 | Secure Session Invitations     |
| FR-032 | Viewer peers shall be prevented from mutating the model through all supported command paths.                           | Security & Privacy             |
| FR-033 | The host shall revoke a participant or close a session.                                                                | Secure Session Invitations     |
| FR-034 | Session loss shall not delete the host's last durable local document.                                                  | P2P Collaboration              |
| FR-035 | AI shall be optional and accessed through a provider boundary.                                                         | Codex Embedded Chat            |
| FR-036 | The assistant shall retain conversation metadata and support a streaming response view.                                | Codex Embedded Chat            |
| FR-037 | The assistant shall support cancellation and recoverable provider errors.                                              | Codex Embedded Chat            |
| FR-038 | The user may explicitly share the active document and selected elements as prompt context.                             | Codex Embedded Chat            |
| FR-039 | A proposed diagram mutation shall be previewed and approved before application.                                        | Codex Embedded Chat            |
| FR-040 | Approved assistant changes shall be attributable in the local action history.                                          | Codex Embedded Chat            |
| FR-041 | MCP tools shall read a document and return a bounded structured representation.                                        | MCP Integration                |
| FR-042 | MCP tools shall inspect current selection and search available shapes.                                                 | MCP Integration                |
| FR-043 | MCP tools may propose node/edge creation, editing, deletion, layout, analysis, and export.                             | MCP Integration                |
| FR-044 | The app shall validate tool arguments and scope them to an explicitly selected document.                               | MCP Integration                |
| FR-045 | Mutating MCP calls shall require the same preview/approval path as UI-originated AI proposals.                         | MCP Integration                |
| FR-046 | MCP operations shall expose cancellation, errors, and audit events without secrets.                                    | MCP Integration                |
| FR-047 | User-facing Codex skills shall be authored only after the referenced tools are implemented and verified.               | User-Facing Codex Skills       |
| FR-048 | The Codex integration shall be removable/disableable without disabling local editing.                                  | User-Facing Codex Skills       |
| FR-049 | Published skills shall document required tools, permissions, installation, limits, and examples.                       | User-Facing Codex Skills       |
| FR-050 | Users shall choose System, Light, or Dark application appearance that persists separately from diagram content.        | User Preferences               |
| FR-051 | Users shall choose English or Spanish interface resources with locale-aware formatting and a defined fallback.         | Localization                   |
| FR-052 | Users shall start, navigate, and close optional guided tours for verified PMV workflows without changing active work.  | Guided Onboarding              |
| FR-053 | Users shall group and ungroup eligible diagram elements through validated document commands.                           | Document Model, Canvas Editing |

FR-050..FR-051 are authorized for local implementation by the maintainer's 2026-11-13 request, together with `editor-workspace-refresh`. This advances the selected S8/WP-13 scope ahead of S4 and preserves FR-016 and the S3 document contracts. FR-052 remains planned in `guided-onboarding`; FR-053 remains proposed for S9 pending WP-14.1/#89. Their entries do not authorize implementation.

## Non-functional requirements

Targets below are proposed acceptance goals, not measured results. WP-01 and WP-11 must record the reference machines, OS/WebView versions, fixture sizes, and measurement method before any performance target is treated as final.

| ID      | Requirement and verification                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-001 | Local editing, save, and reopen shall pass with network access disabled. Verify on each supported OS.                                                                                                          |
| NFR-002 | On the named reference machine, time from launch to an interactive empty document shall be at most 5 seconds at p95 across 20 cold starts.                                                                     |
| NFR-003 | On the named reference machine, open and save of a 1,000-element fixture shall each complete within 2 seconds at p95 across 20 runs.                                                                           |
| NFR-004 | On the named reference machine, a 1,000-node simple fixture shall sustain at least 30 frames/second during pan/zoom for a 30-second sample, with the visible test procedure recorded.                          |
| NFR-005 | A forced close after a successful save shall reopen the last complete version; fault-injection tests shall not silently overwrite the last known-good snapshot.                                                |
| NFR-006 | Network traffic for peer sessions shall use WebRTC's transport encryption; the design shall document any relay/signaling metadata visible to third parties.                                                    |
| NFR-007 | Invitation secrets shall contain at least 256 random bits from a platform cryptographic RNG and must not appear in query strings, telemetry, app logs, or crash reports.                                       |
| NFR-008 | Unauthorized viewer mutations shall be rejected in 100% of command-boundary tests, including MCP and imported/remote command paths.                                                                            |
| NFR-009 | CI shall build the frontend on Windows, macOS, and Linux. Native app smoke checks shall be reported per OS and not inferred from frontend-only builds.                                                         |
| NFR-010 | Core create/edit/save/open flows shall be operable by keyboard and meet WCAG 2.2 AA for the controls and dialogs within the app's scope.                                                                       |
| NFR-011 | The declared draw.io fixture subset shall preserve 100% of fields marked supported in the compatibility matrix through import/export.                                                                          |
| NFR-012 | Every functional requirement shall have at least one acceptance scenario and automated or documented manual evidence before release.                                                                           |
| NFR-013 | Dependencies shall be versioned/locked and scanned on pull requests; critical/high findings require a documented disposition before release.                                                                   |
| NFR-014 | The local editor shall not require a permanently hosted PeerCanvas service. External signaling or TURN dependencies must be identified, replaceable where feasible, and reflected in privacy/cost disclosures. |
| NFR-015 | Each declared native app package shall include the authorized PeerCanvas icon and pass package inspection and launch verification.                                                                             |

## Use-case overview

| ID    | Capability group  | Use case                                        | Primary actor    |
| ----- | ----------------- | ----------------------------------------------- | ---------------- |
| UC-01 | Desktop documents | Create, open, edit, and save a local diagram    | Local user       |
| UC-02 | Canvas editing    | Add and connect shapes                          | Local user       |
| UC-03 | Shape catalog     | Find and add an approved shape                  | Local user       |
| UC-04 | Interchange       | Import a draw.io file and review losses         | Local user       |
| UC-05 | Interchange       | Export a diagram to draw.io                     | Local user       |
| UC-06 | Collaboration     | Start a temporary shared session                | Session host     |
| UC-07 | Collaboration     | Join a session from an invitation               | Peer participant |
| UC-08 | Collaboration     | Admit, assign, or revoke a participant          | Session host     |
| UC-09 | AI assistance     | Ask Codex to analyze or propose an edit         | Local user       |
| UC-10 | MCP               | Read or propose document changes through a tool | MCP client       |
| UC-11 | Desktop settings  | Change appearance and language preferences      | Local user       |
| UC-12 | Onboarding        | Use a guided tour for a verified PMV workflow   | Local user       |
| UC-13 | Canvas editing    | Group and ungroup eligible diagram elements     | Local user       |

UC-11 is authorized for local implementation ahead of S4 under the 2026-11-13 workspace refresh. UC-12 remains planned for S10. UC-13 remains proposed until WP-14.1/#89 defines the grouping behavior.

### UC-01: Create, open, edit, and save a local diagram

- **Actors/roles:** local user as document owner/editor.
- **Preconditions:** application is installed; no network or AI account is required.
- **Trigger/input:** user selects New, Open, or Save and may provide a filename.
- **Main flow:** create or load a document; edit model-backed content; save; close; reopen; confirm the saved state.
- **Alternatives:** a newer schema is migrated; unsaved changes prompt for save/discard/cancel; a missing file is reported without deleting recovery data.
- **Errors:** permission denied, disk full, corrupt document, or failed migration produces a recoverable error and preserves the last known-good data.
- **Postconditions:** one durable document version is available locally; no remote service is required.
- **Acceptance:** NFR-001, NFR-002, NFR-003, NFR-005.

### UC-02: Add and connect shapes

- **Actors/roles:** local user as editor.
- **Preconditions:** a writable document is open.
- **Trigger/input:** user drags/selects a shape and chooses endpoints for a connector.
- **Main flow:** validate the requested shape and endpoints; add model elements; render; allow selection/move/resize; undo and redo.
- **Alternatives:** invalid endpoints are rejected; unavailable shape is not added.
- **Errors:** invalid command leaves document unchanged and presents a reason.
- **Postconditions:** node and edge state is represented once in the document model.
- **Acceptance:** FR-003..FR-011.

### UC-03: Find and add an approved shape

- **Actors/roles:** local user as editor; catalog is a local data source.
- **Preconditions:** catalog manifest is valid and the requested library is installed.
- **Trigger/input:** user searches by name, category, or tag.
- **Main flow:** search locally by name, category, or keyword; show provenance/license information; add the selected shape through the command boundary and store its stable identifier and asset version.
- **Alternatives:** no result offers a clear empty state; unreviewed assets are hidden from the default catalog.
- **Errors:** invalid SVG or manifest entry is rejected and logged without document secrets.
- **Postconditions:** the selected shape is added with a stable catalog reference.
- **Acceptance:** FR-017..FR-020.

### UC-04: Import a draw.io file and review losses

- **Actors/roles:** local user as document owner/editor.
- **Preconditions:** source file is readable; importer supports the declared format variant.
- **Trigger/input:** user opens or imports a draw.io XML/compressed document.
- **Main flow:** parse a bounded `.drawio` or `.xml` file; map supported content; report unsupported and safely preserved fragments; ask before discarding unsupported data.
- **Alternatives:** malformed/unsupported files are rejected with a diagnostic; safe independent cell fragments may be retained for round-trip.
- **Errors:** parser limits, invalid XML, or unsafe SVG leave the destination document unchanged.
- **Postconditions:** imported document and loss report are available; the original file is not overwritten implicitly.
- **Acceptance:** FR-021, FR-023, FR-024 and NFR-011.

### UC-05: Export a diagram to draw.io

- **Actors/roles:** local user as document owner/editor.
- **Preconditions:** an open document has content.
- **Trigger/input:** user chooses Export and a destination path.
- **Main flow:** serialize supported fields and retained safe fragments; show unsupported/lossy items; confirm; write to a new target or explicitly chosen destination.
- **Alternatives:** cancellation leaves the original untouched; overwrite requires confirmation.
- **Errors:** permission or disk failure leaves the original diagram and any previous export intact.
- **Postconditions:** exported file opens as a draw.io document for the supported subset.
- **Acceptance:** FR-022..FR-024 and NFR-011.

### UC-06: Start a temporary shared session

- **Actors/roles:** local user becomes session host.
- **Preconditions:** a saved document is open; user enables collaboration.
- **Trigger/input:** user selects Share and chooses expiry/admission/role settings.
- **Main flow:** create random session ID and secret; establish signaling/peer transport; show the invite; keep host's local persistence active.
- **Alternatives:** host approval may be required before a new peer receives document state.
- **Errors:** unsupported network route is surfaced; local document remains usable and unchanged.
- **Postconditions:** temporary session is active and host can see connection state and participants.
- **Acceptance:** FR-025..FR-034; NFR-006..NFR-008, NFR-014.

### UC-07: Join a session from an invitation

- **Actors/roles:** peer participant, initially pending admission.
- **Preconditions:** a valid unexpired invitation is available; application can parse its deep link or pasted URL.
- **Trigger/input:** participant opens or pastes the link.
- **Main flow:** parse the identifier and secret without logging them; connect; wait for host admission; receive initial state; display assigned role.
- **Alternatives:** invalid, expired, or revoked invitations are rejected; host may grant read-only access.
- **Errors:** relay/TURN/network failure provides retry or cancel; no partial local document is silently created.
- **Postconditions:** participant is connected with explicit role and current document state.
- **Acceptance:** FR-027..FR-033 and NFR-006..NFR-008.

### UC-08: Admit, assign, or revoke a participant

- **Actors/roles:** session host.
- **Preconditions:** host owns an active session and participant is pending or connected.
- **Trigger/input:** host approves, rejects, changes role, revokes, or closes.
- **Main flow:** apply the decision at the authorization boundary; update participant state; notify both sides; record a non-secret local audit event.
- **Alternatives:** host may close all sessions; expiry may revoke automatically.
- **Errors:** if enforcement cannot be confirmed, the peer is disconnected and the document remains local.
- **Postconditions:** the peer cannot continue using permissions that were removed for future operations.
- **Acceptance:** FR-030..FR-034; BR-005 and BR-006.

### UC-09: Ask Codex to analyze or propose an edit

- **Actors/roles:** local user; Codex provider is an untrusted proposer.
- **Preconditions:** user opted into AI and completed supported authentication; a document is open.
- **Trigger/input:** user submits a prompt and explicitly includes document/selection context.
- **Main flow:** stream a response; parse proposed operations; validate them; show preview and impact; user approves or rejects; apply only approved commands; record the outcome.
- **Alternatives:** user cancels; provider fails; unsupported tool request returns a clear error; user disables AI and continues editing locally.
- **Errors:** invalid or unauthorized operations are rejected without mutation and without leaking tokens/content into logs.
- **Postconditions:** no mutation occurs without approval; approved changes are undoable.
- **Acceptance:** FR-035..FR-040, BR-001, BR-003.

### UC-10: Read or propose changes through MCP

- **Actors/roles:** MCP client as read-only caller or proposer; local user remains the decision maker.
- **Preconditions:** MCP server is enabled for an active document; the client has the configured transport.
- **Trigger/input:** client invokes a versioned tool with structured arguments.
- **Main flow:** validate schema and scope; return bounded read results or a change proposal; preview mutation; wait for user approval; apply through the same command boundary.
- **Alternatives:** read-only mode permits reads but rejects mutations; user denies or cancels.
- **Errors:** malformed, stale, out-of-scope, or unauthorized request returns a structured error and changes nothing.
- **Postconditions:** operation is auditable and does not bypass model/session permissions.
- **Acceptance:** FR-041..FR-046, BR-003, BR-004.

### UC-11: Change appearance and language preferences

- **Actors/roles:** local user.
- **Preconditions:** the desktop application is open.
- **Trigger/input:** the user changes the theme control or interface-language setting.
- **Main flow:** select System, Light, or Dark and English or Spanish in Preferences; the application applies the choice and persists it separately from diagrams.
- **Alternatives:** when no preference exists, a supported OS locale/appearance is used; unsupported language falls back to English.
- **Errors:** a preference write failure applies the choice during the session, leaves the active diagram unchanged, and reports the problem. Invalid/missing preferences fall back safely and preserve the previous supported record before migration.
- **Postconditions:** the chosen appearance and interface language are available after restart; document content and history are unchanged.
- **Acceptance:** FR-050..FR-051, FR-016, and accessibility/reduced-motion checks.

The accompanying `editor-workspace` contract reorganizes the implemented UC-01..UC-04 and UC-07 flows into a compact header, Shapes/Structure navigation, canvas, contextual inspector, and responsive drawers. It preserves the command boundary, existing shortcuts, recovery and draw.io confirmation guards. `html.lang`, accessible names, dialogs, help, status, errors, and formatting follow the selected interface locale; user-authored document text remains unchanged. Theme and language must leave document bytes, revision, dirty state, and history unchanged. Native/CI acceptance and fluent human Spanish review remain separate evidence gates.

### UC-12: Use guided onboarding for a verified PMV workflow

- **Actors/roles:** local user.
- **Preconditions:** the tour describes a workflow included in the reviewed PMV journey inventory.
- **Trigger/input:** the user starts or restarts a guide from Help.
- **Main flow:** review a spotlight/callout sequence; navigate by keyboard or visible controls; close the guide at any time.
- **Alternatives:** the user skips the guide; a missing target produces a fallback step; a workflow not implemented in the PMV has no tour.
- **Errors:** a changed or unavailable UI target must not block normal editing or leave stale focus.
- **Postconditions:** the user can resume normal work with the same document, route, draft, selection, and history.
- **Acceptance:** FR-052, accessibility checks, and confirmation that no file/network/provider operation occurs.

### UC-13: Group and ungroup eligible diagram elements (proposed)

- **Actors/roles:** local user as document editor.
- **Preconditions:** a writable document and an approved grouping contract are available.
- **Trigger/input:** the user selects eligible elements and chooses Group or Ungroup.
- **Main flow:** validate membership and apply the group command through the canonical document boundary.
- **Alternatives:** invalid membership or unsupported nesting/cross-layer combinations are rejected without partial mutation.
- **Errors:** failed grouping leaves the document and history unchanged.
- **Postconditions:** supported group membership is serialized and can be undone/redone.
- **Acceptance:** FR-053 and the grouping behavior approved after WP-14.1 discovery; this use case is not yet authorized for implementation.

## Traceability map

| Requirement range | Use cases                        | WPs                        | OpenSpec capability                                                 |
| ----------------- | -------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| FR-001..004       | UC-01, UC-02                     | WP-01, WP-04               | Desktop Application, Canvas Editing                                 |
| FR-005..011       | UC-01, UC-02, UC-09, UC-10       | WP-02, WP-04, WP-09, WP-10 | Document Model, Canvas Editing, Diagram Shapes                      |
| FR-012..016       | UC-01                            | WP-03                      | Local Persistence, History & Recovery                               |
| FR-017..020       | UC-03                            | WP-05                      | Shape Catalog, Diagram Shapes, Security & Privacy                   |
| FR-021..024       | UC-04, UC-05                     | WP-06                      | draw.io Compatibility, Import & Export                              |
| FR-025..028       | UC-06, UC-07                     | WP-07, WP-08               | P2P Collaboration, Presence & Awareness                             |
| FR-029..034       | UC-06..UC-08                     | WP-08                      | Secure Session Invitations, Security & Privacy                      |
| FR-035..040       | UC-09                            | WP-09                      | Codex Embedded Chat                                                 |
| FR-041..046       | UC-10                            | WP-10                      | MCP Integration                                                     |
| FR-047..049       | Not applicable before tools ship | WP-12                      | User-Facing Codex Skills                                            |
| FR-050..051       | UC-11                            | WP-13                      | User Preferences, Localization                                      |
| FR-052            | UC-12                            | WP-15                      | Guided Onboarding                                                   |
| FR-053 (proposed) | UC-13                            | WP-14                      | Document Model, Canvas Editing, History & Recovery                  |
| NFR-001..014      | UC-01..UC-10                     | WP-00, WP-11               | Quality & Testing, Cross-Platform Compatibility, Security & Privacy |
| NFR-015           | Release packaging                | WP-11                      | Desktop Application, Cross-Platform Compatibility                   |
