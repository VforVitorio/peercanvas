# PeerCanvas session handoff

Last updated: 2026-11-07.

## Project goal and boundary

PeerCanvas is a personal, open-source, local-first desktop diagram editor planned for Windows, macOS, and Linux. The target stack is Tauri 2, React 18, TypeScript, Vite, and Weave.js. Optional planned capabilities include draw.io interchange, Yjs/Trystero/WebRTC collaboration, secure invitations, and Codex/MCP assistance.

The app remains a minimal engineering shell. No editor behavior, persistence, collaboration, import/export, AI, or MCP feature has been implemented. The visible “Engineering scaffold” placeholder remains until a separate visual implementation is authorized.

## Current repository state

- Public repository: [VforVitorio/peercanvas](https://github.com/VforVitorio/peercanvas).
- `main` is the default stable branch; `dev` is the integration branch. Both contain the first skeletal commit `360b4a9`, whose author and committer resolve to `VforVitorio`.
- The current setup changes are on `feature/weave-shadcn-foundation` in [PR #61](https://github.com/VforVitorio/peercanvas/pull/61), targeting `dev`. The PR is open and awaits maintainer review/merge.
- The public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) tracks 13 WP parent issues, 41 task sub-issues, and eight sprint milestones.
- Issue descriptions for WP-01/#3 and WP-09/#9, plus child issues #15 and #44, now state the planned Weave/shadcn reuse boundaries.
- GitHub branch protection is active and API-verified on `main` and `dev`: pull requests required, strict checks `lint`, `format`, `typecheck`, `test`, `frontend-build`, `native-linux`, `native-macos`, `native-windows`, conversation resolution, admin enforcement, and no force pushes or branch deletion. Approval count is zero for the solo-maintainer workflow.
- CI run [42410320910](https://github.com/VforVitorio/peercanvas/actions/runs/42410320910) passed the eight required checks, including Tauri shell builds on Linux, macOS, and Windows. Every new commit must pass its own required checks before merge.
- Seven Dependabot alerts are open on the default branch: one high, five moderate, and one low. The high alert concerns Vite. They are tracked under WP-11.3, issue #50; dependency remediation is not part of PR #61.

## Architecture and reuse decisions

- The shell uses Tauri 2, React 18.3.1, TypeScript, and Vite 8.
- Weave.js is the planned canvas foundation. Adapt the official `weavejs-frontend` as the starting point for canvas UI and renderer integration, keeping the Tauri/Vite shell rather than importing its TanStack Start application runtime. No Weave source has been copied yet. Preserve Apache-2.0 notices for any code adopted.
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
- Third-party license notes: `THIRD_PARTY_NOTICES.md`.
- Agent workflow and skill routing: `AGENTS.md`.

## Verification and limitations

- `npm run format:check`: passed.
- `openspec validate --all --strict`: passed.
- `bash -n scripts/setup-github.sh`: passed.
- `scripts/setup-github.sh --dry-run`: passed; the actual script was also run to apply repository settings and branch protection.
- GitHub CI passed frontend formatting, lint, typecheck, tests, frontend build, and native shell builds on Linux/macOS/Windows.
- The supplied 1024×1024 app icon remains the PNG source; `src-tauri/icons/icon.ico` is a Tauri-generated Windows format derivative.
- Native CI proves compilation only. Interactive WebView behavior, accessibility, signing/installers, peer networking, auth, and a full dependency/SBOM audit remain unverified.

## Next steps

1. Review and merge PR #61 as maintainer. Its merge will close child issue #17. The repository policy keeps merges maintainer-owned.
2. Keep the first product implementation narrowly scoped to WP-01/#3: mount/adapt the Weave frontend and record platform compatibility evidence. Start only after explicit implementation approval; do not apply the entire foundation plan as one change.
3. Resolve the seven open dependency alerts under WP-11.3/#50 before release.
