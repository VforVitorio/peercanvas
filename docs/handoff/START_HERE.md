# PeerCanvas session handoff

Last updated: 2026-11-11.

## Current phase 1 status

**Phase 1 closed; technical and visual foundation ready for phase 2.** The maintainer explicitly accepted core SHA-256 `e3e18dde77702c3234e27d4aa48a633d3dd77eaf38a2cac4d0105d536c39564f` and its consumption by S1 as the sole canonical implementation, superseding the earlier request for the original S1 owner to sign off. This is maintainer acceptance; no separate S1-agent response or automatic S1 integration is claimed.

The complete mock UI, including validated dragging, is implemented and locally verified. Independent technical and fresh visual reviews approved source/test bundle `69b97e4a39040a27de5760ba9edf60bac50db0d406247eeef1525932e7cc1913` (36 unchanged source/test files). OpenSpec `ui-mock` is **18/18 complete**, with no mandatory demo work deferred to phase 2.

Deliver from `feature/ui-mock` at `/private/tmp/peercanvas-ui-mock`, base `ff6ec3fc6d390a3b2a83e9b9e3a69dfadc3ed5c0`. The latest maintainer instruction explicitly authorizes staging, commit, push and a PR to `dev`. Merge/release and phase-2 implementation are not authorized. Preserve the initiating `dev-2`, S1 and checkpoint worktrees.

The [completion dossier](../development/phase1-completion-20261111.md) records the full task inventory, commands, actual results, acceptances and limits. The [candidate manifest](../development/phase1-candidate-20261111.manifest.json) pins source/test files, builds, eleven fresh captures and local verification artifacts. Evidence is local under `/private/tmp/peercanvas-phase1-*`; no new CI/native result is inferred.

Evidence: **212/212 tests**, no skips, two workers; global format/lint/typecheck, normal/demo builds, strict OpenSpec and readonly API probes pass. Real Weave browser: **40 passed, 0 failed, 1 optional headless window-blur induction unavailable**, no errors or external requests. Actual Tab focus loss and unit blur cancellation pass. All mandatory viewport/scales/negative/fractional movement/connection/replacement/keyboard/scenario checks pass. Independent technical and visual approval covers the exact bundle. All 35 frozen S1 tests ran unchanged: **33 passed, exactly two authorized diagnostic-path differences**, actual exit 1; input/reference hashes are unchanged.

**Next authorized task:** complete the already-authorized commit/PR delivery after the executor permits Git writes. The single `git add` attempt was rejected before execution with `approval required by policy, but AskForApproval is set to Never`; no files were staged, no commit/push/PR was created, and no bypass was attempted. The PR body is ready at `/private/tmp/peercanvas-phase1-pr-body.md`. Create/link a dedicated demo child issue under WP-04 #6 before opening the PR to `dev`; do not close production children #25/#26. The user authorization persists, so another user approval is not required merely to resume these delivery steps. The remote's current canonical location is `furancho-labs/Peer2Canvas`; old `VforVitorio/peercanvas` URLs redirect there. The maintainer owns merges. Phase-2 product implementation still requires its own scope and authorization; local phase-1 closure is not production S1/WP completion.

The normal app remains a scaffold. File/recovery/interchange/collaboration/assistant/MCP outcomes in the demo are fictional and in memory. No real files, downloads, durable storage, credentials, external network, transport, provider or MCP server was added. Browser evidence is not native editor/WebView, assistive-technology or performance certification. Disclosed nonblocking input-border/grid contrast is about 1.45:1; no full WCAG claim or maintainer contrast exception is inferred. The verification-only preview server is stopped; `npm run ui:mock` starts the interactive demo.

## Historical handoff (2026-11-10)

## UI demo branch session

The separate `feature/ui-mock` worktree is `/private/tmp/peercanvas-ui-mock`, based on fetched `origin/dev` (`ff6ec3f`). The isolated demo implements home/lifecycle/recovery, a Weave workspace, inspector/pages/layers/history, simulated import/export, participants/invitations/roles, assistant/MCP approval, temporary preferences/themes, help, shortcuts, and reset/scenario controls. It is runnable, but final acceptance is blocked by Claude availability. See [evidence and limitations](../development/ui-mock.md) and [remaining OpenSpec tasks](../../openspec/changes/ui-mock/tasks.md).

Run `npm run ui:mock` at `http://127.0.0.1:1430/`; `npm run build:ui-mock` writes `dist-ui-mock/`. Normal application/native-smoke entries remain unchanged. All file/recovery/interchange/collaboration/assistant/MCP service results are simulated; no real file, provider, credential, persistent browser-storage, or external network integration was added.

