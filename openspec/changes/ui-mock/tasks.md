# Tasks

## 1. Preparation and execution gates

- [x] 1.1 Fetch origin and create a clean feature/ui-mock worktree from updated origin/dev; verify branch/base and preserve existing checkouts.
- [x] 1.2 Incorporate the existing development profiles and license, consult routing guidance, and complete the read-only Opus design consultation; verify profile provenance and reported model/result.
- [x] 1.3 Implement the explicitly maintainer-authorized shared pure S1 core at src/document, using the frozen contract and exports, and inverse validated commands for demo undo/redo; verify strict parse/serialize, atomic mutation/rejection, bounds, IDs, and deterministic results with nonvisual tests. S1 owner acknowledgement is pending; do not modify its worktree or implement storage.
- [x] 1.4 Reconcile this change with the maintainer-authorized shared-core scope and traceability; verify requirement mapping and keep the dedicated GitHub issue pending until publication is separately authorized.

## 2. In-memory adapters and fixtures

- [x] 2.1 Implement deterministic empty/multi-page/collaboration/proposal fixtures using approved S1 constructors/types; verify all fixtures validate and rejected edits are atomic.
- [x] 2.2 Implement simulated lifecycle/outcomes/scheduler/reset in nonvisual adapters; verify cancellation/reset/save completion races and write adapter usage documentation.
- [x] 2.3 Implement service-side role checks and revision-bound single-use assistant/MCP proposals; verify viewer denial, stale approval, rejection, cancellation, and repeated approval leave state correct.

## 3. Claude-owned UI and behavior tests

- [ ] 3.1 Implement the isolated entry, layout, sampled accessible tokens, light/dark themes, help/preferences/attribution, and simulation banner; verify accessible names, empty/loading/error states, theme reset, and document the run command.
- [ ] 3.2 Implement home/recent/search/new/open/rename/close/recovery and simulated save state UI; verify cancellation preserves the active document and recovery requires explicit activation.
- [ ] 3.3 Integrate Weave projection, menus/tools/shapes/pages/layers/inspector/selection/zoom/history through agreed commands; verify accepted edits render and undo/redo/keyboard paths preserve canonical authority.
- [ ] 3.4 Implement import/export progress/errors/incompatibility/cancel flows; verify preview/decline/cancel behavior and no real files/downloads/parsers are used.
- [ ] 3.5 Implement participants/invitations/admission/roles/disconnect UI; verify visible fictional invitation labels and viewer mutation denial.
- [ ] 3.6 Implement assistant/MCP conversations/cancellation/errors/proposals/approval/rejection UI; verify preview-first, explicit single approval and rejection/cancel behavior.
- [ ] 3.7 Complete Claude-authored keyboard/focus/observable-control tests and UI usage documentation; verify modal containment/restoration, shortcuts, accessible diagram structure, and no dead controls.

## 4. Integration and independent acceptance

- [ ] 4.1 Wire manifests/config sequentially and run format, lint, typecheck, tests, normal/demo builds, strict OpenSpec validation, focused forbidden-integration scans, and runtime request observation; record exact commands and verify normal-build exclusion and unchanged native entry.
- [ ] 4.2 Have Claude test navigation/keyboard/focus/states and the designer perform a separate final rendered visual review; fix defects through Claude, record environment/screenshots/contrast evidence, and distinguish browser evidence from native evidence.
- [ ] 4.3 Have peer_reviewer independently review the final diff/contracts/security/tests, return defects to owners, refresh Code Review Graph and inspect final impact, then update the English handoff with evidence, limits, and next authorized work.

## Workflow follow-up

- Do not archive until the complete requested behavior and review gates pass.
- Commits, pushes, GitHub publication, merges, and releases require separate explicit authorization.
