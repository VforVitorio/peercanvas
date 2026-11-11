# UI demonstration work session

Date: 2026-11-10. Status: maintainer-authorized interim checkpoint; the complete UI change remains in progress. The normal application and native compatibility probe remain unchanged.

## Interim delivery checkpoint

The maintainer viewed the running demonstration and requested a commit/merge of its current state. `feature/ui-mock-checkpoint` captures that state from the active `feature/ui-mock` worktree without including the separate agent-configuration work or S1 persistence planning. No feature expansion is part of this delivery. Pointer drag/resize gestures are absent; selection, arrow-key movement, and inspector edits are implemented. The full OpenSpec UI task/review checklist remains incomplete, and no production WP is closed.

The checkpoint core's public type/export surface still differs from the frozen S1 reference: it adds `validateDocument`/`Geometry`, names the error union `DiagnosticCode`, omits several reference type exports, and exposes mutable interfaces. S1 acknowledged UI as the sole active core writer and will reconcile compatibility before production integration. These differences do not change the documented v1 snapshot fields. Previous S1 test counts are not claimed as UI checkpoint evidence.

Final local delivery checks passed: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (114 tests/eight files), `npm run build`, `npm run build:ui-mock`, `openspec validate --all --strict` (two changes), and `git diff --check`. Strict nonvisual test typing also passed with `node_modules/.bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --jsx react-jsx --skipLibCheck --strict tests/document/contract.test.ts tests/ui-mock-services/demo-service.test.ts`. The demo build reports a non-blocking bundle-size warning; no dependency version changed. Browser evidence is limited to opening the demo home, without complete UI-flow, visual, manual-accessibility, or native acceptance.

Independent read-only review repeated all 114 tests and both builds. Three concrete defects were fixed and rechecked: save-before-replacement cannot resume after reset/dispose or an unsuccessful save; document/command arrays reject sparse or decorated data before serialization/traversal; the renderer projection preserves connection order and emits each layer's connections before its nodes in back-to-front layer order. No public schema/API extension was introduced. The normal output excludes scanned demo/probe markers; normal app/native/probe/lockfile sources remain unchanged.

Bounded nonvisual fixes/tests were implemented by Luna. Claude Haiku made no changes after its exact formatter command was denied by the child client's allowlist; the expanded projection/format task moved to the existing Sonnet profile. Sonnet (`claude-sonnet-5-5`) changed only the projection, its tests, and HTML whitespace, with the explicitly allowed single commands; it reported no permission denials. No auth, global configuration, or permission-bypass setting was changed, and no frontend fallback was used.

Delivery remains blocked at Git staging: `git add --pathspec-from-file=/private/tmp/ui-checkpoint-stage-paths.nul --pathspec-file-nul` was rejected by the executor with `approval required by policy, but AskForApproval is set to Never`. The maintainer's commit/merge authorization is recorded, but the operation did not run. No commit, merge, push, PR, or GitHub issue was created. Do not bypass this denial with another Git/index-writing mechanism. Enable the required operation through the execution environment before completing delivery; publication scope is still separately unconfirmed.

The exact 54-file delivery allowlist excludes local `.claude/`, `.codex/`, dependency symlinks, graph data, agent prompt/license configuration, and S1 persistence planning. The source/UI/S1/agent-configuration worktrees remain separate. Graph tools were consulted/updated with the exact checkpoint root, but the new untracked code remains unindexed; source inspection, focused ast-grep scans, and executable reproductions supplied review evidence.

## Workspace and scope

Development `feature/ui-mock` lives at `/private/tmp/peercanvas-ui-mock`, created from fetched `origin/dev` at `ff6ec3fc6d390a3b2a83e9b9e3a69dfadc3ed5c0`. Delivery uses the separate checkpoint worktree described above. The original `dev-2`, agent-configuration, S1, and active UI worktrees are preserved. No commit/push/merge result is claimed here until delivery completes.

The requested implementation scope is captured in [proposal](../../openspec/changes/ui-mock/proposal.md), [behavior specification](../../openspec/changes/ui-mock/specs/ui-demonstration/spec.md), [design](../../openspec/changes/ui-mock/design.md), and [tasks](../../openspec/changes/ui-mock/tasks.md). `npm run ui:mock` and `npm run build:ui-mock` use a dedicated Vite configuration and `dist-ui-mock/` output. Verification results are recorded below when complete.

## S1 coordination and authorization

