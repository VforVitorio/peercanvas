# PeerCanvas session handoff

Last updated: 2026-11-10.

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
