# PeerCanvas session handoff

Last updated: 2026-11-11.

## Current checkpoint

- Repository: [furancho-labs/Peer2Canvas](https://github.com/furancho-labs/Peer2Canvas). The move to the organization was intentional.
- At the latest refresh, `main` was `4463497` and `dev` was `aa646e2` (S2 persistence PR #104 merged).
- PR [#104](https://github.com/furancho-labs/Peer2Canvas/pull/104) merged into `dev` as `aa646e2`. All eight required checks passed. Gitleaks failed because the organization has no `GITLEAKS_LICENSE` configured; it produced no scan result.
- PRs #86 and #87 contain WP-04.1/WP-04.2. Issues #25 and #26 are closed and Done. WP-04 parent #6 remains open until the sprint promotion and issue closeout.
- S1 milestone #2 still has eight open issues: #2, #4, and #19–#24. Persistence work is merged to `dev`; the issues and milestone remain open until the evidence is reconciled and the promotion reaches `main`.
- S2 milestone #3 has one open parent issue, #6. Grouping is explicitly outside S2 and tracked separately under S9/WP-14.
- Dependabot PRs #80, #69, #68, #67, and #66 remain open; refresh before security/release work.

## S2 implementation and evidence

WP-03/#4 adds versioned `.peercanvas` JSON through a Rust/Tauri adapter. The application offers Save, Save As, Open, Reopen last, New, and Close; migration and one prior-version backup; unsaved Save/Discard/Cancel; and a recovery option that leaves the damaged source untouched. Preferences are stored separately. The app does not autosave or open a document automatically at startup.

Async replacements and recovery lock editing and history. Recent-file preference recovery uses its backup; the UI does not advertise a stale Reopen last entry if saving that preference fails. Cmd+Q uses a custom app-menu event and the same unsaved-change decision before native exit.

Local verification passed: 191 TypeScript tests, 14 Rust tests, typecheck, lint, formatting, Clippy, strict OpenSpec validation, the production-isolation smoke check, and a macOS `tauri build --no-bundle`. GitHub passed all eight required checks, including native Windows, macOS, and Linux jobs. The production bundle still triggers Vite's existing >500 kB chunk warning.

A macOS Tauri WebView save/close/reopen flow was exercised earlier in the work. The latest Cmd+Q interaction was not repeated because the Mac was locked. R-13 records the unverified possibility that macOS Dock-context-menu Quit or OS termination may bypass the renderer-controlled prompt. Do not claim that route was verified. The bounded S0 renderer probe is not product-editor interaction evidence.

## Product boundary

Implemented in `dev`: model-backed in-memory editing, connectors, properties, pages/layers, and undo/redo from WP-04.1/#25 and WP-04.2/#26; WP-03 local persistence from PR #104.

Not implemented: shape catalog, draw.io import/export, collaboration, invitations, real AI/provider calls, MCP, or native packaging/installer distribution. Icon packaging is tracked by WP-11.6/#90; a temporary `.icns` used in a local smoke did not create a reproducible package, and the bundle configuration still needs work. Grouping is not part of S2.

## Future roadmap now on GitHub

The public [PeerCanvas Delivery Board](https://github.com/users/VforVitorio/projects/4) now has 68 items and 11 milestones. New issues are Todo:

- **S7 / WP-11.6 #90:** package and verify the authorized native app icon.
- **S8 / WP-13 #93:** persistent light/dark theme and English/Spanish interface preferences. Children: #96, #95, #100, #101.
- **S9 / WP-14 #91:** separate grouping sprint. Discovery child #89 defines scope before implementation issues are created.
- **S10 / WP-15 #92:** final PMV onboarding. Children: #102, #103, #97, #94. WP-15.1 will audit the whole implemented app and decide how many tours to author; the ten existing use cases are not a promise of ten tours.

Roadmap/specification PR [#105](https://github.com/furancho-labs/Peer2Canvas/pull/105) is open against `dev`; its required checks are pending. Its OpenSpec proposals are `desktop-preferences` and `guided-onboarding`; FR-053/UC-13 remain proposed until grouping discovery is reviewed. No S7–S10 product code has been implemented.

## Repository workflow

- Refresh live `main`, `dev`, issues, milestone, and Project Board before new work.
- Branch from `dev`; focused PRs target `dev`; sprint promotions target protected `main`.
- Branch protection requires the eight checks recorded in [GitHub workflow](../planning/github-workflow.md). Gitleaks is optional and currently does not scan without the organization license variable.
- Do not close S1/S2 parent issues or milestones until task acceptance is verified and the promotion PR reaches `main`.

## Source documents

- Requirements and use cases: `docs/requirements/product-definition.md`.
- Work packages and sprint sequence: `PLANS.md`.
- OpenSpec contracts and task maps: `openspec/changes/` and `docs/planning/subissue-map.md`.
- Quality and risk records: `docs/quality/TEST_STRATEGY.md`, `docs/security/RISK_REGISTER.md`.
- Tauri guidance: [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs), checked against the pinned Tauri version.

## Next steps

1. Wait for the required checks on PR #105, merge it into `dev`, then refresh `main` and `dev`.
2. Open the S2 promotion PR from `dev` to `main` after the roadmap PR is merged; include completed S1/S2 issues and acceptance evidence.
3. After the promotion reaches `main`, close completed child and parent issues, mark their Project items Done, and close the S1/S2 milestones.
