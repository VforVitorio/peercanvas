# PeerCanvas delivery plan

Status: planning baseline, 2026-11-07; S0 scope, implementation, and evidence reconciled on 2026-11-10. This plan records scope and does not itself authorize implementation beyond the maintainer-approved S0 work.

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

The current shell is not a diagram editor. No feature in that list is implemented. Native packaging format, persistence engine, invitation authorization protocol, relay/TURN policy, shape asset licensing, exact draw.io parity, and OpenAI client registration remain open pending experiments or review.

## Work packages

Effort ranges are initial engineering estimates. They exclude release administration and external review time.

| ID    | Package and objective                                                                              | Requirements / OpenSpec                                                           | Dependencies        | Estimate |
| ----- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------- | -------: |
| WP-00 | Engineering foundation: repository, policies, CI, OpenSpec, traceability, local developer workflow | NFR-010..013; Desktop Application, Quality & Testing, Security & Privacy          | None                |   3-5 PD |
| WP-01 | Tauri + Weave compatibility spike and minimal canvas integration                                   | FR-001..004; Desktop Application, Canvas Editing, Cross-Platform Compatibility    | WP-00               |   4-7 PD |
| WP-02 | Canonical document model, command boundary, IDs, pages, layers, nodes, edges                       | FR-005..011; Document Model                                                       | WP-01               |  6-10 PD |
| WP-03 | Local save/open, SQLite or platform-store decision, snapshots and crash recovery                   | FR-012..016; Local Persistence, History & Recovery                                | WP-02               |  6-10 PD |
| WP-04 | Core canvas editing, selection, transforms, connectors, properties and undo/redo                   | FR-004..011; Canvas Editing                                                       | WP-02, WP-03        | 10-16 PD |
| WP-05 | Shape catalog manifest, search, categories, provenance and safe SVG rendering                      | FR-017..020; Diagram Shapes, Shape Catalog, Security & Privacy                    | WP-02               |  6-10 PD |
| WP-06 | draw.io import/export adapter and compatibility fixtures                                           | FR-021..024; draw.io Compatibility, Import & Export                               | WP-02, WP-05        |  8-14 PD |
| WP-07 | Yjs synchronization contract and WeaveStoreP2P adapter                                             | FR-025..028; P2P Collaboration, Presence & Awareness                              | WP-01, WP-02, WP-03 |  8-14 PD |
| WP-08 | Peer session lifecycle, invitations, participant approval, roles and revocation                    | FR-029..034; Secure Session Invitations, Security & Privacy                       | WP-07               |  8-14 PD |
| WP-09 | Optional Codex conversation UI and provider boundary                                               | FR-035..040; Codex Embedded Chat                                                  | WP-02, WP-04        |  8-13 PD |
| WP-10 | MCP document tools, proposal/approval workflow and audit events                                    | FR-041..046; MCP Integration                                                      | WP-02, WP-04, WP-09 |  8-14 PD |
| WP-11 | Cross-platform, security, accessibility, performance and recovery hardening                        | NFR-001..014; Cross-Platform Compatibility, Quality & Testing, Security & Privacy | WP-03..WP-10        | 10-18 PD |
| WP-12 | User-facing Codex skills and community integration guide                                           | FR-047..049; User-Facing Codex Skills                                             | WP-10, WP-11        |   4-7 PD |

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

- **Scope:** choose one durable local source of truth; implement save/open, atomic replacement, snapshots, crash recovery, and user-visible errors.
- **Requirements/spec:** FR-012..016; Local Persistence, History & Recovery.
- **Dependencies/components:** WP-02; persistence adapter, Tauri filesystem or database integration.
- **Activities/contracts:** benchmark SQLite versus Tauri storage and browser IndexedDB for target document sizes; define file ownership, snapshot cadence, backup/restore, and migration.
- **Acceptance:** a document survives normal close/reopen and injected interruption; recovered content is either complete or the user receives a non-destructive recovery option.
- **Tests/DoD:** integration tests with representative fixtures, migration tests, corruption handling, and OS-specific path tests; decision recorded in ADR-0003.
- **Effort/risk:** 6-10 PD; no storage engine is selected in this planning baseline.
- **Issue / PR:** WP-03 Implement local persistence and recovery; PR to **dev**.

### WP-04: Core canvas editing