After the dependency was explained, the maintainer explicitly authorized the shared pure S1 core here. `src/document/**` is the single canonical module, described by [the frozen shared contract](../architecture/shared-document-contract.md). Demo edits, inverse undo/redo, and approved proposals use its validated command boundary. The supplied S1 handoff acknowledges UI as the sole active core writer; S1 retains persistence/Rust ownership, and its worktree is untouched. Candidate acceptance/integration remains pending. This demo closes no production work-package issue.

Earlier UI checkpoint verification, before the scoped pure-core correction below: `npm test` passed **123 tests in 8 files**; lint, typecheck, both frontend builds, strict OpenSpec validation (two changes), and `git diff --check` passed. The production browser harness passed **16 flows**, with painted canvas content, no page/console/resource errors, and no external HTTP/WebSocket requests. Current automated checks are recorded below; browser and visual evidence was not rerun for this core correction. Native app/WebView, screen-reader, forced-colours, 200% zoom, real services and performance remain unverified. The demo build emitted a large-bundle warning; no performance claim is made.

The independent technical reviewer found five defects, which owners corrected with regressions: malformed IDs, oversized serialized candidates, obsolete save/open continuations, styled text fill, and layer stacking. The core/service suite passes **39 tests** independently. The separate visual reviewer passed initial states but blocked manual-zoom reachability and requested non-overlapping evidence plus selected-node/focus captures. Claude authored a scrollable, viewport-sized Konva correction and six geometry tests, then hit its account quota before completing browser/keyboard pan verification and the requested captures. The existing 16-flow harness does not test the new pan path. **Final visual acceptance is not granted.**

The final read-only technical recheck closed all five original findings and confirmed detached/frozen history payloads. It found two defects in the unfinished viewport code, both Claude-owned:

- **P1:** `WeaveCanvas.tsx` passes the sticky element directly to Weave; the pinned SDK overrides it with inline `position: relative`. Native scrolling then moves the bitmap while the adapter also subtracts scroll offsets. Use a separate sticky wrapper and SDK container and verify with the real SDK.
- **P2:** each renderer recreation installs `WeaveStageResizePlugin`; its pinned implementation never disconnects the observer, and `Weave.destroy()` does not dispose it. Add explicit observer lifecycle cleanup. Heap growth has not been measured.

`npm run format:check` currently fails only on `src/ui-mock/ui/projection.test.ts`. Opus, Sonnet, and Haiku probes all returned usage-quota failures. Do not correct or format UI/UI-test files with Codex: the user's explicit Claude-only/no-fallback rule still applies. Preserve the unfinished viewport changes for the Claude owner; do not silently discard them or call the demo complete.

The deferred Claude-owned work is unchanged: correct the sticky-wrapper and resize-observer defects, format that test, finish viewport pan/keyboard browser regressions, recapture post-edit and selected/focused light/dark states, rerun the independent visual review, and complete final technical disposition and checks. This correction does not reopen those UI/delivery tasks. Existing profiles were reused without duplication; invocation-local `agents.<name>.config_file` resolved runtime registration in the earlier session, with no global configuration/trust change. No commit, push, merge, GitHub issue/PR, or publication was performed or authorized. Installation reported eight existing dependency audit findings (seven moderate, one high); remediation remains separate.

## Scoped S1 pure-core correction

The maintainer explicitly reopened only the UI-owned nonvisual canonical core and consumer boundary despite the UI/Claude quota and delivery freeze. Existing `peer_typescript` and `peer_tests` Luna profiles ran with `fork_turns="none"`, exclusive file ownership, at most two active workers, and no further delegation. Sol coordinated, integrated the nonvisual service, independently reran verification, and obtained a separate Sol `code_reviewer` review. No UI/viewport, Rust, persistence, profile, S1-worktree, checkpoint-worktree, or original frozen review-harness writes were made.

The candidate corrects descriptor-only stable capture (including shared state/command references), dense data arrays, semantic before/after affected IDs with changed ancestors and owner paths, the canonical 10 MiB ceiling, and the exact nested readonly public API. The service retains one captured command for execution and undo/redo history. Original migration, atomic rejection, and plain-input no-op identity checks remain passing. See [the resubmission report](../architecture/s1-core-resubmission-20261110.md) for exact commands, allowed diagnostic differences, review disposition, and limits, and [the manifest](../architecture/ui-core-resubmit-20261110.manifest.json) for exact candidate/test/harness hashes.

