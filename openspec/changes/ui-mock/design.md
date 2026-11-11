# Design

## Context

See proposal.md for the requested scope. The worktree is based on origin/dev at `ff6ec3f`; the normal app and the isolated S0 native Weave probe are intact. React 18.3.1, Vite 8, Tailwind 3, and Weave 5.7.1 are pinned. Existing development profiles were copied unchanged from the configuration worktree before invocation.

S1 initially supplied only a proposed draft. The maintainer then explicitly authorized the shared pure core in this branch. Its frozen interface is recorded in `docs/architecture/shared-document-contract.md`, and the demo imports `src/document` directly. S1 retains persistence and Rust ownership. Direct thread coordination was rejected by an active writer; the subsequent queue successfully recorded the handoff, with owner acknowledgement still pending. The S1 worktree is untouched.

## Goals / Non-Goals

Goals: complete observable UI scenarios; one authoritative semantic document; disposable Weave projection; deterministic in-memory service outcomes; independent technical and visual acceptance.

Non-goals: real persistence, interchange parsers/downloads, collaboration transport, providers, MCP server, credential handling, native changes, release/publication, or completion of production WPs.

## Decisions

### Separate entry and output

Use `src/ui-mock/index.html`, a dedicated entry, and `vite.ui-mock.config.ts` with output `dist-ui-mock/`. Add `ui:mock` and `build:ui-mock` scripts sequentially under coordinator ownership. Keep `src/App*`, `src/main.tsx`, native-smoke sources, and normal Vite configuration untouched. A separate configuration makes build isolation reviewable and avoids competing shared-file ownership. Normal and demo builds must not overwrite each other.

### S1 is the authority

Consume the explicitly authorized shared `src/document/**` exports and the frozen schema/command interface. This module is the single canonical implementation for demo and future S1 integration. Nonvisual adapters own simulated lifecycle and scheduling, while canonical edits remain commands. Weave state is rebuilt from accepted snapshots. Selection, zoom, local history metadata, participants, conversations, and preferences do not become semantic document authorities.

User undo/redo uses forward and inverse validated command batches. Layer focus is transient; it does not add a persisted visibility property. Do not add snapshot replacement, extend the schema, or let direct Weave edits bypass validation. Any future material shared-contract change requires review before integration.

### Deterministic simulated services

Keep `src/ui-mock/services/**` separate from presentation. Expose explicit operation outcomes and controlled scheduling for success, wait, cancellation, and error. Use a session generation to invalidate work after reset/close/scenario replacement. Never import native persistence, provider, networking, browser-storage, or credential APIs. Only bundle-owned fixtures are accepted; no file inputs or downloadable output. Role and proposal approval checks precede canonical command execution. Proposal approval is single-use and bound to the originating document/revision.

### Visual composition

The read-only `peer-visual-designer-opus` consultation completed with reported model `claude-opus-5-5`, no permission denials, no edits, and no further delegation. Proposed composition: persistent simulation banner, compact document/menu bar, tool rail, dominant Weave canvas, collapsible structure/inspector panels, bottom page/zoom/status controls, secondary collaboration/assistant drawers. Home covers recent documents, search, and fixture selection. Retain existing system fonts, spacing steps, neutral tokens, and original brand assets.

Exact brand tokens must be sampled and contrast checked by Claude during implementation. Consultation suggestions to omit service actions or replace every action with an unavailable dialog were not adopted: the user requires full simulated flows. Likewise, the probe's mutable Weave store is not an acceptable semantic authority. The consultation is design input, not visual/native/accessibility acceptance evidence.

### Ownership and model routing

| Profile                     | Owned responsibility/files                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `peer_coordinator`          | Overall architecture, integration-only scripts/config/manifests, OpenSpec and traceability; no UI edits                |
| `peer_explorer`             | Read-only S1/Weave interface inspection                                                                                |
| `peer-visual-designer-opus` | UI design/tokens and a separate final visual validation pass                                                           |
| `peer-frontend-opus`        | UI architecture, shell, and Weave presentation adapter under `src/ui-mock/ui/**`                                       |
| `peer-frontend-sonnet`      | Assigned panels/dialogs and UI behavior tests under `src/ui-mock/ui/**`                                                |
| `peer-frontend-haiku`       | Bounded copy/style corrections assigned after integration                                                              |
| `peer_typescript`           | Shared pure core under `src/document/**` and nonvisual adapters under `src/ui-mock/services/**`; no S1-worktree writes |
| `peer_tests`                | Nonvisual service/contract/isolation tests; no UI changes                                                              |
| `peer_reviewer`             | Independent read-only final technical review                                                                           |

No worker delegates. Every assignment includes exact file ownership, approved artifacts/interfaces, relevant available skills, acceptance, checks, and stop conditions. UI and its tests are written/corrected only by Claude. Do not invoke the frontend fallback. Use copied profiles, not duplicate definitions. Keep at most four agents active; do shared wiring sequentially. Native work is not planned.

## Risks / Trade-offs

- [S1 integration remains unacknowledged] → Keep the authorized shared core and frozen interface explicit; compare contracts before S1 integration, without editing its worktree.
- [Incomplete inverse commands] → Expose undo only for complete inverse batches; no partial undo or direct snapshot replacement.
- [Async completion after reset or rejection] → Session generations, explicit cancellation, revision-bound single-use proposals, and negative tests.
- [Simulations mistaken for features] → Persistent banner and simulated outcome labels; no production issue closures.
- [Renderer edits bypass validation] → Disposable projection and tests of each mutation route.
- [Brand palette unmeasured] → Designer samples existing artwork and validates actual light/dark/focus states.
- [Dependency audit findings] → Record existing findings separately; no unapproved package changes.
- [Missing GitHub demo issue] → Trace to the requirement/WP map locally, record issue as pending, and do not claim existing production child issues close. No GitHub publication is authorized.

## Migration Plan

No data migration or native rollout. Build/run the separate demo only after gates clear. Revert the isolated entry/config/scripts to remove it; the normal shell remains unaffected. No commits, pushes, merges, or publication are authorized.

## Verification

Run format, lint, typecheck, nonvisual contract/isolation tests, Claude-authored UI interaction tests, normal build, demo build, strict OpenSpec validation, and diff review. Inspect normal output for demo/probe markers and demo output for forbidden integrations. Use focused ast-grep patterns for actual network/native/storage call patterns, plus dependency inspection and runtime request observation. Test reset/cancel races, role rejection, stale/double proposal approval, and rejection atomicity.

Claude checks keyboard navigation, modal focus, light/dark/loading/empty/error/wait states and Weave presentation in a browser; the designer then performs a separate visual pass. Independent `peer_reviewer` reviews the final diff and evidence. Frontend/browser checks are not native OS, persistence, transport, provider, or accessibility certification. Record only checks actually executed.
