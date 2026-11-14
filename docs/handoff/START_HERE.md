# PeerCanvas session handoff

Last updated: 2026-11-14.

## macOS window-close hotfix — WP-11 / #140

PR [#141](https://github.com/furancho-labs/Peer2Canvas/pull/141) merged into `dev` as `b8e9cec` with all 15 checks passing. It adds `core:window:allow-destroy` to the capability already scoped to the `main` window. The pinned Tauri API calls `Window.destroy()` after an unprevented `onCloseRequested` event; the capability previously allowed `close` but not `destroy`, so the native close event could be intercepted without completing closure. The local macOS `tauri build --no-bundle` passed.

This is a source-level diagnosis; the production app's red close button has not yet been manually exercised in a native UI. CI's canvas smoke uses a test-only app and does not verify the product close control. Keep #140 In Progress until a manual macOS run confirms clean close and the unsaved Save/Discard/Cancel paths. This is separate from #101's queued preference-write concern and does not close S4/#37.

## Santiago branch integration — WP-13 / PR #132

Santiago's Claude-authored branch `feature/wp13-editor-preferences` delivered a compact header/File menu, Shapes/Structure navigation, contextual inspector, responsive drawers, shortcut help, and persistent System/Light/Dark and English/Spanish preferences. PR [#132](https://github.com/furancho-labs/Peer2Canvas/pull/132) merged into `dev` as `07a0662` on 2026-11-13. Its updated head was `9ad6555`; all 15 checks passed. `main` remains at `3940a07`, so this work is in `dev` only and has not been released.

The branch was synchronized with `dev` at `80a9cde` before merge. Merge conflicts were limited to `docs/handoff/START_HERE.md` and `docs/security/RISK_REGISTER.md`; the resolution preserved Santiago's frontend and native application code. The production-isolation smoke check now uses stable workspace/canvas class markers instead of translated English copy.

Recorded branch evidence: 333 TypeScript tests and 43 Rust tests passed; typecheck, lint, formatting, frontend build, Rust formatting, Clippy with warnings denied, and strict validation of five OpenSpec changes passed. Chromium 153 checked 16 theme/language/window combinations and five keyboard/focus/draft/history scenarios. A real-package regression and rendered review fixed an invisible-connector adapter defect. The document format is unchanged; optional validated initial page/layer names localize newly created documents without rewriting existing content. See [workspace evidence and limitations](../development/editor-workspace.md).

OpenSpec tracking: `editor-workspace-refresh` is complete (7/7 tasks) and is part of the WP-13 sequencing exception, not a separate work package. `desktop-preferences` has implementation tasks 1.1, 2.1, and 3.1 complete; fluent human Spanish review (3.2) and native integration (4.1) remain open. Project #4 shows #96 Done and #93/#95/#100/#101 In Progress; S8 milestone #11 remains open. Keep WP-13/#93 open until its remaining acceptance criteria pass.

Native preference restore, menu and file-dialog behavior, Windows/Linux preference interactions, and screen-reader review remain unverified. The native executable compiled and launched with an isolated QA identifier, but the UI controller could not inspect it. CI's native builds and canvas smoke do not verify those product interactions. Static review found a possible immediate-quit race in queued preference writes and a durability warning that may persist after a successful retry; both are tracked under #101 and have not been reproduced in a native run. Fluent Spanish copy review remains under #100. Icon packaging remains open under #90. These WP-13 items are separate from S4; do not treat PR #132 as closing #37 or S4.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). Its move to the organization was intentional. The GitHub Project remains under the personal account `VforVitorio`.
- `main` is the protected release branch and `dev` is the integration branch. Refresh exact live refs, PRs, issues, milestones, and Project Board before beginning each task; do not infer current refs from this handoff.
- At this checkpoint, `origin/main` is `3940a071390c19f1afe584ec5e8533e85c5c3b4e`; PR #141 is merged into `dev` as `b8e9cec`. Refresh exact live refs before beginning the next task.
- Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged S1 and S2 to `main` as `a2d9837`; docs promotion PR [#109](https://github.com/furancho-labs/Peer2Canvas/pull/109) records the closeout as `035b02f`.
- S0, S1, and S2 are complete. Milestones #1, #2, and #3 are closed; S1 issues #2, #4, and #19–#24 and S2 issues #6, #25, #26, and #81 are closed and marked Done on the Project Board.
- CI polish PR [#112](https://github.com/furancho-labs/Peer2Canvas/pull/112) merged into `dev` as `47e825f`. Its run [43191288824](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43191288824) passed all eight required checks, CodeQL, OSV, and Gitleaks. The run took 12m37s overall; native jobs took Linux 9m35s, macOS 6m21s, and Windows 12m26s. The Rust cache now includes `src-tauri/Cargo.toml`, `Cargo.lock`, and `src-tauri/target`; this first run saved the cache and still ran the full S0 probe because it changed the CI workflow.
- Documentation PR [#113](https://github.com/furancho-labs/Peer2Canvas/pull/113) merged into `dev` as `589e6bf`, recording that the organization policy blocks Actions PR creation. Its eight required checks passed; native builds were skipped while all three required contexts stayed green.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) passed all eight required checks. Its initial run took 8m48s; native jobs took Linux 6m31s, macOS 8m15s, and Windows 8m36s with the S0 probe skipped. After manual CI run [43197023908](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43197023908) warmed Rust caches on `dev`, native-only reruns restored exact cache-key matches and took Linux 3m07s, macOS 4m02s, and Windows 5m07s. The baseline native jobs on PR #109 took 7m53s, 7m41s, and 10m52s respectively; this first warm comparison benefits from both the cache and skipping an unrelated S0 probe.
- Release Please token PR [#115](https://github.com/furancho-labs/Peer2Canvas/pull/115) merged into `dev` as `5f69146`. The organization-owned App `Peer2Canvas Release Automation` is installed only on `Peer2Canvas`; the repository variable and private-key secret are configured. `GITHUB_TOKEN` remains read-only and the organization policy is unchanged.
- `scripts/setup-github.sh` completed successfully with `can_approve_pull_request_reviews=false`. Both protected branches retain the exact eight required contexts and strict checks.
- Main infrastructure promotion PR [#117](https://github.com/furancho-labs/Peer2Canvas/pull/117) merged as `0dbb749`. The App-backed run [43215202478](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43215202478) succeeded and created release PR [#118](https://github.com/furancho-labs/Peer2Canvas/pull/118). The generated-changelog `format` failure was fixed by PR [#119](https://github.com/furancho-labs/Peer2Canvas/pull/119), merged as `d97851b`; all eight required checks now pass on #118, which remains open for maintainer review.
- Main handoff PR [#120](https://github.com/furancho-labs/Peer2Canvas/pull/120) merged as `38a0ffa`; history sync PR [#121](https://github.com/furancho-labs/Peer2Canvas/pull/121) synchronized its history into `dev`. S3 promotion PR [#130](https://github.com/furancho-labs/Peer2Canvas/pull/130) has since advanced `main`; PR #131 synchronizes that promotion back into `dev`.
- CI tracking issue [#111](https://github.com/furancho-labs/Peer2Canvas/issues/111) is closed and Done after Release Please created #118 and its required checks passed.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) merged into `dev` as `246d6d3`; issue #27 is closed and Done. WP-05.2 PR [#123](https://github.com/furancho-labs/Peer2Canvas/pull/123) merged as `5839019`, and WP-05.3 PR [#124](https://github.com/furancho-labs/Peer2Canvas/pull/124) merged as `2d29f4f`. Issues #28 and #29 and parent WP-05/#5 are closed and Done; the WP-05 inventory is current through PR #124.
- WP-06 PR [#125](https://github.com/furancho-labs/Peer2Canvas/pull/125) merged into `dev` as `a2f6077`. Children #30–#34 and parent WP-06/#7 are closed; WP-06 items are Done on Project #4. S3 milestone #4 contains 10 closed issues; verify its current state on the Project before resuming.
- Documentation closeout PR [#126](https://github.com/furancho-labs/Peer2Canvas/pull/126) merged into `dev` as `8db7580`, updating the compatibility matrix, ADR-0006, and this handoff.
- WP-06 CI passed all eight required contexts, CodeQL, OSV, Gitleaks, and the native jobs on Linux, macOS, and Windows. Local evidence: 231 TypeScript tests, 33 Rust tests, typecheck, lint, formatting, Clippy, strict OpenSpec validation, and optimized Rust compile passed. The Vite build succeeds with a JavaScript chunk over 500 kB.
- A local macOS Tauri bundle attempt failed while generating the configured app icon (`No matching IconType`); native file-dialog UI smoke was not completed. Keep icon packaging in WP-11.6/#90.
- S3 promotion PR [#130](https://github.com/furancho-labs/Peer2Canvas/pull/130) merged into `main` as `3940a07`. The required checks, CodeQL, OSV, and native jobs passed; milestone #4 is closed with all 10 S3 issues closed and Done on Project #4.
- S4 milestone #5 is open; WP-07/#8 and #37 are In Progress, while #35/#36 are closed and Done on Project #4. PR [#133](https://github.com/furancho-labs/Peer2Canvas/pull/133) merged the WP-07.1 contract and WP-07.2 implementation into `dev` as `ec0c61e`; evidence PRs [#136](https://github.com/furancho-labs/Peer2Canvas/pull/136), [#137](https://github.com/furancho-labs/Peer2Canvas/pull/137), and [#138](https://github.com/furancho-labs/Peer2Canvas/pull/138) record the local TURN and Linux test-only shim work. All three are dev-only and do not close #37. PR #132 separately merged the approved WP-13 sequencing exception to `dev` as `07a0662` with all 15 checks green; it does not close S4. PR #141 merged the WP-11 macOS close hotfix to `dev` as `b8e9cec`; #140 remains open for native product-button verification. Release PR #118 remains open for maintainer review and is unrelated to S4.
- WP-07.2 adds host-sequenced validated commands, initial checkpoint/commit-tail synchronization, reconnect handling, transient awareness, and a replaceable Trystero 0.26 transport. `npm test` passed 246 tests; typecheck, lint, formatting, strict OpenSpec validation, and runtime dependency audit passed. The normal Vite build passes with the existing 927 kB chunk warning.
- The canvas-only native smoke passed on macOS 27.2.1 arm64 / WebKit 22625.2.8.11.9. Manual peer smoke runs [43426758968](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43426758968) and [43442798805](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43442798805) passed on GitHub macOS and Windows runners with host candidates; each peer was an iframe inside one native WebView. Linux WebKitGTK 2.52.6 lacked `RTCPeerConnection`; the approved test-only shim passed same-WebView sync/edit/reconnect/graceful-host-loss in [43455699691](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43455699691) after a raw IPC CSP fix and bounded iframe realm adapter, normalizing five messages. That branch is not merged and does not provide production Linux support or selected-candidate statistics. Stable WebKitGTK 2.54 also disables WebRTC. The macOS job in forced local TURN run [43445382066](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43445382066) passed on coturn 4.18.0 with relay/relay candidates; its temporary config/credentials were cleaned. These are same-WebView/same-runner tests, not independent-network evidence or a production provider. #37 remains open.
- The collaboration code is not wired into the product UI; sharing/invitation, admission, roles, and participant management remain WP-08/S5.

## Delivered product behavior

The desktop app supports a canonical diagram document, model-backed editing, selection and transforms, straight connectors, property inspection, pages and layers, undo/redo, versioned `.peercanvas` save/open, migration, non-destructive recovery, the licensed shape catalog, and declared draw.io import/export. A native macOS document save, document close, and reopen flow was exercised; this is separate from closing the application window with the red titlebar button. Required native CI builds passed on Windows, macOS, and Linux; this is not a manual UI smoke test on each operating system.

This was a source promotion. It did not publish an installer, declare minimum supported OS versions, or establish release readiness. The macOS Cmd+Q path was not manually rechecked while the Mac was locked; risk R-13 records the remaining native quit-path uncertainty.

## Not implemented

`main` remains at S3. `dev` contains the WP-07.1/.2 session and transport foundation but has no user-facing share/join controls; invitations, admission, roles, grouping, real assistant/provider calls, and MCP are not implemented in the product UI. The WP-13 workspace/preferences implementation is in `dev` through PR #132 but is not on `main` or released; its human Spanish review and native preference acceptance remain open. Delivered S3 behavior includes one reviewed first-party rectangle preview, offline search, safe SVG rendering, schema-v2 references, the asset/dependency license inventory, and the declared draw.io subset. Check live refs before describing availability. The app does not render connection labels on canvas or support page/layer deletion/reordering. Icon packaging remains open under WP-11.6/#90.

## Roadmap after S3

- S3 covers WP-05 (shape catalog) and WP-06 (draw.io interoperability). Both work packages, all child issues, and milestone #4 are complete on `main`.
- S4 covers WP-07 (validated Yjs synchronization and replaceable transport). #35/#36 are complete on `dev`; #37's real network matrix is still open. Do not start WP-08/S5 or promote S4 to `main` until S4 is closed.
- S5 covers WP-08 (secure invitations, admission, roles, participant presence, and revocation) and depends on WP-07.
- S6 covers WP-09 and WP-10 (optional Codex assistant and MCP tools); both remain planned work.
- S7: native icon packaging, WP-11.6/#90.
- S8: desktop preferences and English/Spanish resources, WP-13/#93, locally implemented ahead of S4 by the 2026-11-13 authorization; human/native acceptance remains open.
- S9: grouping, WP-14/#91; discovery issue #89 defines the semantics before implementation tasks are opened.
- S10: PMV onboarding, WP-15/#92; the full user journey should determine how many tours are needed.

The bounded WP-13 exception above is approved and locally implemented. Other S7–S10 issues and proposals remain planning only; their existence grants no implementation or publication permission.

## Repository workflow

- Branch flow: short-lived `feature/*` branches from `dev`, focused PRs into `dev`, then a promotion PR from `dev` to protected `main` at sprint close.
- Use merge commits, delete merged feature branches, and do not create a long-lived `test` branch. Never add AI attribution or `Co-Authored-By` lines.
- The maintainer owns merges. Pushes and merges require the user's explicit authorization for the current task.
- Refresh live GitHub state before work; both collaborators and their agents should start from the latest `main`/`dev` and report what changed.
- If frontend changes overlap or conflict, preserve the user's collaborator's Claude-authored version and integrate our changes around it.

## Source documents

- Product requirements and use cases: `docs/requirements/product-definition.md`.
- Work packages and sprint ledger: `PLANS.md`.
- OpenSpec contracts: `openspec/`.
- Quality gates: `docs/quality/TEST_STRATEGY.md`.
- Security risks: `docs/security/`.
- Agent and skill workflow: `AGENTS.md` and `.agents/skills/`.
- Tauri reference: [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs); verify guidance against the pinned Tauri version.

## Next step

Refresh live refs, PRs, issues, milestone, and Project Board. The immediate S4 step is the first Mac–Windows two-device run using [the Windows test guide](windows-s4-network-test.md); PR [#144](https://github.com/furancho-labs/Peer2Canvas/pull/144) adds its test-only harness. The connection test has not run yet, and the harness does not close #37 by itself. Record sanitized results in ADR-0002, then complete the remaining signaling/STUN failure, external TURN, network-change, peer-limit, abrupt-host-loss, metrics, and durable-file cases when suitable networks and a TURN provider are available. Resolve production Linux peer compatibility before claiming cross-platform collaboration. Do not promote S4 to `main` or start WP-08/S5 until #37's acceptance matrix passes. Separately, #140's red-button and unsaved-document close paths, and WP-13's native preference/restart/menu checks and fluent Spanish review under #100/#101, remain open. At S4 closeout, explain the network test in plain Spanish without assuming networking expertise. Release PR #118 remains open for maintainer review and is unrelated to S4.

Windows Codex guidance for the S4 network-test discussion: [windows-s4-network-test.md](windows-s4-network-test.md).
