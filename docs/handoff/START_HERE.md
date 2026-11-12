# PeerCanvas session handoff

Last updated: 2026-11-12.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). Its move to the organization was intentional. The GitHub Project remains under the personal account `VforVitorio`.
- Before WP-05.1 promotion, `main` was `035b02f` and `dev` was `589e6bf` after PRs #112 and #113. Refresh live refs, PRs, issues, milestones, and Project Board before beginning another task.
- Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged S1 and S2 to `main` as `a2d9837`; docs promotion PR [#109](https://github.com/furancho-labs/Peer2Canvas/pull/109) records the closeout as `035b02f`.
- S0, S1, and S2 are complete. Milestones #1, #2, and #3 are closed; S1 issues #2, #4, and #19–#24 and S2 issues #6, #25, #26, and #81 are closed and marked Done on the Project Board.
- CI polish PR [#112](https://github.com/furancho-labs/Peer2Canvas/pull/112) merged into `dev` as `47e825f`. Its run [43191288824](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43191288824) passed all eight required checks, CodeQL, OSV, and Gitleaks. The run took 12m37s overall; native jobs took Linux 9m35s, macOS 6m21s, and Windows 12m26s. The Rust cache now includes `src-tauri/Cargo.toml`, `Cargo.lock`, and `src-tauri/target`; this first run saved the cache and still ran the full S0 probe because it changed the CI workflow.
- Documentation PR [#113](https://github.com/furancho-labs/Peer2Canvas/pull/113) merged into `dev` as `589e6bf`, recording that the organization policy blocks Actions PR creation. Its eight required checks passed; native builds were skipped while all three required contexts stayed green.
- `scripts/setup-github.sh` could not enable repository Actions PR creation: the organization returned HTTP 409 because its policy blocks GitHub Actions from creating or approving pull requests. The repository still has the exact eight required contexts on both protected branches; the repo-level setting remains disabled.
- CI tracking issue [#111](https://github.com/furancho-labs/Peer2Canvas/issues/111) remains open until Release Please can create a PR under an approved credential or policy.
- WP-05.1/#27 changes in this PR define and validate an empty schema-v1 manifest, with no assets or catalog UI; WP-05 remains open for #28 and #29.

## Delivered product behavior

The desktop app supports a canonical diagram document, model-backed editing, selection and transforms, straight connectors, property inspection, pages and layers, undo/redo, versioned `.peercanvas` save/open, migration, and non-destructive recovery. A native macOS save, close, and reopen flow was exercised. Required native CI builds passed on Windows, macOS, and Linux; this is not a manual UI smoke test on each operating system.

This was a source promotion. It did not publish an installer, declare minimum supported OS versions, or establish release readiness. The macOS Cmd+Q path was not manually rechecked while the Mac was locked; risk R-13 records the remaining native quit-path uncertainty.

## Not implemented

Grouping, draw.io import/export, catalog browsing/search, safe SVG rendering, bundled shape assets, peer collaboration, invitations, real assistant/provider calls, and MCP are not delivered. WP-05.1 defines an empty manifest schema and validator; it adds no assets. The app does not render connection labels on the canvas or support page/layer deletion and reordering. Icon packaging remains open under WP-11.6/#90. Do not describe planned S7–S10 work as implemented.

## Roadmap after S2

- S3 covers WP-05 (shape catalog) and WP-06 (draw.io interoperability). After WP-05.1/#27 merges to `dev`, WP-05.2/#28 (offline browse/search and SVG safety), WP-05.3/#29 (asset-rights audit), and WP-06/#7 with children #30–#34 remain open.
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

Pause before any `dev`→`main` promotion and configure an approved credential route for Release Please and any other workflows that need PR-creation tokens. The built-in `GITHUB_TOKEN` is blocked by the organization policy; do not attempt the main promotion until the maintainer resolves that configuration. Then refresh GitHub state before choosing the next S3 task, currently WP-05.2/#28.
