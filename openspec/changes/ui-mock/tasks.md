# Tasks

## 1. Preparation and execution gates

- [x] 1.1 Fetch origin and create a clean feature/ui-mock worktree from updated origin/dev; verify branch/base and preserve existing checkouts.
- [x] 1.2 Incorporate the existing development profiles and license, consult routing guidance, and complete the read-only Opus design consultation; verify profile provenance and reported model/result.
- [x] 1.3 Implement the explicitly maintainer-authorized shared pure S1 core at src/document, using the frozen contract and exports, and inverse validated commands for demo undo/redo; verify strict parse/serialize, atomic mutation/rejection, bounds, IDs, and deterministic results with nonvisual tests. S1 acknowledges UI core ownership; exact-core/canonical-consumption acceptance was granted explicitly by the maintainer on 2026-11-11, with integration separate. Do not modify its worktree or implement storage.
- [x] 1.4 Reconcile this change with the maintainer-authorized shared-core scope and traceability; verify requirement mapping and track the dedicated demo child issue separately from production acceptance; publication is now authorized, with issue/PR delivery blocked by execution policy.
- [x] 1.5 Correct the explicitly reopened nonvisual shared-core S1 compatibility boundary: descriptor-only stable input snapshots and dense data arrays, semantic before/after affected IDs, source/canonical byte ceilings, and the exact readonly public API; preserve frozen oracle bytes and verify the full 35-check suite, public consumer probe, and existing core/service checks in a new disposable harness, with independent review and exact manifests.

## 2. In-memory adapters and fixtures

- [x] 2.1 Implement deterministic empty/multi-page/collaboration/proposal fixtures using approved S1 constructors/types; verify all fixtures validate and rejected edits are atomic.
- [x] 2.2 Implement simulated lifecycle/outcomes/scheduler/reset in nonvisual adapters; verify cancellation/reset/save completion races and write adapter usage documentation.
- [x] 2.3 Implement service-side role checks and revision-bound single-use assistant/MCP proposals; verify viewer denial, stale approval, rejection, cancellation, and repeated approval leave state correct.

## 3. Claude-owned UI and behavior tests

- [x] 3.1 Implement the isolated entry, layout, sampled accessible tokens, light/dark themes, help/preferences/attribution, and simulation banner; verify accessible names, empty/loading/error states, theme reset, and document the run command.
- [x] 3.2 Implement home/recent/search/new/open/rename/close/recovery and simulated save state UI; verify cancellation preserves the active document and recovery requires explicit activation.
- [x] 3.3 Integrate Weave projection, menus/tools/shapes/pages/layers/inspector/selection/zoom/history through agreed commands; verify accepted edits and validated node dragging render, cancellation/permissions/stale revisions/net-zero preserve state, and undo/redo/keyboard paths preserve canonical authority; correct viewport and renderer resource ownership.
- [x] 3.4 Implement import/export progress/errors/incompatibility/cancel flows; verify preview/decline/cancel behavior and no real files/downloads/parsers are used.
- [x] 3.5 Implement participants/invitations/admission/roles/disconnect UI; verify visible fictional invitation labels and viewer mutation denial.
- [x] 3.6 Implement assistant/MCP conversations/cancellation/errors/proposals/approval/rejection UI; verify preview-first, explicit single approval and rejection/cancel behavior.
- [x] 3.7 Complete Claude-authored keyboard/focus/observable-control tests and UI usage documentation; verify modal containment/restoration, shortcuts, accessible diagram structure, and no dead controls.

## 4. Integration and independent acceptance

- [x] 4.1 Wire manifests/config sequentially and run format, lint, typecheck, tests, normal/demo builds, strict OpenSpec validation, focused forbidden-integration scans, and runtime request observation; record exact commands and verify normal-build exclusion and unchanged native entry.
- [x] 4.2 Have Claude test navigation/keyboard/focus/states and the designer perform a separate final rendered visual review; fix defects through Claude, record environment/screenshots/contrast evidence, and distinguish browser evidence from native evidence.
- [x] 4.3 Have peer_reviewer independently review the final diff/contracts/security/tests, return defects to owners, refresh Code Review Graph and inspect final impact, obtain explicit S1 acceptance of the exact core and agreement on sole canonical consumption, then update the English handoff with manifests, hashes, commands/results, acceptances, limits, and next authorized work.

## Workflow follow-up

- Do not archive until the complete requested behavior and review gates pass.
- Commits, pushes, GitHub publication, merges, and releases require separate explicit authorization.

## Historical execution checkpoint (superseded by 2026-11-11 authorization)

Scoped pure-core correction: task 1.5 is locally complete with 49/49 nonvisual checks, readonly/frozen API probes, exact manifests, and independent Sol review. All 35 frozen oracles ran unchanged: 33 pass and two retain only the explicitly allowed diagnostic-pointer granularity differences. See [the resubmission report](../../../docs/architecture/s1-core-resubmission-20261110.md). S1 acceptance/integration remains pending. This does not complete or reopen tasks 3.3, 3.7, or 4.1–4.3; UI and delivery remain frozen.

Earlier UI checkpoint (historical, before task 1.5): Claude exhausted its account usage quota during the viewport correction. Opus, Sonnet, and Haiku availability checks returned the same quota failure. The user requires Claude-only UI/UI-test writes and no Codex frontend fallback, so UI correction and final visual acceptance stop here. At that checkpoint, 123 tests passed, lint/typecheck/normal and demo builds/strict OpenSpec validation passed; format check failed only on `src/ui-mock/ui/projection.test.ts`. The existing production browser harness passed 16 flows but did not exercise the new viewport pan path. The final technical recheck closed the original five defects but left P1 SDK-overridden sticky positioning and P2 undisposed resize observers in the viewport code. Resume with Claude to correct those defects, format that file, finish browser/keyboard pan checks and selected-node/focus captures, remove test-induced screenshot overlaps, then repeat independent visual acceptance and final technical disposition. Do not treat the partial viewport change or passing older flows as acceptance of B1.

## Current phase 1 completion scope

The maintainer authorized completing all five remaining tasks on 2026-11-11, including node dragging and explicit exact-candidate S1 acceptance. They remain mandatory phase-1 work. Historical UI freezes and partial-checkpoint claims do not restrict the newly authorized implementation or establish phase closure. Track each criterion, owner, evidence and blocker in [the completion inventory](../../../docs/development/phase1-completion-20261111.md). Do not check off acceptance tasks until every stated gate is satisfied.

## Phase 1 closure and delivery authorization

All 18 tasks are complete. On 2026-11-11 the maintainer explicitly accepted the exact shared core and sole canonical S1 consumption, assuming that sign-off and superseding the earlier owner-only condition. Technical/visual and verification evidence is in the closure dossier. Staging, commit, push and a PR to dev are now explicitly authorized for this task; merges/releases, S1/checkpoint integration and phase-2 implementation remain separate.

Delivery note: the current `git add` attempt was rejected before execution because approval is required while AskForApproval is Never. Phase 1 remains accepted and closed; commit/push/issue/PR delivery is pending that executor prerequisite. No bypass or retry was attempted.

## Manual publication trace

The supplementary demo child is [#81](https://github.com/furancho-labs/Peer2Canvas/issues/81), a native sub-issue of [WP-04 #6](https://github.com/furancho-labs/Peer2Canvas/issues/6). This committed snapshot prepares the accepted phase-1 delivery through the user-run publication script. The script prints the actual commit and PR URL and writes a local publication receipt. The earlier executor rejection is historical; it does not describe this manual run. Existing production children #25/#26 and parent acceptance remain unchanged. Phase-2 implementation and merge/release still require separate authorization.
