# PeerCanvas session handoff

Last updated: 2026-11-11.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). The user moved it to the organization intentionally.
- Remote `main` is `4463497f6c444abc5f97b9301f5d742f8d4b2f2b`; remote `dev` is `cd367f52a35ca715d3255c1870d4430081837bdb`.
- PRs [#83](https://github.com/furancho-labs/Peer2Canvas/pull/83), [#84](https://github.com/furancho-labs/Peer2Canvas/pull/84), and [#85](https://github.com/furancho-labs/Peer2Canvas/pull/85) are merged. They promote the UI demo checkpoint and synchronize `main`/`dev`; they did not close S1's milestone issues.
- S1 milestone #2 still has eight open issues: #2, #4, and #19–#24. Do not report S1 complete or close its milestone without current acceptance evidence.
- S2 milestone #3 contains WP-04 parent #6 and child issues #25/#26. Issue #25 is In Progress; #26 is Todo; supplementary issue #81 is closed.
- Current checkout: `feature/s2-selection-editing`, based on `origin/dev` at `cd367f5`. Its changes are local, uncommitted, and unpublished.

## S2 progress

The current slice is issue [#25](https://github.com/furancho-labs/Peer2Canvas/issues/25), OpenSpec task 3.1: model-backed selection, movement, resizing, and deletion. The app uses Weave as a disposable renderer projection; accepted edits go through the canonical document command boundary. The example is only in memory and clearly warns that reload or close loses changes.

Local browser verification on this Mac covered pointer selection, movement, resizing, keyboard movement/resizing/deletion, canonical revision changes, focus retention after edits, and restoring the sample after testing. This was a Vite browser session, not a native Tauri WebView interaction test. Verification passed: `npm test` (151 tests), lint, typecheck, format, production and UI-demo builds, `npm run native-smoke -- --check-production`, `openspec validate --all --strict`, `git diff --check`, and `npm run tauri -- build --no-bundle`. The native build compiled the app but did not launch it. The JavaScript production bundles exceed Vite's 500 kB advisory threshold. An independent review found no remaining concrete findings in the editor interaction boundary.

Issue #26 remains the next child task: connectors, property inspection, pages/layers, and undo/redo. WP-04 parent #6 is not complete: its acceptance includes saving, closing, and reopening a diagram, and S1 persistence work remains open. Do not close #6 or claim S2 exit until that acceptance is supported by evidence.

## Product boundary

Implemented on the current feature branch: in-memory example document; add/select/move/resize/delete for rectangles; position/size inspector; keyboard equivalents; zoom controls. Selection and rendering state do not replace the canonical document.

Not implemented: durable save/open/recovery, connectors, pages/layers, undo/redo, draw.io, peer collaboration, invitations, real assistant/provider calls, MCP, and native WebView verification of the product editor. The S2 branch does not establish minimum supported OS versions or release readiness.

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

1. Issue #25 is locally implemented and verified; OpenSpec task 3.1 is checked, but the GitHub child issue remains In Progress until its focused PR is merged.
2. Stop before commit, push, or PR until the user explicitly authorizes publication for this S2 task.
3. After #25 is merged, start #26 from the then-current `dev`, refreshing `main`, `dev`, PRs, issues, milestone, and Project first.
4. Keep the WP-04 parent and S2 milestone open until all child issues and the parent save/close/reopen acceptance pass.