Final core SHA-256: `e3e18dde77702c3234e27d4aa48a633d3dd77eaf38a2cac4d0105d536c39564f`. New disposable harness: `/private/tmp/peercanvas-core-resubmit-20261110`. The coordinator independently verified **134/134 full unit tests** with two workers (no skips), **50/50 nonvisual tests**, both public API probes and standalone test TypeScript, source typecheck, full lint, scoped format, both frontend builds, strict OpenSpec validation, and tracked diff whitespace. An earlier unrestricted parallel run timed out in a focus test; that test passed isolated and in the final full run. Global format still fails only on the frozen Claude-owned projection test. All **35 frozen checks executed: 33 pass, 2 retain only the explicitly allowed original geometry/style diagnostic-pointer differences**; the frozen suite still exits 1. Six frozen input/copy hashes and 15 reference/source before hashes remain unchanged. The independent reviewers reported no remaining actionable findings after the shared-proxy correction and final owner-path recheck. The final reviewer supplied static/hash/readonly compile evidence; its optional runtime spot-check could not run in the read-only shell. Runtime harness evidence is the coordinator's independent rerun. Graph indexing omits untracked source, so no graph coverage is claimed.

Next authorized task: review this exact candidate/evidence for S1 compatibility. Acceptance and integration remain with the S1 owner; no automatic S1 copy was performed. UI/Claude and delivery freezes remain in place. Production persistence/recovery, native/provider/network behavior, and final viewport/visual acceptance are not implemented or established by this work. No staging, commit, push, merge, PR, publication, denied-action workaround, or permission bypass was attempted.

## Project goal and boundary

PeerCanvas is a personal, open-source, local-first desktop diagram editor planned for Windows, macOS, and Linux. The target stack is Tauri 2, React 18, TypeScript, Vite, and Weave.js. Optional planned capabilities include draw.io interchange, Yjs/Trystero/WebRTC collaboration, secure invitations, and Codex/MCP assistance.

The normal app remains a minimal engineering shell. It has no product editing, persistence, collaboration, import/export, AI, or MCP workflow. Its visible “Engineering scaffold” placeholder remains until a separate product implementation is approved and verified.

S0's native compatibility evidence and platform matrix are recorded. The probe is test-only; the normal app remains the engineering scaffold with no editor, persistence, collaboration, import/export, AI, or MCP workflow.

## Current repository state

