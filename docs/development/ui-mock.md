# UI demonstration work session

Date: 2026-11-11. Status: complete demo implemented and locally validated, including dragging; independent technical and fresh visual approval granted. Phase 1 is closed (18/18 tasks) after explicit maintainer acceptance of the exact core and its sole canonical consumption in S1. See [the completion dossier](phase1-completion-20261111.md) and [exact manifest](phase1-candidate-20261111.manifest.json). Historical results below do not establish closure. UI/UI tests remain Claude-only; the normal application and native probe are unchanged.

## Workspace and scope

`feature/ui-mock` lives at `/private/tmp/peercanvas-ui-mock`, created from fetched `origin/dev` at `ff6ec3fc6d390a3b2a83e9b9e3a69dfadc3ed5c0`. The original `dev-2` checkout, agent-configuration checkout, and S1 worktree were preserved. No commit, push, merge, PR, issue, or publication was performed.

The requested implementation scope is captured in [proposal](../../openspec/changes/ui-mock/proposal.md), [behavior specification](../../openspec/changes/ui-mock/specs/ui-demonstration/spec.md), [design](../../openspec/changes/ui-mock/design.md), and [tasks](../../openspec/changes/ui-mock/tasks.md). `npm run ui:mock` and `npm run build:ui-mock` use a dedicated Vite configuration and `dist-ui-mock/` output. Verification results are recorded below when complete.

## Run and exercise the current candidate

Use `npm run ui:mock` and open `http://127.0.0.1:1430/`. `npm run build:ui-mock` writes only `dist-ui-mock/`; `npm run build` retains the normal scaffold. The persistent banner labels the fictional data and offers fixture, outcome and reset controls. The current candidate remains subject to [all phase 1 acceptance gates](phase1-completion-20261111.md).

- Open one of the four fictional documents, search recent documents, or start empty. Reset restores the initial UI and cancels pending simulated operations. Choose success, wait, cancel or error before starting an operation; waiting work offers explicit continue/cancel controls.
- Select a shape on the canvas or in Outline; `[` and `]` cycle selection while the canvas is focused. The inspector applies validated text/geometry/style edits and can revert unsent form changes. Page and layer controls change the active context; layers remain semantic document ordering, not a second store.
- Drag a shape past the 3 CSS-pixel threshold, then release to submit one validated move. Until release, the renderer shows only a temporary preview. Escape, lost capture/focus, scrolling/resizing/zoom, or a change of document/page/layer/revision/role cancels it. A return to the starting position creates no history. Viewer moves are denied at the service boundary.
- With the canvas focused, arrow keys nudge the selected shape; Shift multiplies the configured step by four. Alt/Option + arrow pans the viewport, with Shift for a larger pan. Delete/Backspace removes the selected shape; Escape clears selection. Controls and text fields retain their own keyboard handling.
- Undo/redo use the toolbar or Ctrl/⌘Z and Ctrl/⌘Shift+Z (Ctrl/⌘Y also redoes). Zoom controls, Ctrl/⌘ plus/minus, Ctrl/⌘0, and Fit to content change only the viewport. `?` opens shortcut help; dialogs contain focus and restore it on dismissal.
- File/menu actions demonstrate new/open/save/rename/close, dirty-document decisions, recovery preview/activation, and import/export reports. Import previews require approval; declining/cancelling preserves the document. Export reports that no file was generated. No real user file is read or downloaded.
- Collaboration controls demonstrate fictional invitations, pending admission/denial, participant roles, revocation and reconnect. Assistant/MCP controls demonstrate conversation, waiting/error/cancellation and preview-first proposals. Approval applies once; stale, rejected or cancelled proposals cannot mutate the document.
- Help exposes preferences, attribution and shortcut guidance. Light/dark, nudge step and motion preferences are temporary and reset with the demo. Unavailable controls explain their limits.

These instructions describe the isolated in-memory demo. They do not claim native editor, durable files/recovery, interchange support, peer transport, provider access or an MCP server.

## S1 coordination and authorization

The maintainer authorized the shared pure canonical core in this UI branch on 2026-11-10. Its schema, commands, synthetic v0 migration and exact exports are in [shared-document-contract.md](../architecture/shared-document-contract.md). S1 acknowledged sole UI core ownership; its older implementation and tests remain frozen references. The corrected core is SHA-256 `e3e18dde77702c3234e27d4aa48a633d3dd77eaf38a2cac4d0105d536c39564f`. Native storage, Rust and S1 production gates remain outside this demo's scope.

On 2026-11-11, after the exact candidate and canonical-consumption agreement were presented, the maintainer explicitly accepted the shared core and authorized commit, push and a PR to dev. This supersedes the earlier owner-only sign-off instruction. The acceptance is the maintainer's decision; no separate S1-agent acceptance or automatic S1 integration is claimed. Core acceptance is recorded in the completion dossier; S1 Rust/storage and production gates remain outside this demo. No S1/checkpoint copy or integration was performed, and no production issue is closed by this demo.

## Routing and evidence