- **Scope:** add, select, move, resize, connect, inspect, group basic elements; support pages/layers and undo/redo using Weave capabilities where they meet requirements.
- **Requirements/spec:** FR-004..011; Canvas Editing.
- **Dependencies/components:** WP-02 and WP-03; canvas, inspector, tool panels, command history.
- **Acceptance:** user can build and reopen a simple architecture diagram; keyboard and pointer workflows have equivalent essential actions; undo/redo restores model state.
- **Tests/DoD:** model-level unit tests, renderer integration tests, keyboard/accessibility checks, and stable screenshot fixtures.
- **Effort/risk:** 10-16 PD; Weave feature coverage and canvas accessibility need an early spike.
- **Issue / PR:** WP-04 Deliver core diagram editing; PR to **dev**.

### WP-05: Shape catalog

- **Scope:** catalog manifest, categories, local search, installed libraries, asset attribution and SVG safety.
- **Requirements/spec:** FR-017..020; Diagram Shapes, Shape Catalog, Security & Privacy.
- **Dependencies/components:** WP-02; catalog service, renderer, library metadata.
- **Activities/contracts:** define asset schema with source URL, version, license, attribution, hash and review status; do not bundle a logo or stencil until rights are checked.
- **Acceptance:** search returns only available assets; assets without verified redistribution rights are not bundled; unsafe SVG constructs are rejected or sanitized.
- **Tests/DoD:** catalog fixture tests, SVG sanitizer tests, license manifest audit.
- **Effort/risk:** 6-10 PD; third-party logo and stencil rights are not inferred from the source repository license.
- **Issue / PR:** WP-05 Build a licensed searchable shape catalog; PR to **dev**.

### WP-06: draw.io compatibility

- **Scope:** import/export adapter, format detection, mapping report, preserved unsupported content and golden fixtures.
- **Requirements/spec:** FR-021..024; draw.io Compatibility, Import & Export.
- **Dependencies/components:** WP-02 and WP-05; adapter, serializers, fixture corpus.
- **Acceptance:** declared supported samples round-trip without loss of supported semantics; unsupported features produce a report and original payload is preserved where safe.
- **Tests/DoD:** golden fixture matrix, malicious XML/SVG cases, round-trip comparisons, documented compatibility limits.
- **Effort/risk:** 8-14 PD; draw.io's XML model and compressed variants make full parity unrealistic for the first release.
- **Issue / PR:** WP-06 Import and export draw.io documents; PR to **dev**.

### WP-07: P2P synchronization

- **Scope:** Yjs state exchange, Trystero transport adapter, initial sync, disconnect/reconnect, and awareness routing.
- **Requirements/spec:** FR-025..028; P2P Collaboration, Presence & Awareness.
- **Dependencies/components:** WP-01..WP-03; collaboration adapter and session lifecycle.
- **Activities/contracts:** test local LAN, NAT traversal, STUN/TURN needs, relay behavior, peer limits, and host disconnect; define how host-local persistence receives remote updates.
- **Acceptance:** two peers converge to the same document under concurrent edits; offline edits remain locally available; unsupported network paths fail clearly.
- **Tests/DoD:** deterministic Yjs update tests plus WebRTC integration tests on LAN and relay/TURN cases; no claim that direct connectivity always works.
- **Effort/risk:** 8-14 PD; TURN service availability and cost are open.
- **Issue / PR:** WP-07 Add Yjs and Trystero peer transport; PR to **dev**.

### WP-08: Secure sharing and presence

- **Scope:** temporary share lifecycle, invite links, host approval, read/edit capabilities, participant list, revoke/close, and presence.
- **Requirements/spec:** FR-029..034; Secure Session Invitations, Presence & Awareness, Security & Privacy.
- **Dependencies/components:** WP-07; Web Crypto, Tauri deep links, session authorization boundary.
- **Acceptance:** secrets are high entropy, never placed in query strings or logged, and are redacted from diagnostic output; host can deny/revoke access; read-only peers cannot mutate through model commands.
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

