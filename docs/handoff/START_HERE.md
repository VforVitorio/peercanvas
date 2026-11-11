# PeerCanvas session handoff

Last updated: 2026-11-11.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). The user moved it to the organization intentionally.
- Refresh the live `main` and `dev` refs before starting new work; GitHub is authoritative.
- PRs [#83](https://github.com/furancho-labs/Peer2Canvas/pull/83), [#84](https://github.com/furancho-labs/Peer2Canvas/pull/84), and [#85](https://github.com/furancho-labs/Peer2Canvas/pull/85) are merged. They promote the UI demo checkpoint and synchronize `main`/`dev`; they did not close S1's milestone issues.
- PR [#86](https://github.com/furancho-labs/Peer2Canvas/pull/86) merged into `dev` as `b5fb5c9`; issue #25 is closed and Done on the Project Board. Five Dependabot PRs are also open: #80, #69, #68, #67, and #66.
- S1 milestone #2 still has eight open issues: #2, #4, and #19–#24. Do not report S1 complete or close its milestone without current acceptance evidence.
- S2 milestone #3 contains WP-04 parent #6 and child issues #25/#26. #25 is the completed selection/editing slice; #26 tracks connectors/properties/pages/layers/history. Parent #6 remains open; supplementary issue #81 is closed. Check the Project for current child status.

## S2 progress

WP-04.1/#25 is merged. The WP-04.2 implementation tracked by [#26](https://github.com/furancho-labs/Peer2Canvas/issues/26) adds in-memory connectors, property inspection/editing, page/layer switch/add/rename, and undo/redo. Weave remains a disposable projection. Durable save/open/recovery is still unimplemented.

Local browser verification on this Mac covered the WP-04.1 pointer/keyboard flow. The browser service was unavailable during WP-04.2, so those UI flows have automated integration coverage only; no native Tauri WebView interaction was run. Verification passed: `npm test` (166 tests), lint, typecheck, format, production and UI-demo builds, `npm run native-smoke -- --check-production`, `openspec validate --all --strict`, `git diff --check`, and `npm run tauri -- build --no-bundle`. PR #86 passed all eight required checks. Gitleaks did not run because the organization requires `GITLEAKS_LICENSE`. The native build compiled the app but did not launch it. Vite reports bundles above 500 kB. React Doctor reports component-size and complexity warnings; its listener-cleanup warning is contradicted by the Weave effect cleanup and teardown test.

The #26 fixture validates serialization/parsing only; it does not prove durable storage. WP-04 parent #6 is not complete: its acceptance includes saving, closing, and reopening a diagram, and S1 persistence work remains open. `PLANS.md` also lists grouping without a child issue; clarify that gap before closing #6 or claiming S2 exit.

## Product boundary

Implemented in the current S2 editor: in-memory example document; add/select/move/resize/delete rectangles; add/select/edit/remove straight connectors; node text and geometry editing; page/layer switch/add/rename; undo/redo; keyboard equivalents; zoom controls. Connection labels and endpoints appear in the list/inspector. Selection and rendering state do not replace the canonical document.

Not implemented: durable save/open/recovery, page/layer deletion or reordering, connection-label rendering on the canvas, grouping, draw.io, peer collaboration, invitations, real assistant/provider calls, MCP, and native WebView interaction verification of the product editor. The S2 implementation does not establish minimum supported OS versions or release readiness.

## Repository workflow and current GitHub state

- Branch flow: `feature/*` from `dev`, focused PRs to `dev`, then a promotion PR from `dev` to protected `main` at sprint close.
- The GitHub Project remains under the personal account `VforVitorio` and tracks the organization repository. GitHub issue/PR/milestone states are authoritative.
- Branch protection is active on `main` and `dev`; required checks and the native S0 compatibility probe are recorded in [the platform matrix](../support/platform-matrix.md) and [GitHub workflow](../planning/github-workflow.md).
- The S0 renderer probe is test-only. Its Linux/macOS/Windows CI results verify the bounded probe, not native product editor workflows.
- Seven Dependabot alerts were recorded on 2026-11-10 and are tracked under WP-11.3/#50. Refresh their live status before security or release work.
- Optional Gitleaks checks on the last promotion did not scan because the organization requires `GITLEAKS_LICENSE`; no secret-scan result was produced.

## Planning and source documents

- Product requirements and use cases: `docs/requirements/product-definition.md`.
- Architecture decisions and integration research: `docs/architecture/`.
- Work packages, sprint cadence, dependencies, and issue map: `PLANS.md`.
- OpenSpec baseline and implementation tasks: `openspec/changes/peer-canvas-foundation/`.
- Quality gates and evidence rules: `docs/quality/TEST_STRATEGY.md`.
- Security risks and data boundaries: `docs/security/`.
- Agent workflow and skill routing: `AGENTS.md` and `.agents/skills/`.
- Tauri documentation source: [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs); verify guidance against the pinned Tauri version.

## Next steps

1. Confirm #26's live PR/issue/Project status before continuing.
2. Keep the WP-04 parent and S2 milestone open until all child issues and the parent save/close/reopen acceptance pass.
