# PeerCanvas delivery plan

Status: planning baseline established 2026-11-07; S0–S3 are complete on `main` as of 2026-11-13. S4 is the current open milestone; the S7–S10 roadmap additions are recorded here. This plan does not authorize product implementation by itself.

This file is the canonical roadmap and work-package ledger. Product behavior and acceptance requirements live in the [product definition](docs/requirements/product-definition.md); versioned capability contracts live in OpenSpec; GitHub Issues track execution. Update this file when scope, dependencies, estimates, sprint assignments, or risks change.

## Delivery rules

- Branch flow: short-lived **feature/** branches start from **dev**; pull requests target **dev**; completed sprint batches move from **dev** to **main** by pull request. **main** is the default stable branch.
- Use merge commits. Disable squash and rebase merges. Delete a merged feature branch.
- Do not create **test** as a long-lived branch.
- One parent issue per work package. Each OpenSpec task is a native child issue under that parent; implementation PRs close the relevant child issue and reference the parent WP. The parent closes only when all children and parent acceptance criteria are complete. Do not open placeholder PRs.
- Agents commit and push only when the user explicitly authorizes those actions for the task; the maintainer owns merges. Never add AI attribution.
- OpenSpec describes one coherent behavior change at a time. It does not replace this roadmap, sprint tracking, or GitHub Issues.
- A planning estimate is person-days, not elapsed calendar time. Two-week sprint boxes are an initial cadence only; capacity and velocity are unknown.
- Requirements and architecture marked provisional are not implementation authorization. A material change to scope or externally visible behavior returns for review.

## Product boundary

The first product milestone is a local-first desktop diagram editor for Windows, macOS, and Linux, using Tauri 2, React, TypeScript, Vite, and Weave.js. Planned capabilities include a document model, editing, local persistence and recovery, a searchable shape catalog, draw.io import/export, optional P2P collaboration and secure invitations, and optional Codex/MCP tools.

WP-04.1 and WP-04.2 provide in-memory editing. S1 persistence and S2 local editing were promoted to `main` by PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106), merged as `a2d9837`. The app supports versioned `.peercanvas` save/open, migration, recovery, and local editing, but this source promotion does not publish an installer or establish supported OS versions. The S7 icon-packaging, S8 preferences, S9 grouping, and S10 PMV-onboarding work remain planned and are not implementation approvals. Invitation authorization, relay/TURN policy, shape asset licensing, exact draw.io parity, and OpenAI client registration remain open pending experiments or review.

## Work packages

Effort ranges are initial engineering estimates. They exclude release administration and external review time.

| ID    | Package and objective                                                                              | Requirements / OpenSpec                                                                                                               | Dependencies         | Estimate |
| ----- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------: |
| WP-00 | Engineering foundation: repository, policies, CI, OpenSpec, traceability, local developer workflow | NFR-010..013; Desktop Application, Quality & Testing, Security & Privacy                                                              | None                 |   3-5 PD |
| WP-01 | Tauri + Weave compatibility spike and minimal canvas integration                                   | FR-001..004; Desktop Application, Canvas Editing, Cross-Platform Compatibility                                                        | WP-00                |   4-7 PD |
| WP-02 | Canonical document model, command boundary, IDs, pages, layers, nodes, edges                       | FR-005..011; Document Model                                                                                                           | WP-01                |  6-10 PD |
| WP-03 | Versioned `.peercanvas` save/open, snapshots, recovery and migration                               | FR-012..016; Local Persistence, History & Recovery                                                                                    | WP-02                |  6-10 PD |
| WP-04 | Core canvas editing, selection, transforms, connectors, properties and undo/redo                   | FR-004..011; Canvas Editing                                                                                                           | WP-02, WP-03         | 10-16 PD |
| WP-05 | Shape catalog manifest, search, categories, provenance and safe SVG rendering                      | FR-017..020; Diagram Shapes, Shape Catalog, Security & Privacy                                                                        | WP-02                |  6-10 PD |
| WP-06 | draw.io import/export adapter and compatibility fixtures                                           | FR-021..024; draw.io Compatibility, Import & Export                                                                                   | WP-02, WP-05         |  8-14 PD |
| WP-07 | Yjs synchronization contract and WeaveStoreP2P adapter                                             | FR-025..027, FR-028 (transport state), FR-034 (network loss); P2P Collaboration, Presence & Awareness                                 | WP-01, WP-02, WP-03  |  8-14 PD |
| WP-08 | Peer session lifecycle, invitations, participant approval, roles and revocation                    | FR-028 (participant awareness), FR-029..034 (session lifecycle); Secure Session Invitations, Presence & Awareness, Security & Privacy | WP-07                |  8-14 PD |
| WP-09 | Optional Codex conversation UI and provider boundary                                               | FR-035..040; Codex Embedded Chat                                                                                                      | WP-02, WP-04         |  8-13 PD |
| WP-10 | MCP document tools, proposal/approval workflow and audit events                                    | FR-041..046; MCP Integration                                                                                                          | WP-02, WP-04, WP-09  |  8-14 PD |
| WP-11 | Cross-platform, security, accessibility, performance, recovery and icon-packaging hardening        | NFR-001..015; Cross-Platform Compatibility, Quality & Testing, Security & Privacy                                                     | WP-03..WP-10         | 10-18 PD |
| WP-12 | User-facing Codex skills and community integration guide                                           | FR-047..049; User-Facing Codex Skills                                                                                                 | WP-10, WP-11         |   4-7 PD |
| WP-13 | Local appearance and language preferences                                                          | FR-050..051; User Preferences, Localization                                                                                           | WP-03                |   5-8 PD |
| WP-14 | Validated diagram grouping and ungrouping; exact scope follows discovery                           | Proposed FR-053/UC-13; OpenSpec after discovery                                                                                       | WP-02, WP-04         |      TBD |
| WP-15 | Accessible onboarding for reviewed PMV workflows                                                   | FR-052/UC-12; Guided Onboarding                                                                                                       | WP-13, PMV workflows |      TBD |

### WP-00: Engineering foundation

- **Scope:** versioned product definition, initial architecture and ADRs, OpenSpec, maintainer-supplied branding assets and [editor-shell direction brief](docs/branding/editor-shell-direction.md), contributor policies, CI/security workflows, GitHub labels/milestones/parent-subissue hierarchy, PR templates, and maintainer handoff.
- **Components:** repository root, docs, OpenSpec, GitHub configuration, scripts.
- **Activities/contracts:** make requirements traceable to use cases, OpenSpec capabilities, WPs, Issues, PRs, and checks; document what is verified versus proposed.
- **Acceptance:** repository instructions and templates are present; OpenSpec validates; README and native app icon use maintainer branding; CI definitions cover frontend checks on supported hosted OS runners; each OpenSpec task maps to a native sub-issue under its WP; GitHub setup script is idempotent; no editor feature behavior is added.
- **Tests/DoD:** validate Markdown/OpenSpec/workflow syntax, shell syntax, and run only scaffold checks that can execute locally; CI check names are recorded before protection requires them; all linked documents resolve.
- **Risk:** a mismatch between required check names and CI jobs could block merges. Verify the exact Actions names on a passing PR before running the setup script; the current `main` and `dev` protections were API-verified on 2026-11-07.
- **Issue / PR:** WP-00 Engineering foundation; one PR to **dev**, then promotion with the sprint batch.

### WP-01: Tauri and Weave compatibility spike

- **Scope:** use an isolated test-only Tauri/WebView probe to adapt the required components from the official `weavejs-frontend` and mount the pinned Weave renderer on Windows, macOS, and Linux; confirm selection, transforms, connector rendering, and one in-memory Weave-store-backed edit using a controlled fixture.
- **Dependencies/components:** WP-00; frontend, Tauri shell, one isolated Weave adapter, selected components from the official frontend example.
- **Activities/contracts:** compare WeaveStoreStandalone and renderer packages; selectively port required React composition into the test probe while retaining Tauri/Vite and excluding the example's TanStack Start application runtime; pin a compatible React/ReactDOM range; record the adopted upstream commit, source files, notices, platform WebView differences, and native prerequisites. Exclude the probe and its instrumentation from normal production builds, which retain the engineering scaffold. The fixture's temporary store does not select or implement durable local persistence; that decision remains in WP-03.
- **Acceptance:** record native launch, rendering, selection, transforms, connector rendering, and one in-memory store-backed node edit on each declared OS, or capture the unsupported behavior in a blocking issue with an explicit fallback decision. A build alone does not satisfy the native interaction checks. No broader editor UI is part of this spike.
- **Tests/DoD:** use the same controlled fixture and smoke procedure on each native platform; preserve the exact OS/WebView/dependency matrix and separate compilation from native interaction evidence; update ADR-0001 and the compatibility table.
- **Effort/risk:** 4-7 PD; the test-only probe passes on the runner images in the [platform matrix](docs/support/platform-matrix.md). Product adapter behavior and minimum supported OS/WebView floors remain open; do not treat this probe as release support.
- **Issue / PR:** WP-01 Validate Tauri and Weave.js compatibility; PR to **dev**.

### WP-02: Document model and command boundary

- **Scope:** one canonical model for documents, pages, layers, shapes, connectors, styles, metadata, and stable IDs; define typed commands and validation at the model boundary.
- **Requirements/spec:** FR-005..011; Document Model.
- **Dependencies/components:** WP-01; domain model and Weave adapter.
- **Activities/contracts:** define versioned schema, command result/errors, selection references, migration policy, and invariant checks.
- **Acceptance:** commands operate without simulating canvas input; invalid references fail without partial mutation; serialization round-trips supported model data.
- **Tests/DoD:** unit/property tests for invariants and stable serialization; examples documented; traceability updated.
- **Effort/risk:** 6-10 PD; Weave's data model must not become a second divergent source of truth.
- **Issue / PR:** WP-02 Define canonical diagram document model; PR to **dev**.

### WP-03: Local persistence and recovery

- **Scope:** implement save/open, atomic replacement, snapshots, crash recovery, and user-visible errors for one durable local source of truth.
- **Requirements/spec:** FR-012..016; Local Persistence, History & Recovery.
- **Dependencies/components:** WP-02; persistence adapter, Tauri filesystem or database integration.
- **Activities/contracts:** ADR-0003 selects user-managed versioned `.peercanvas` JSON as the only durable document; preferences remain separate. The S2 PR #104 implements the native adapter and recovery policy.
- **Acceptance:** a document survives normal close/reopen and injected interruption; recovered content is complete or the user receives a non-destructive recovery option. The user chooses Reopen last; startup does not auto-open a file.
- **Tests/DoD:** integration tests with representative fixtures, migration tests, corruption handling, and OS-specific storage tests on Windows, macOS, and Linux.
- **Effort/risk:** 6-10 PD; storage tests pass in cross-platform CI. Additional Windows/Linux native editor UI smoke is release evidence under WP-11.
- **Issue / PR:** WP-03 Implement local persistence and recovery; PR to **dev**.

### WP-04: Core canvas editing

- **Scope:** add, select, move, resize, connect, and inspect elements; support pages/layers and undo/redo using Weave capabilities where they meet requirements. Grouping is deferred to S9/WP-14; discovery is tracked by [#89](https://github.com/furancho-labs/Peer2Canvas/issues/89) under parent [#91](https://github.com/furancho-labs/Peer2Canvas/issues/91).
- **Requirements/spec:** FR-004..011; Canvas Editing.
- **Dependencies/components:** WP-02 and WP-03; canvas, inspector, tool panels, command history.
- **Acceptance:** user can build and reopen a simple architecture diagram; keyboard and pointer workflows have equivalent essential actions; undo/redo restores model state.
- **Tests/DoD:** model-level unit tests, renderer integration tests, keyboard/accessibility checks, and stable screenshot fixtures.
- **Effort/risk:** 10-16 PD; Weave feature coverage and canvas accessibility need an early spike.
- **Issue / PR:** WP-04 Deliver core diagram editing; PR to **dev**.

### WP-05: Shape catalog

- **Scope:** catalog manifest, offline search/browse, approved shape insertion with stable references, asset attribution, and SVG preview safety.
- **Requirements/spec:** FR-017..020; Diagram Shapes, Shape Catalog, Security & Privacy.
- **Dependencies/components:** WP-02; catalog service, renderer, library metadata.
- **Activities/contracts:** define asset schema with source URL, version, license, attribution, hash and review status; do not bundle a logo or stencil until rights are checked.
- **Acceptance:** offline search returns usable approved entries in deterministic order; adding an entry stores its stable ID/version; unsafe SVG constructs are rejected; no asset with unknown redistribution rights is bundled.
- **Tests/DoD:** catalog and schema-migration fixtures, keyboard/accessibility checks, malicious SVG tests, and a direct/transitive license and asset-rights audit.
- **Effort/risk:** 6-10 PD; third-party logo and stencil rights are not inferred from the source repository license.
- **Issue / PR:** WP-05 Build a licensed searchable shape catalog; PR to **dev**.

### WP-06: draw.io compatibility

- **Scope:** import/export adapter, format detection, mapping report, preserved unsupported content and golden fixtures.
- **Requirements/spec:** FR-021..024; draw.io Compatibility, Import & Export.
- **Dependencies/components:** WP-02 and WP-05; adapter, serializers, fixture corpus.
- **Acceptance:** declared `.drawio`/`.xml` samples round-trip all supported semantics; imports report unsupported content before replacement; bounded safe fragments retain mapped source IDs and relationships; fragments whose mapped targets were deleted are reported and omitted from export; overwrite confirmation and failed-write recovery protect prior files.
- **Tests/DoD:** licensed first-party golden fixtures, malformed/hostile XML and compressed-input tests, schema migration, round-trip comparisons, and documented compatibility/parser limits.
- **Effort/risk:** 8-14 PD; draw.io's XML model and compressed variants make full parity unrealistic for the first release.
- **Issue / PR:** WP-06 Import and export draw.io documents; PR to **dev**.

### WP-07: P2P synchronization

- **Scope:** Yjs state exchange, Trystero transport adapter, initial sync, disconnect/reconnect, and awareness routing.
- **Requirements/spec:** FR-025..028 (transport and connection-state aspects), FR-034 (protection during network loss); P2P Collaboration, Presence & Awareness.
- **Dependencies/components:** WP-01..WP-03; collaboration adapter and session lifecycle.
- **Activities/contracts:** host-sequence peer command proposals through `executeCommand`; rebase only proposals whose affected IDs do not overlap intervening commits; reject overlapping or too-old proposals with the current state. Expose connection/retry status and ephemeral awareness through the session API for WP-08's UI to consume; do not add invitation controls to S4. The host is the only Yjs document writer; the session Y.Doc is transient, and `.peercanvas` remains the only durable document. The initial adapter uses Trystero 0.26 MQTT-over-WebSocket signaling; explicit public broker endpoints are replaceable, and this does not select a permanent operator or guarantee availability.
- **Acceptance:** disjoint simultaneous proposals converge in host order; conflicting proposals are rejected without invalidating the canonical document; a peer becomes ready only after a complete validated snapshot and commit tail; the session API exposes sanitized connection failure/retry state; transport loss leaves the host's last durable `.peercanvas` intact and unsaved changes follow Save/Discard/Cancel.
- **Tests/DoD:** deterministic Yjs update tests plus native WebRTC evidence across available WebViews and LAN/signaling/STUN/TURN cases; record unavailable topologies and do not claim that direct connectivity always works.
- **Gate:** WP-07.1/#35 records the host-sequenced concurrency, validation, sync-readiness, per-user undo, and durability contract before WP-07.2/#36 implementation; that contract is now recorded in ADR-0002 and OpenSpec.
- **Effort/risk:** 8-14 PD; default Trystero STUN endpoints are public Google and Cloudflare services. A TURN provider, credentials, cost, and the final relay policy remain open pending WP-07.3 evidence.
- **Current delivery evidence:** WP-07.2 has host-sequenced command handling, validated Yjs checkpoints/commit tails, reconnect synchronization, sanitized network errors, and deterministic tests merged to `dev` by PR #133. The canvas-only native smoke passes on macOS/Linux/Windows CI. Optional peer smoke uses an iframe inside a single native WebView. Its local/public modes reach signaling and gather host/server-reflexive candidates, but ICE remains `checking` on this Mac. Manual CI can run the public peer smoke on each OS; that tests WebRTC in the declared native runtimes but does not establish connectivity between native WebViews, devices, independent networks, NAT/firewalls, or TURN. WP-07.3 remains open for those cases.
- **Issue / PR:** WP-07/#8; implementation PR [#133](https://github.com/furancho-labs/Peer2Canvas/pull/133) merged to **dev**; WP-07.3/#37 remains open.

### WP-08: Secure sharing and presence

- **Scope:** temporary share lifecycle, invite links, host approval, read/edit capabilities, participant list, revoke/close, and presence.
- **Requirements/spec:** FR-028 (participant-presence aspect), FR-029..034 (session-lifecycle aspects); Secure Session Invitations, Presence & Awareness, Security & Privacy.
- **Dependencies/components:** WP-07; Web Crypto, Tauri deep links, session authorization boundary.
- **Acceptance:** secrets are high entropy, never placed in query strings or logged, and are redacted from diagnostic output; host can deny/revoke access; read-only peers cannot mutate through model commands; expiry, revocation, or session close does not delete or overwrite the host's last durable `.peercanvas` file.
- **Tests/DoD:** protocol tests for expired/revoked invitations, unauthorized mutations, copied links, host loss, and deep-link parsing; threat model reviewed.
- **Effort/risk:** 8-14 PD; information already received cannot be remotely erased; define scope of revocation honestly.
- **Issue / PR:** WP-08 Secure peer sharing and participant controls; PR to **dev**.

### WP-09: Optional Codex assistant

- **Scope:** adapt the shadcn chatbot template as the starting point for an opt-in embedded chat; provide a provider interface, persistent conversation metadata, streaming, cancellation, diagram/selection context, preview and approval. Keep PeerCanvas's Tauri/Vite structure and provider boundary; do not adopt the template's Next.js routes or Vercel AI SDK backend.
- **Requirements/spec:** FR-035..040; Codex Embedded Chat.
- **Dependencies/components:** WP-02 and WP-04; assistant UI, app-server process, secure token storage.
- **Acceptance:** editor works without AI credentials; user can inspect and approve a proposed model change before it is applied; token and diagram content do not enter logs.
- **Tests/DoD:** mock provider tests, cancellation/error tests, approval state tests; validate auth flow and terms before production registration.
- **Effort/risk:** 8-13 PD; OpenAI Sign in with ChatGPT plan usage is documented for open-source/local apps, but is a preview and the current eligibility, registration, limits, and commercial-use terms must be rechecked at implementation.
- **Issue / PR:** WP-09 Add optional Codex assistant; PR to **dev**.

### WP-10: MCP integration

- **Scope:** model-level read tools, selection lookup, search, change proposals, guarded apply, layout proposal, and export.
- **Requirements/spec:** FR-041..046; MCP Integration, Security & Privacy.
- **Dependencies/components:** WP-02, WP-04, WP-09; MCP server and app command boundary.
- **Acceptance:** every mutating tool is schema-validated, scoped to the active document, previewed, and explicitly approved; AI cannot bypass model invariants or sharing permissions.
- **Tests/DoD:** protocol conformance tests, malformed input tests, approval and denial tests, audit event tests.
- **Effort/risk:** 8-14 PD; transport and process ownership depend on the Codex app-server spike.
- **Issue / PR:** WP-10 Add model-level MCP tools; PR to **dev**.

### WP-11: Quality and product hardening

- **Scope:** multiplatform validation, accessibility, performance baselines, dependency/security scanning, fault recovery, reproducible native icon packaging, CI feedback and cache reliability, and release readiness.
- **Requirements/spec:** NFR-001..015; Cross-Platform Compatibility, Quality & Testing, Security & Privacy, Desktop Application.
- **Dependencies/components:** WP-03..WP-10; all supported desktop targets.
- **Acceptance:** no open critical/high security issue without maintainer disposition; all declared support platforms pass CI and a recorded manual smoke matrix; native bundles contain the authorized PeerCanvas icon; no performance claim lacks a named fixture and machine.
- **Tests/DoD:** full CI plus manual release checklist, dependency and asset license review, vulnerability and recovery exercises.
- **Effort/risk:** 10-18 PD; automated runners do not prove all real WebView, deep-link, or network behavior.
- **Issue / PR:** WP-11 Harden cross-platform quality and security; [CI pipeline task #111](https://github.com/furancho-labs/Peer2Canvas/issues/111), [icon package task #90](https://github.com/furancho-labs/Peer2Canvas/issues/90); PRs to **dev**.

### WP-12: User-facing Codex skills and ecosystem

- **Scope:** package and document skills only after real MCP tools, schemas and security controls are implemented and verified.
- **Requirements/spec:** FR-047..049; User-Facing Codex Skills.
- **Dependencies/components:** WP-10 and WP-11; skill package, examples and docs.
- **Acceptance:** every skill calls only verified tools; examples work against the published version; user can remove/disable the integration without breaking the editor.
- **Tests/DoD:** validate skill manifests and commands using current official OpenAI tools; security review and installation documentation.
- **Effort/risk:** 4-7 PD; skill distribution and packaging compatibility may change.
- **Issue / PR:** WP-12 Publish Codex skills and integration guide; PR to **dev**.

### WP-13: Desktop appearance and language preferences

- **Scope:** add persistent light/dark application appearance and English/Spanish interface language, separate from document content and history.
- **Requirements/spec:** FR-050..051 and UC-11; OpenSpec `desktop-preferences` (`user-preferences`, `localization`).
- **Dependencies/components:** WP-03/#4; app preferences, theme tokens, language resources, accessibility labels.
- **Acceptance:** appearance and language survive restart; theme switching leaves diagram paper, explicit styles, document revision, dirty state, and history unchanged; EN/ES resources are complete and Spanish copy is reviewed; transitions respect reduced motion.
- **Tests/DoD:** preference migration, key/parameter parity, localized errors and labels, theme/locale checks on supported platforms.
- **Effort/risk:** 5-8 PD; preserve `last_document` in the existing preference record and keep the canvas paper independent from theme.
- **Issue / PR:** parent [#93](https://github.com/furancho-labs/Peer2Canvas/issues/93), children #95, #96, #100, and #101; milestone S8.

### WP-14: Diagram grouping

- **Scope:** discover and then deliver validated grouping and ungrouping through the document command boundary. Exact behavior remains open until the discovery child is reviewed.
- **Requirements/spec:** proposed FR-053 and UC-13; create the grouping OpenSpec change after discovery.
- **Dependencies/components:** WP-02/#2 and WP-04/#6; document model, selection, history, persistence, and connector semantics.
- **Acceptance:** discovery resolves supported membership, nesting, page/layer restrictions, selection, connector behavior, serialization, migration, and undo/redo; reviewed implementation and verification children are then added to S9.
- **Tests/DoD:** after discovery, test valid/invalid groups, persistence round trips, and history recovery against the approved contract.
- **Effort/risk:** TBD after discovery; #89 is planning only and does not authorize implementation.
- **Issue / PR:** parent [#91](https://github.com/furancho-labs/Peer2Canvas/issues/91), discovery child [#89](https://github.com/furancho-labs/Peer2Canvas/issues/89); milestone S9.

### WP-15: PMV guided onboarding

- **Scope:** audit the finished PMV, choose the useful tour count, and deliver localized accessible tours only for implemented workflows.
- **Requirements/spec:** FR-052 and UC-12; OpenSpec `guided-onboarding`.
- **Dependencies/components:** stable PMV journeys, WP-13 localization/theme; isolated local preview and spotlight/callout shell.
- **Acceptance:** the final tour inventory is reviewed; tours can be restarted, navigated by keyboard, closed with focus restored, and do not change the user's active document, route, draft, or history.
- **Tests/DoD:** verify unique/repositioned targets, fallback states, small windows, both themes/languages, reduced motion, and absence of file/network/provider calls.
- **Effort/risk:** TBD after the journey audit; UC-01..UC-10 are candidates, not a promise of ten tours.
- **Issue / PR:** parent [#92](https://github.com/furancho-labs/Peer2Canvas/issues/92), children #94, #97, #102, and #103; milestone S10.

## Sprint sequence

The separate [UI demonstration](docs/development/ui-mock.md), tracked locally by OpenSpec `ui-mock` and supplementary issue #81, supports review with simulated outcomes. It is not the production editor and does not satisfy product-WP acceptance.

Each box is an initial two-week iteration, not a delivery date. If the package estimate exceeds available capacity, split it into acceptance-complete slices and carry the remainder. No velocity is assumed.

S0 delivered the bounded WP-01 compatibility gate through a test-only probe. Its in-memory fixture did not implement the canonical document model, durable storage, or the useful local editor planned for WP-02, WP-03, and WP-04. The current WP-04.1 implementation is separate from that S0 probe.

S0 implementation and native evidence are complete. Promotion PR #74 (`d84cfce`) merged the sprint to `main`; all eight S0 issues and milestone #1 are closed, and the Project Board marks them Done.

S1 and S2 are complete on `main`. Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged as `a2d9837`, closed the S1/S2 work-package and task issues (#2, #4, #6, and #19–#24), and the Project Board marks the related issues Done. Milestones #2 (S1) and #3 (S2) are closed. All eight required checks passed. The optional Gitleaks job did not scan because the organization has no `GITLEAKS_LICENSE`; this promotion has no secret-scan result.

| Sprint | Goal                                   | Packages     | Exit evidence                                                                                                                             |
| ------ | -------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S0     | Foundation and feasibility gates       | WP-00, WP-01 | OpenSpec/CI baseline and branded shell brief; native canvas smoke matrix or blocking issues with fallback decisions; approved ADR updates |
| S1     | Canonical data and durable local files | WP-02, WP-03 | versioned model; save/open/recovery acceptance evidence                                                                                   |
| S2     | Useful local editor                    | WP-04        | create, edit, connect, undo and reopen a small diagram                                                                                    |
| S3     | Reusable assets and interoperability   | WP-05, WP-06 | licensed fixture catalog and declared draw.io subset with round-trip evidence                                                             |
| S4     | Collaboration foundation               | WP-07        | Validated Yjs convergence, recorded LAN/NAT outcomes, and host-file preservation through transport loss                                   |
| S5     | Safe peer sessions                     | WP-08        | Invite approval, permission enforcement, expiry/revocation evidence, and host-file preservation through session lifecycle events          |
| S6     | Optional AI and model tools            | WP-09, WP-10 | provider fallback, preview/approval, MCP protocol and security tests                                                                      |
| S7     | Hardening and ecosystem                | WP-11, WP-12 | release checklist, supported OS evidence, verified skill package, reproducible native app icons                                           |
| S8     | Desktop experience preferences         | WP-13        | persistent light/dark theme, English/Spanish resources, cross-platform preference evidence                                                |
| S9     | Diagram grouping                       | WP-14        | reviewed grouping contract, validated group operations, persistence and undo/redo evidence                                                |
| S10    | PMV onboarding                         | WP-15        | audited journey inventory and localized, accessible tours for verified PMV workflows                                                      |

S1, S2, and S3 are complete on `main`; S4 is the active implementation sprint for WP-07. Grouping is outside S2 and belongs to S9/WP-14, with discovery child #89; it did not block S2 closure. WP-08/S5 and later work remain planning only.

### Critical path and parallel work

Critical path: WP-00 → WP-01 → WP-02 → WP-03 → WP-04 → WP-07 → WP-08 → WP-10 → WP-11.

WP-05 can start after the model contract is stable and run alongside persistence/editor work. WP-06 depends on the model contract and can overlap with basic editor work. WP-09 UI research and app-server process experiments can proceed in parallel with shape catalog work, but mutating MCP tools depend on WP-02 and approval controls. WP-12 is blocked until tools and their safety rules are real.

The remaining external decisions include the minimum supported OS/WebView floor, TURN fallback/credentials, deep-link behavior, and eligibility for ChatGPT-plan inference.

## Issue and PR map

Create one parent GitHub Issue for each WP, linked to the requirements and OpenSpec capabilities above. Every implementation checkbox has one native child issue under its WP parent, with the same sprint milestone. A task PR references its child issue; the parent WP closes only when every child is complete and the parent acceptance criteria are verified. Use sprint milestones S0–S10. Split a child only when discovery yields independently reviewable acceptance criteria. Do not open PRs for planned work.

The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) contains all parent and child issues. Its board groups items by Status and shows Milestone and Parent issue fields; the table view remains available from the project selector.

The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) contains 69 items across 16 WP parents, 52 child issues, and the supplementary #81, with 11 sprint milestones. The [sub-issue map](docs/planning/subissue-map.md) is the task-to-issue traceability index. S8–S10 planning issues are Todo; their presence does not authorize implementation.

| WP    | Issue                                                                                                   | Milestone                     |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------- |
| WP-00 | [#1 Engineering foundation](https://github.com/furancho-labs/Peer2Canvas/issues/1)                      | S0 - Engineering Foundation   |
| WP-01 | [#3 Tauri and Weave compatibility](https://github.com/furancho-labs/Peer2Canvas/issues/3)               | S0 - Engineering Foundation   |
| WP-02 | [#2 Canonical document model](https://github.com/furancho-labs/Peer2Canvas/issues/2)                    | S1 - Document and Persistence |
| WP-03 | [#4 Local persistence and recovery](https://github.com/furancho-labs/Peer2Canvas/issues/4)              | S1 - Document and Persistence |
| WP-04 | [#6 Core diagram editing](https://github.com/furancho-labs/Peer2Canvas/issues/6)                        | S2 - Core Canvas Editor       |
| WP-05 | [#5 Licensed shape catalog](https://github.com/furancho-labs/Peer2Canvas/issues/5)                      | S3 - Shapes and Interchange   |
| WP-06 | [#7 draw.io import/export](https://github.com/furancho-labs/Peer2Canvas/issues/7)                       | S3 - Shapes and Interchange   |
| WP-07 | [#8 Yjs and Trystero transport](https://github.com/furancho-labs/Peer2Canvas/issues/8)                  | S4 - P2P Collaboration        |
| WP-08 | [#10 Secure sharing and participants](https://github.com/furancho-labs/Peer2Canvas/issues/10)           | S5 - Secure Sharing           |
| WP-09 | [#9 Optional Codex assistant](https://github.com/furancho-labs/Peer2Canvas/issues/9)                    | S6 - Codex and MCP            |
| WP-10 | [#13 MCP tools](https://github.com/furancho-labs/Peer2Canvas/issues/13)                                 | S6 - Codex and MCP            |
| WP-11 | [#11 Cross-platform hardening](https://github.com/furancho-labs/Peer2Canvas/issues/11)                  | S7 - Hardening and Skills     |
| WP-12 | [#12 Verified Codex skills](https://github.com/furancho-labs/Peer2Canvas/issues/12)                     | S7 - Hardening and Skills     |
| WP-13 | [#93 Local appearance and language preferences](https://github.com/furancho-labs/Peer2Canvas/issues/93) | S8 - Desktop Experience       |
| WP-14 | [#91 Diagram grouping](https://github.com/furancho-labs/Peer2Canvas/issues/91)                          | S9 - Diagram Grouping         |
| WP-15 | [#92 PMV onboarding](https://github.com/furancho-labs/Peer2Canvas/issues/92)                            | S10 - PMV Onboarding          |

For implementation, create **feature/WP-xx-short-name** from **dev**, open a PR back to **dev**, and include the relevant FR, OpenSpec change, acceptance evidence, security impact, and issue-closing keyword. At sprint close, open one promotion PR from **dev** to **main** with the batch summary and all checks. Do not merge incomplete work to **main**.

## Open decisions

| Decision                                    | Current position                                                                                                                       | Closure evidence                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Weave package and WebView compatibility     | S0 fixture probe passes on current CI runner images; minimum OS floor and product adapter remain open                                  | [S0 platform matrix](docs/support/platform-matrix.md); product gate in WP-04/WP-11      |
| Durable local store                         | `.peercanvas` JSON selected and merged to `dev`; required CI and backend storage tests pass, with native UI evidence recorded on macOS | WP-03/PR #104 and [ADR-0003](docs/architecture/decisions/ADR-0003-local-persistence.md) |
| P2P relay/STUN/TURN policy                  | Trystero 0.26 MQTT signaling with explicit public endpoints; public Google/Cloudflare STUN defaults; no TURN provider selected         | WP-07 network matrix, metadata/privacy review, service/cost analysis                    |
| Yjs concurrency and invariant policy        | Host-sequenced commands; disjoint stale proposals rebase, overlapping proposals are rejected                                           | WP-07.1/#35; deterministic tests for concurrent, stale, duplicate, and invalid commands |
| Invitation and authorization protocol       | Capability link plus host approval proposed; revocation limits must be explicit                                                        | WP-08 threat review and protocol tests                                                  |
| draw.io parity                              | Selective compatible subset; preserve/report unsupported source                                                                        | WP-06 fixture matrix                                                                    |
| ChatGPT-plan OAuth registration             | Official local OSS path exists in preview; eligibility/terms must be rechecked                                                         | WP-09 legal/technical gate and auth test                                                |
| Shape catalog rights                        | No unverified assets bundled                                                                                                           | WP-05 per-asset license evidence                                                        |
| Supported OS versions and installer formats | Windows/macOS/Linux required; exact OS floor and installers open                                                                       | WP-01/11 compatibility and distribution review                                          |

## Traceability

Stable requirement IDs and use cases are in the [product definition](docs/requirements/product-definition.md). OpenSpec capability specs link their requirements. This plan maps each WP to those requirements/specs. GitHub Issues must carry WP ID and links; PRs close Issues and cite checks. CI check names become required only after they have run and GitHub exposes the exact contexts.