- **Scope:** multiplatform validation, accessibility, performance baselines, dependency/security scanning, fault recovery, and release readiness.
- **Requirements/spec:** NFR-001..014; Cross-Platform Compatibility, Quality & Testing, Security & Privacy.
- **Dependencies/components:** WP-03..WP-10; all supported desktop targets.
- **Acceptance:** no open critical/high security issue without maintainer disposition; all declared support platforms pass CI and a recorded manual smoke matrix; no performance claim lacks a named fixture and machine.
- **Tests/DoD:** full CI plus manual release checklist, dependency and asset license review, vulnerability and recovery exercises.
- **Effort/risk:** 10-18 PD; automated runners do not prove all real WebView, deep-link, or network behavior.
- **Issue / PR:** WP-11 Harden cross-platform quality and security; PR to **dev**.

### WP-12: User-facing Codex skills and ecosystem

- **Scope:** package and document skills only after real MCP tools, schemas and security controls are implemented and verified.
- **Requirements/spec:** FR-047..049; User-Facing Codex Skills.
- **Dependencies/components:** WP-10 and WP-11; skill package, examples and docs.
- **Acceptance:** every skill calls only verified tools; examples work against the published version; user can remove/disable the integration without breaking the editor.
- **Tests/DoD:** validate skill manifests and commands using current official OpenAI tools; security review and installation documentation.
- **Effort/risk:** 4-7 PD; skill distribution and packaging compatibility may change.
- **Issue / PR:** WP-12 Publish Codex skills and integration guide; PR to **dev**.

## Sprint sequence

Each box is an initial two-week iteration, not a delivery date. If the package estimate exceeds available capacity, split it into acceptance-complete slices and carry the remainder. No velocity is assumed.

S0 contains the full bounded WP-01 compatibility gate through a test-only probe. Its in-memory fixture does not implement the canonical document model, durable storage, or the useful local editor planned for WP-02, WP-03, and WP-04. The normal app remains the engineering scaffold.

S0 implementation and native evidence are complete. Promotion PR #74 (`d84cfce`) merged the sprint to `main`; all eight S0 issues and milestone #1 are closed, and the Project Board marks them Done.

| Sprint | Goal                                   | Packages     | Exit evidence                                                                                                                             |
| ------ | -------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S0     | Foundation and feasibility gates       | WP-00, WP-01 | OpenSpec/CI baseline and branded shell brief; native canvas smoke matrix or blocking issues with fallback decisions; approved ADR updates |
| S1     | Canonical data and durable local files | WP-02, WP-03 | versioned model; save/open/recovery acceptance evidence                                                                                   |
| S2     | Useful local editor                    | WP-04        | create, edit, connect, undo and reopen a small diagram                                                                                    |
| S3     | Reusable assets and interoperability   | WP-05, WP-06 | licensed fixture catalog and declared draw.io subset with round-trip evidence                                                             |
| S4     | Collaboration foundation               | WP-07        | Yjs convergence and recorded LAN/NAT outcomes                                                                                             |
| S5     | Safe peer sessions                     | WP-08        | invite approval, permission enforcement, expiry and revocation evidence                                                                   |
| S6     | Optional AI and model tools            | WP-09, WP-10 | provider fallback, preview/approval, MCP protocol and security tests                                                                      |
| S7     | Hardening and ecosystem                | WP-11, WP-12 | release checklist, supported OS evidence, verified skill package                                                                          |

### Critical path and parallel work

Critical path: WP-00 → WP-01 → WP-02 → WP-03 → WP-04 → WP-07 → WP-08 → WP-10 → WP-11.

WP-05 can start after the model contract is stable and run alongside persistence/editor work. WP-06 depends on the model contract and can overlap with basic editor work. WP-09 UI research and app-server process experiments can proceed in parallel with shape catalog work, but mutating MCP tools depend on WP-02 and approval controls. WP-12 is blocked until tools and their safety rules are real.

The remaining external decisions include the minimum supported OS/WebView floor, durable storage choice, TURN fallback/credentials, deep-link behavior, and eligibility for ChatGPT-plan inference.

## Issue and PR map

Create one parent GitHub Issue for each WP-00..WP-12, linked to the requirements and OpenSpec capabilities above. Every checkbox in the OpenSpec task list has one native child issue under its WP parent, with the same sprint milestone. A task PR closes its child issue; the parent WP closes only when every child is complete and the parent acceptance criteria are verified. Use sprint milestones S0..S7. Split a child only when discovery yields independently reviewable acceptance criteria. Do not open PRs for planned work.

The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) contains all parent and child issues. Its board groups items by Status and shows Milestone and Parent issue fields; the table view remains available from the project selector.

