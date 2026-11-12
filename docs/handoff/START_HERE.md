# PeerCanvas session handoff

Last updated: 2026-11-12.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). Its move to the organization was intentional. The GitHub Project remains under the personal account `VforVitorio`.
- Before this handoff update, `main` was `d97851b` and `dev` was `d941ca6`. Refresh live refs, PRs, issues, milestones, and Project Board before beginning another task.
- Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged S1 and S2 to `main` as `a2d9837`; docs promotion PR [#109](https://github.com/furancho-labs/Peer2Canvas/pull/109) records the closeout as `035b02f`.
- S0, S1, and S2 are complete. Milestones #1, #2, and #3 are closed; S1 issues #2, #4, and #19–#24 and S2 issues #6, #25, #26, and #81 are closed and marked Done on the Project Board.
- CI polish PR [#112](https://github.com/furancho-labs/Peer2Canvas/pull/112) merged into `dev` as `47e825f`. Its run [43191288824](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43191288824) passed all eight required checks, CodeQL, OSV, and Gitleaks. The run took 12m37s overall; native jobs took Linux 9m35s, macOS 6m21s, and Windows 12m26s. The Rust cache now includes `src-tauri/Cargo.toml`, `Cargo.lock`, and `src-tauri/target`; this first run saved the cache and still ran the full S0 probe because it changed the CI workflow.
- Documentation PR [#113](https://github.com/furancho-labs/Peer2Canvas/pull/113) merged into `dev` as `589e6bf`, recording that the organization policy blocks Actions PR creation. Its eight required checks passed; native builds were skipped while all three required contexts stayed green.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) passed all eight required checks. Its initial run took 8m48s; native jobs took Linux 6m31s, macOS 8m15s, and Windows 8m36s with the S0 probe skipped. After manual CI run [43197023908](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43197023908) warmed Rust caches on `dev`, native-only reruns restored exact cache-key matches and took Linux 3m07s, macOS 4m02s, and Windows 5m07s. The baseline native jobs on PR #109 took 7m53s, 7m41s, and 10m52s respectively; this first warm comparison benefits from both the cache and skipping an unrelated S0 probe.
- Release Please token PR [#115](https://github.com/furancho-labs/Peer2Canvas/pull/115) merged into `dev` as `5f69146`. The organization-owned App `Peer2Canvas Release Automation` is installed only on `Peer2Canvas`; the repository variable and private-key secret are configured. `GITHUB_TOKEN` remains read-only and the organization policy is unchanged.
- `scripts/setup-github.sh` completed successfully with `can_approve_pull_request_reviews=false`. Both protected branches retain the exact eight required contexts and strict checks.
- Main infrastructure promotion PR [#117](https://github.com/furancho-labs/Peer2Canvas/pull/117) merged as `0dbb749`. The App-backed run [43215202478](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43215202478) succeeded and created release PR [#118](https://github.com/furancho-labs/Peer2Canvas/pull/118). The generated-changelog `format` failure was fixed by PR [#119](https://github.com/furancho-labs/Peer2Canvas/pull/119), merged as `d97851b`; all eight required checks now pass on #118, which remains open for maintainer review.
- CI tracking issue [#111](https://github.com/furancho-labs/Peer2Canvas/issues/111) is closed and Done after Release Please created #118 and its required checks passed.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) merged into `dev` as `246d6d3`; issue #27 is closed and Done. Its manifest code is not part of this main promotion. WP-05 remains open for #28 and #29.

## Delivered product behavior

The desktop app supports a canonical diagram document, model-backed editing, selection and transforms, straight connectors, property inspection, pages and layers, undo/redo, versioned `.peercanvas` save/open, migration, and non-destructive recovery. A native macOS save, close, and reopen flow was exercised. Required native CI builds passed on Windows, macOS, and Linux; this is not a manual UI smoke test on each operating system.

This was a source promotion. It did not publish an installer, declare minimum supported OS versions, or establish release readiness. The macOS Cmd+Q path was not manually rechecked while the Mac was locked; risk R-13 records the remaining native quit-path uncertainty.

## Not implemented

Grouping, draw.io import/export, catalog browsing/search, safe SVG rendering, bundled shape assets, peer collaboration, invitations, real assistant/provider calls, and MCP are not delivered on `main`. WP-05.1 defines an empty manifest schema and validator on `dev`; it adds no assets and is not part of this promotion. The app does not render connection labels on the canvas or support page/layer deletion and reordering. Icon packaging remains open under WP-11.6/#90. Do not describe planned S7–S10 work as implemented.

## Roadmap after S2

- S3 covers WP-05 (shape catalog) and WP-06 (draw.io interoperability). WP-05.1/#27 is complete on `dev`; WP-05.2/#28 (offline browse/search and SVG safety), WP-05.3/#29 (asset-rights audit), and WP-06/#7 with children #30–#34 remain open.
- S7: native icon packaging, WP-11.6/#90.
- S8: desktop preferences and English/Spanish resources, WP-13/#93.
- S9: grouping, WP-14/#91; discovery issue #89 defines the semantics before implementation tasks are opened.
- S10: PMV onboarding, WP-15/#92; the full user journey should determine how many tours are needed.

The S7–S10 issues and OpenSpec proposals are planning only. No product implementation for them is approved by this handoff.

## Repository workflow

- Branch flow: short-lived `feature/*` branches from `dev`, focused PRs into `dev`, then a promotion PR from `dev` to protected `main` at sprint close.
- Use merge commits, delete merged feature branches, and do not create a long-lived `test` branch. Never add AI attribution or `Co-Authored-By` lines.
- The maintainer owns merges. Pushes and merges require the user's explicit authorization for the current task.
- Refresh live GitHub state before work; both collaborators and their agents should start from the latest `main`/`dev` and report what changed.

## Source documents

- Product requirements and use cases: `docs/requirements/product-definition.md`.
- Work packages and sprint ledger: `PLANS.md`.
- OpenSpec contracts: `openspec/`.
- Quality gates: `docs/quality/TEST_STRATEGY.md`.
- Security risks: `docs/security/`.
- Agent and skill workflow: `AGENTS.md` and `.agents/skills/`.
- Tauri reference: [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs); verify guidance against the pinned Tauri version.

## Next step

Release PR #118 remains open for maintainer review. WP-05.1/#27 remains only on `dev`; S3 stays open for #28, #29, and WP-06. The infrastructure-only main promotion used a main-based branch, so merge the latest `main` history into `dev` before a future `dev`→`main` promotion.
