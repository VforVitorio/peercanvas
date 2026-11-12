# PeerCanvas session handoff

Last updated: 2026-11-11.

## Current checkpoint

- The repository is [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). Its move to the organization was intentional. The GitHub Project remains under the personal account `VforVitorio`.
- Promotion PR [#106](https://github.com/furancho-labs/Peer2Canvas/pull/106) merged S1 and S2 from `dev` to `main` as `a2d9837`. Refresh live `main`, `dev`, PRs, issues, milestones, and Project Board before beginning another task.
- S0, S1, and S2 are complete. Milestones #1, #2, and #3 are closed; S1 issues #2, #4, and #19–#24 and S2 issues #6, #25, #26, and #81 are closed and marked Done on the Project Board.
- All eight required checks passed on the promotion. Optional Gitleaks did not scan because the organization has no `GITLEAKS_LICENSE`; there is no secret-scan result.

## Delivered product behavior

The desktop app supports a canonical diagram document, model-backed editing, selection and transforms, straight connectors, property inspection, pages and layers, undo/redo, versioned `.peercanvas` save/open, migration, and non-destructive recovery. A native macOS save, close, and reopen flow was exercised. Required native CI builds passed on Windows, macOS, and Linux; this is not a manual UI smoke test on each operating system.

This was a source promotion. It did not publish an installer, declare minimum supported OS versions, or establish release readiness. The macOS Cmd+Q path was not manually rechecked while the Mac was locked; risk R-13 records the remaining native quit-path uncertainty.

## Not implemented

Grouping, draw.io import/export, reusable shape catalog, peer collaboration, invitations, real assistant/provider calls, and MCP are not delivered. The app does not render connection labels on the canvas or support page/layer deletion and reordering. Icon packaging remains open under WP-11.6/#90. Do not describe planned S7–S10 work as implemented.

## Roadmap after S2

- S3 covers WP-05 (shape catalog) and WP-06 (draw.io interoperability). Check their open issues and dependencies before selecting the next work package.
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

Refresh the remote state and agree whether S3 starts with WP-05 or WP-06. Keep work at planning/discovery until the maintainer explicitly authorizes product implementation.