The initial public backlog is now represented by 13 parent GitHub Issues, 41 native task sub-issues, and eight milestones. Each OpenSpec task has a child issue under its WP; the [sub-issue map](docs/planning/subissue-map.md) is the exact traceability index. The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) includes all 54 issues; the table view remains available from the project selector.

| WP    | Issue                                                                                      | Milestone                     |
| ----- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| WP-00 | [#1 Engineering foundation](https://github.com/VforVitorio/peercanvas/issues/1)            | S0 - Engineering Foundation   |
| WP-01 | [#3 Tauri and Weave compatibility](https://github.com/VforVitorio/peercanvas/issues/3)     | S0 - Engineering Foundation   |
| WP-02 | [#2 Canonical document model](https://github.com/VforVitorio/peercanvas/issues/2)          | S1 - Document and Persistence |
| WP-03 | [#4 Local persistence and recovery](https://github.com/VforVitorio/peercanvas/issues/4)    | S1 - Document and Persistence |
| WP-04 | [#6 Core diagram editing](https://github.com/VforVitorio/peercanvas/issues/6)              | S2 - Core Canvas Editor       |
| WP-05 | [#5 Licensed shape catalog](https://github.com/VforVitorio/peercanvas/issues/5)            | S3 - Shapes and Interchange   |
| WP-06 | [#7 draw.io import/export](https://github.com/VforVitorio/peercanvas/issues/7)             | S3 - Shapes and Interchange   |
| WP-07 | [#8 Yjs and Trystero transport](https://github.com/VforVitorio/peercanvas/issues/8)        | S4 - P2P Collaboration        |
| WP-08 | [#10 Secure sharing and participants](https://github.com/VforVitorio/peercanvas/issues/10) | S5 - Secure Sharing           |
| WP-09 | [#9 Optional Codex assistant](https://github.com/VforVitorio/peercanvas/issues/9)          | S6 - Codex and MCP            |
| WP-10 | [#13 MCP tools](https://github.com/VforVitorio/peercanvas/issues/13)                       | S6 - Codex and MCP            |
| WP-11 | [#11 Cross-platform hardening](https://github.com/VforVitorio/peercanvas/issues/11)        | S7 - Hardening and Skills     |
| WP-12 | [#12 Verified Codex skills](https://github.com/VforVitorio/peercanvas/issues/12)           | S7 - Hardening and Skills     |

For implementation, create **feature/WP-xx-short-name** from **dev**, open a PR back to **dev**, and include the relevant FR, OpenSpec change, acceptance evidence, security impact, and issue-closing keyword. At sprint close, open one promotion PR from **dev** to **main** with the batch summary and all checks. Do not merge incomplete work to **main**.

## Open decisions

| Decision                                    | Current position                                                                                      | Closure evidence                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Weave package and WebView compatibility     | S0 fixture probe passes on current CI runner images; minimum OS floor and product adapter remain open | [S0 platform matrix](docs/support/platform-matrix.md); product gate in WP-04/WP-11 |
| Durable local store                         | SQLite, Tauri storage, or browser storage not selected                                                | WP-03 failure-recovery benchmark and ADR-0003                                      |
| P2P relay/STUN/TURN policy                  | Trystero + WebRTC candidate; direct connection not guaranteed                                         | WP-07 network matrix, service/cost analysis                                        |
| Invitation and authorization protocol       | Capability link plus host approval proposed; revocation limits must be explicit                       | WP-08 threat review and protocol tests                                             |
| draw.io parity                              | Selective compatible subset; preserve/report unsupported source                                       | WP-06 fixture matrix                                                               |
| ChatGPT-plan OAuth registration             | Official local OSS path exists in preview; eligibility/terms must be rechecked                        | WP-09 legal/technical gate and auth test                                           |
| Shape catalog rights                        | No unverified assets bundled                                                                          | WP-05 per-asset license evidence                                                   |
| Supported OS versions and installer formats | Windows/macOS/Linux required; exact OS floor and installers open                                      | WP-01/11 compatibility and distribution review                                     |

## Traceability

Stable requirement IDs and use cases are in the [product definition](docs/requirements/product-definition.md). OpenSpec capability specs link their requirements. This plan maps each WP to those requirements/specs. GitHub Issues must carry WP ID and links; PRs close Issues and cite checks. CI check names become required only after they have run and GitHub exposes the exact contexts.