- Public repository: [VforVitorio/peercanvas](https://github.com/VforVitorio/peercanvas).
- `main` is the default stable branch; `dev` is the integration branch. The first skeletal commit was `360b4a9`, whose author and committer resolve to `VforVitorio`.
- The repository setup changes entered `dev` through [PR #61](https://github.com/VforVitorio/peercanvas/pull/61), and the initial foundation was promoted to `main` through [PR #63](https://github.com/VforVitorio/peercanvas/pull/63). Use the protected `dev` → `main` promotion flow for stable updates; GitHub branch refs and PRs are authoritative for live state.
- The S0 documentation, test-only native probe, and platform matrix entered `dev` through [PR #70](https://github.com/VforVitorio/peercanvas/pull/70), [PR #71](https://github.com/VforVitorio/peercanvas/pull/71), and [PR #72](https://github.com/VforVitorio/peercanvas/pull/72). The matrix links the current runner evidence.
- Final traceability reconciliation entered `dev` through [PR #73](https://github.com/VforVitorio/peercanvas/pull/73). S0 was promoted to `main` through [PR #74](https://github.com/VforVitorio/peercanvas/pull/74) (`d84cfce`); [PR #76](https://github.com/VforVitorio/peercanvas/pull/76) synchronized branch history without changing files.
- S0 milestone #1 is closed with all eight issues closed; the Project Board marks each S0 parent and child issue Done.
- The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) tracks 13 WP parent issues, 41 task sub-issues, and eight sprint milestones.
- WP-01/#3 and child issues #15/#16 describe the isolated Weave probe and its matrix. WP-09/#9 and #44 retain the planned shadcn chatbot adaptation boundaries.
- GitHub branch protection is active and API-verified on `main` and `dev` on 2026-11-10: pull requests required, strict checks `lint`, `format`, `typecheck`, `test`, `frontend-build`, `native-linux`, `native-macos`, `native-windows`, conversation resolution, admin enforcement, and no force pushes or branch deletion. Approval count is zero for the solo-maintainer workflow.
- CI run [42824270374](https://github.com/VforVitorio/peercanvas/actions/runs/42824270374) passed all 14 checks, including the eight required checks and the test-only native canvas probe on Linux, macOS, and Windows. See the [platform matrix](../support/platform-matrix.md).
- Child issue #17 is closed after native CI and branch protection were verified.
- GitHub reported seven open Dependabot alerts on 2026-11-10: one high, five moderate, and one low. The high Vite alert and remaining findings are tracked under WP-11.3, issue #50; resolve or disposition them before product release.

## Architecture and reuse decisions

- The shell uses Tauri 2, React 18.3.1, TypeScript, and Vite 8.
- Weave.js remains the planned canvas foundation. The test-only probe adapts selected composition from the pinned `weavejs-frontend` source under Apache-2.0; it preserves the Tauri/Vite shell and does not import the example's TanStack Start runtime. The normal app remains a scaffold without product canvas integration.
- Adapt the shadcn chatbot template for the optional chat UI. Keep PeerCanvas's Tauri/Vite structure and provider boundary; do not import its Next.js routes or Vercel AI SDK backend. No template source has been copied yet. Preserve its MIT notice for any code adopted.
- One versioned document model and validated command boundary are proposed. Local storage choice remains open until recovery experiments compare SQLite, Tauri storage, and browser/Yjs persistence.
- Yjs plus a replaceable Trystero/WebRTC transport is proposed; direct peer connectivity is not guaranteed and TURN is unresolved.
- Codex/MCP remain optional. Recheck current auth eligibility, terms, and behavior before implementation. No token exchange or model call was made.

## Planning and source documents

- Product requirements and use cases: `docs/requirements/product-definition.md`.
- Architecture, integration research, and ADRs: `docs/architecture/`.
- Work packages, sprint cadence, dependencies, estimates, and WP issue map: `PLANS.md`.
- OpenSpec foundation proposal/specs/design/tasks: `openspec/changes/peer-canvas-foundation/`.
- Task-to-child-issue mapping: `docs/planning/subissue-map.md`.
- GitHub branch flow, protection, CI, and repository settings: `docs/planning/github-workflow.md`.
- Security and risk register: `docs/security/`.
- Quality and verification plan: `docs/quality/TEST_STRATEGY.md`.
- Maintainer-supplied brand assets and usage: `docs/branding/brand-guide.md`.
- Reviewable editor-shell direction and its placeholder/accessibility boundary: `docs/branding/editor-shell-direction.md`.
- Third-party license notes: `THIRD_PARTY_NOTICES.md`.
- Agent workflow and skill routing: `AGENTS.md`.

## Verification and limitations

- `npm run format:check`: passed.
- `openspec validate --all --strict`: passed.
- `bash -n scripts/setup-github.sh`: passed.
- `scripts/setup-github.sh --dry-run`: passed; the actual script was also run to apply repository settings and branch protection.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass locally.
- The normal `npm run tauri -- build --no-bundle` passes. The production-isolation check confirms it includes the scaffold and excludes probe markers.
- The test-only native smoke passes on the maintainer's macOS and on the CI runner matrix in [Actions run 42824270374](https://github.com/VforVitorio/peercanvas/actions/runs/42824270374). The CI results and WebView/runtime versions are recorded in `docs/support/platform-matrix.md`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `git diff --check`, and `openspec validate --all --strict` pass. A release build with the test-only `native-smoke` feature is rejected by the compile guard.
- The supplied 1024×1024 app icon remains the PNG source; `src-tauri/icons/icon.ico` is a Tauri-generated Windows format derivative.
- The test-only probe verifies renderer interactions on the listed runner images; it does not verify product editor workflows, minimum OS support floors, save/open, manual accessibility, signing/installers, peer networking, auth, or a full dependency/SBOM audit.

## Next steps

1. Start the next work package from `dev` on a short-lived feature branch; merge its task PR into `dev`, then promote completed sprint batches to `main`.
2. Plan WP-02's canonical document model and command boundary under OpenSpec before implementation. S1+ product code requires separate maintainer approval.
3. Resolve or disposition the dependency alerts tracked under WP-11.3/#50 before product release.

## Manual publication trace

The supplementary demo child is [#81](https://github.com/furancho-labs/Peer2Canvas/issues/81), a native sub-issue of [WP-04 #6](https://github.com/furancho-labs/Peer2Canvas/issues/6). This committed snapshot prepares the accepted phase-1 delivery through the user-run publication script. The script prints the actual commit and PR URL and writes a local publication receipt. The earlier executor rejection is historical; it does not describe this manual run. Existing production children #25/#26 and parent acceptance remain unchanged. Phase-2 implementation and merge/release still require separate authorization.
