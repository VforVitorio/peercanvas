# PeerCanvas session handoff

Last updated: 2026-11-12.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). Its move to the organization was intentional. The GitHub Project remains under the personal account `VforVitorio`.
- `main` is the protected release branch and `dev` is the integration branch. Refresh exact live refs, PRs, issues, milestones, and Project Board before beginning each task; do not infer current refs from this handoff.
- Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged S1 and S2 to `main` as `a2d9837`; docs promotion PR [#109](https://github.com/furancho-labs/Peer2Canvas/pull/109) records the closeout as `035b02f`.
- S0, S1, and S2 are complete. Milestones #1, #2, and #3 are closed; S1 issues #2, #4, and #19–#24 and S2 issues #6, #25, #26, and #81 are closed and marked Done on the Project Board.
- CI polish PR [#112](https://github.com/furancho-labs/Peer2Canvas/pull/112) merged into `dev` as `47e825f`. Its run [43191288824](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43191288824) passed all eight required checks, CodeQL, OSV, and Gitleaks. The run took 12m37s overall; native jobs took Linux 9m35s, macOS 6m21s, and Windows 12m26s. The Rust cache now includes `src-tauri/Cargo.toml`, `Cargo.lock`, and `src-tauri/target`; this first run saved the cache and still ran the full S0 probe because it changed the CI workflow.
- Documentation PR [#113](https://github.com/furancho-labs/Peer2Canvas/pull/113) merged into `dev` as `589e6bf`, recording that the organization policy blocks Actions PR creation. Its eight required checks passed; native builds were skipped while all three required contexts stayed green.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) passed all eight required checks. Its initial run took 8m48s; native jobs took Linux 6m31s, macOS 8m15s, and Windows 8m36s with the S0 probe skipped. After manual CI run [43197023908](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43197023908) warmed Rust caches on `dev`, native-only reruns restored exact cache-key matches and took Linux 3m07s, macOS 4m02s, and Windows 5m07s. The baseline native jobs on PR #109 took 7m53s, 7m41s, and 10m52s respectively; this first warm comparison benefits from both the cache and skipping an unrelated S0 probe.
- Release Please token PR [#115](https://github.com/furancho-labs/Peer2Canvas/pull/115) merged into `dev` as `5f69146`. The organization-owned App `Peer2Canvas Release Automation` is installed only on `Peer2Canvas`; the repository variable and private-key secret are configured. `GITHUB_TOKEN` remains read-only and the organization policy is unchanged.
- `scripts/setup-github.sh` completed successfully with `can_approve_pull_request_reviews=false`. Both protected branches retain the exact eight required contexts and strict checks.
- Main infrastructure promotion PR [#117](https://github.com/furancho-labs/Peer2Canvas/pull/117) merged as `0dbb749`. The App-backed run [43215202478](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43215202478) succeeded and created release PR [#118](https://github.com/furancho-labs/Peer2Canvas/pull/118). The generated-changelog `format` failure was fixed by PR [#119](https://github.com/furancho-labs/Peer2Canvas/pull/119), merged as `d97851b`; all eight required checks now pass on #118, which remains open for maintainer review.
- Main handoff PR [#120](https://github.com/furancho-labs/Peer2Canvas/pull/120) merged as `38a0ffa`. Main-to-dev history sync PR [#121](https://github.com/furancho-labs/Peer2Canvas/pull/121) merged as `bab3140`, so `main` is again an ancestor of `dev`.
- CI tracking issue [#111](https://github.com/furancho-labs/Peer2Canvas/issues/111) is closed and Done after Release Please created #118 and its required checks passed.
- WP-05.1 PR [#114](https://github.com/furancho-labs/Peer2Canvas/pull/114) merged into `dev` as `246d6d3`; issue #27 is closed and Done. WP-05.2 PR [#123](https://github.com/furancho-labs/Peer2Canvas/pull/123) merged as `5839019`, and WP-05.3 PR [#124](https://github.com/furancho-labs/Peer2Canvas/pull/124) merged as `2d29f4f`. Issues #28 and #29 and parent WP-05/#5 are closed and Done; the WP-05 inventory is current through PR #124.
- WP-06 PR [#125](https://github.com/furancho-labs/Peer2Canvas/pull/125) merged into `dev` as `a2f6077`. Children #30–#34 and parent WP-06/#7 are closed; WP-06 items are Done on Project #4. The S3 milestone has 10 closed issues and 0 open issues, but remains open until promotion to `main`.
- Documentation closeout PR [#126](https://github.com/furancho-labs/Peer2Canvas/pull/126) merged into `dev` as `8db7580`, updating the compatibility matrix, ADR-0006, and this handoff.
- WP-06 CI passed all eight required contexts, CodeQL, OSV, Gitleaks, and the native jobs on Linux, macOS, and Windows. Local evidence: 231 TypeScript tests, 33 Rust tests, typecheck, lint, formatting, Clippy, strict OpenSpec validation, and optimized Rust compile passed. The Vite build succeeds with a JavaScript chunk over 500 kB.
- A local macOS Tauri bundle attempt failed while generating the configured app icon (`No matching IconType`); native file-dialog UI smoke was not completed. Keep icon packaging in WP-11.6/#90.

## Delivered product behavior

On `main`, the desktop app supports a canonical diagram document, model-backed editing, selection and transforms, straight connectors, property inspection, pages and layers, undo/redo, versioned `.peercanvas` save/open, migration, and non-destructive recovery. A native macOS save, close, and reopen flow was exercised. `dev` additionally contains the completed S3 shape catalog and declared draw.io import/export subset. Required native CI builds passed on Windows, macOS, and Linux; this is not a manual UI smoke test on each operating system.

This was a source promotion. It did not publish an installer, declare minimum supported OS versions, or establish release readiness. The macOS Cmd+Q path was not manually rechecked while the Mac was locked; risk R-13 records the remaining native quit-path uncertainty.

## Not implemented

On `main`, S3 behavior (shape catalog and draw.io interchange), grouping, peer collaboration, invitations, real assistant/provider calls, and MCP are not delivered. `dev` includes completed WP-05 and WP-06: one reviewed first-party rectangle preview, offline search, safe SVG rendering, schema-v2 references, the asset/dependency license inventory, and the declared draw.io subset. The app does not render connection labels on the canvas or support page/layer deletion and reordering. Icon packaging remains open under WP-11.6/#90. Do not describe planned S4–S10 work as implemented.

## Roadmap after S2

- S3 covers WP-05 (shape catalog) and WP-06 (draw.io interoperability). Both work packages and all child issues are complete on `dev`; the `dev`→`main` promotion is pending.
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

Release PR #118 remains open for maintainer review; do not merge it without maintainer approval. The next authorized step is the S3 promotion PR from `dev` to protected `main`. All S3 issues are closed; leave milestone #4 open until the promotion merges, then close it and sync `main` history into `dev` if required. Do not start a later sprint without maintainer direction.