Current phase 1 reused the existing profiles, obtained explicit limited client grants for assigned UI files/local checks after initial default denials, and completed independent technical and visual reviews for the exact candidate. The dossier distinguishes actually executed checks from inspected coordinator reports. No duplicate profiles or global permission changes were added; Fable was unused.

### Historical preparation evidence (2026-11-10)

The existing `.codex/agents/`, `.claude/agents/`, `CLAUDE.md`, license, and development guidance were copied unchanged from the agent-configuration worktree. No duplicate profiles were defined. The general guide's fallback policy is overridden for this task: all UI and UI-test writes/corrections belong to Claude; do not use `peer_frontend_fallback`.

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

## Historical verification evidence (2026-11-10)

Evidence is local and automated unless explicitly identified as a separate visual review. No CI run, native OS/WebView editor test, real file restart/recovery, peer transport, provider account, MCP transport, screen reader, forced-colours, 200% zoom, or performance benchmark is claimed.

- `npm ci --ignore-scripts`: passed; manifests/lockfile unchanged. Audit reported eight existing findings (seven moderate, one high); dependency remediation is outside this demo.
- `npx --no-install vitest run tests/document tests/ui-mock-services`: 39 passed after the independent technical review fixes. This includes malformed IDs, atomic serialized-size rejection, reset/save/replacement races, immutable history payloads, roles, approval/cancellation, fixture validation and command/schema boundaries.
- Scoped core/service/test ESLint, root typecheck, and `git diff --check`: passed after those fixes. Normal app, native probe/Tauri, normal Vite config, lockfile and CI sources were compared to HEAD and remain unchanged.
- UI tests cover lifecycle/keyboard/focus, a disposable Weave mock with realistic initialization, projection defaults/styles/stacking, contrast on semantic paper, and initial fit. The real browser exposed and verified fixes for the stage-initialization race and arrow node registration that the initial mock did not cover.
- The production browser harness at `/private/tmp/peercanvas-browser-smoke.mjs` passed 16 flows before the viewport correction. It reads actual painted pixels and checks no page/console/resource errors or external HTTP/WebSocket requests. Environment: Playwright 1.65.0 with cached headless Chromium 153.0.8010.12, darwin 25.6.0 arm64, 1440×1000. The current 16-flow rerun also passes on the latest compiled partial viewport source, but does not exercise native scroll/Alt+arrow panning; that new regression remains pending.
- Screenshots and `result.json` are in `/private/tmp/peercanvas-ui-evidence/`. Ignore superseded `fail*` images. The separate designer reviewed eight rendered states and identified unreachable content at manual zoom plus missing selection evidence; the viewport owner added a scrollable viewport and geometry tests, then exhausted its account quota before completing browser/keyboard pan verification and selected/focused captures. Final visual acceptance remains blocked.
- `npm run format` was executed by the UI owner after all preceding writers finished; only the demo HTML entry required mechanical formatting. Root `npm run format:check` then passed.
- Strict OpenSpec validation passes for both changes. The latest root checks pass lint, typecheck, 123 tests in 8 files, both builds, strict OpenSpec validation, and diff whitespace. Format check now fails only on `src/ui-mock/ui/projection.test.ts` after the unfinished viewport pass. The demo bundle has a large-chunk warning. No UI writer is available to complete correction or formatting: Opus/Sonnet/Haiku probes returned the same account quota failure. The explicit user rule forbids Codex UI/UI-test corrections or fallback. See the handoff for exact next steps.

Code Review Graph was consulted and rebuilt with the exact worktree root. Its tracked-file-only index omits the new untracked source; graph impact output is therefore not evidence about these new symbols. An intent-to-add request was rejected by the execution permission policy and was not bypassed. Direct source review, TypeScript AST isolation tests, and focused ast-grep checks were used for the new code. The local graph remains ignored and no tool gate/hook/runtime feature was added.

The independent technical reviewer found malformed-ID acceptance, serialization-limit error swallowing, an obsolete save/open continuation, styled-text fill, and layer-stacking defects. Owners corrected them and added regressions. The final independent recheck closed those five original findings and confirmed the history payload isolation. Two new UI defects remain in the incomplete viewport: the SDK overrides the supposedly sticky container with inline relative positioning (P1), and repeated renderer replacement retains resize observers because the pinned resize plugin is not disposed (P2). These require Claude-owned corrections and real-SDK regression evidence. No heap-growth measurement was made. Overall acceptance remains blocked; the unit tests mock the SDK and the existing browser flows do not exercise the new pan path.

## Manual publication trace

The supplementary demo child is [#81](https://github.com/furancho-labs/Peer2Canvas/issues/81), a native sub-issue of [WP-04 #6](https://github.com/furancho-labs/Peer2Canvas/issues/6). This committed snapshot prepares the accepted phase-1 delivery through the user-run publication script. The script prints the actual commit and PR URL and writes a local publication receipt. The earlier executor rejection is historical; it does not describe this manual run. Existing production children #25/#26 and parent acceptance remain unchanged. Phase-2 implementation and merge/release still require separate authorization.