S1 initially had no implementation to consume. After this was explained, the maintainer explicitly authorized implementing the shared pure canonical core in this branch (2026-11-10, “Sí, implementar el núcleo compartido”). The frozen schema, commands, v0 migration, and exact exports are in [shared-document-contract.md](../architecture/shared-document-contract.md). `src/document/**` is the sole semantic core; the demo imports it. Native storage, file services, and Rust remain S1-owned and outside this authorization.

Coordination through the thread tool was rejected by an active writer, and `codex queue` delivered the ownership notice. S1 subsequently acknowledged UI as sole active shared-core writer; its implementation is frozen as a compatibility reference. No original S1-worktree file is included or changed by checkpoint delivery. Before S1 production integration, reconcile the API/type differences and repeat compatibility tests. No S1 production issue is closed by the demo.

## Routing and evidence

Development used existing local profiles copied unchanged from the agent-configuration worktree; no duplicate profile definitions were authored. Those configuration/license/guidance files are not part of this checkpoint. All UI and UI-test writes/corrections remain Claude-owned; the demo task does not use `peer_frontend_fallback`.

A read-only `peer-visual-designer-opus` consultation completed through Claude Code. It reported `claude-opus-5-5`, no permission denials, no writes, and no further delegation. Initial sandbox execution returned `Not logged in`; the same read-only consultation succeeded after user-approved execution outside the outer sandbox. No auth/configuration change was made. Raw client output was not saved in the repository.

The designer inspected existing UI, tokens, brand assets/direction, and native-smoke composition. Proposed hierarchy and accessibility states were considered in the design. No rendering, screenshots, numeric color sampling, contrast measurement, keyboard pass, assistive technology, or native UI acceptance occurred. This is not the required final visual review.

An independent preparation review was attempted through an ephemeral Sol Codex session in its own read-only sandbox. The outer sandbox first blocked client initialization; user-approved execution outside it started successfully, but spawning the existing `peer_reviewer` returned `unknown agent_type 'peer_reviewer'`. No substitute profile was used, no review was performed, and no independent technical acceptance is claimed. Files being present does not establish runtime registration. This was subsequently resolved using invocation-local `agents.<name>.config_file` pointing to the existing TOML and its description, as documented in the official configuration reference. No duplicate profile or global trust/configuration change was made. The exact `peer_explorer` and `peer_typescript` profiles then ran successfully; independent final review is still required.

## Traceability and unresolved risks

| Demo area                        | Production references                          | Demo acceptance                                                                       |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Weave workspace/model            | FR-002..011; WP-02/#2, WP-04/#6; ADR-0001/0002 | Canonical commands, projection, selection, inspector, history and keyboard checks     |
| Lifecycle/recovery/preferences   | FR-012..016; WP-03/#4; ADR-0003                | Simulated lifecycle/cancel/recovery only; no durable storage claim                    |
| Shapes/interchange               | FR-017..024; WP-05/#5, WP-06/#7; ADR-0006      | Fixture-only shape/search/report/progress flows; existing reviewed assets             |
| Collaboration/invitations        | FR-025..034; WP-07/#8, WP-08/#10; ADR-0004     | Simulated admission/roles/disconnect and negative mutation checks                     |
| Assistant/MCP                    | FR-035..046; WP-09/#9, WP-10/#13; ADR-0005     | Simulated conversation/cancel/preview/approve/reject and stale/double approval checks |
| Isolation/accessibility/evidence | NFR-008..010, NFR-012..013; WP-11/#11          | Forbidden integration/build isolation checks and independent visual/technical review  |

These are contextual references, not issue closure claims. A dedicated demo issue is pending and no GitHub write is authorized. Existing production child tasks retain their original acceptance criteria. Existing risks R-01, R-02, R-05, R-08, R-10, and R-11 remain unresolved by this preparation. No ADR or production requirement is changed by the demo plan.

## Checks

- `npm ci --ignore-scripts`: passed; 304 packages added, manifests/lockfile unchanged. Audit reported eight existing findings (seven moderate, one high); no dependency remediation attempted.
- Code Review Graph consulted and built for the exact new worktree root; the graph is locally ignored. Source inspection confirmed the normal shell/native probe and the proposed-only S1 dependency.
- `npm run format:check`, `openspec validate --all --strict` (two changes), and `git diff --check`: passed. `git diff --exit-code HEAD -- src src-tauri package.json package-lock.json vite.config.ts .github`: passed. All 17 copied profile/guidance/license files match their source byte-for-byte. Final graph impact inspection found no changed code symbols; untracked planning/configuration files were inspected directly.
- No product tests, demo build, browser/native UI review, or production capability acceptance is claimed by this preparation. Final session checks are recorded in the handoff.
