# PeerCanvas session handoff

Last updated: 2026-11-07.

## Project summary

PeerCanvas is an independent, open-source, local-first desktop diagram editor planned for Windows, macOS, and Linux. The target stack is Tauri 2, React 18, TypeScript, Vite, and Weave.js. Optional future capabilities include draw.io interchange, Yjs/Trystero/WebRTC collaboration, secure invitations, and Codex/MCP assistance.

## Current state

- The local checkout is on the unborn main branch; the initial foundation files are staged for the maintainer-authorized first commit.
- The public GitHub repository exists at https://github.com/VforVitorio/peercanvas; origin points to it. The remote has no file commits or branch refs.
- A minimal Tauri/React shell exists and now uses the maintainer-supplied PeerCanvas app icon. Diagram editing, persistence, collaboration, import/export, AI, and MCP are not implemented.
- OpenSpec is initialized for Codex with the core profile, spec-driven schema, and English artifacts. Change peer-canvas-foundation has a proposal, 18 capability specs, design, and future implementation tasks. Strict OpenSpec validation passed. The change is not applied or archived.
- Product requirements/use cases, architecture, six provisional ADRs, risks, test strategy, work packages, sprint plan, contributor docs, CI/security workflows, and handoff are present locally.
- Rust stable 1.99.1, rustfmt, and clippy are installed on this Mac. Node is currently 26.10.0; the repository targets Node 24 via .nvmrc and CI.
- The user explicitly authorized the initial foundation commit and push in this task. Future commits/pushes require task-specific authorization; merges remain maintainer-owned unless separately authorized. Never add AI attribution.

## Architecture baseline

- Tauri 2 and React 18.3.1; Weave.js 5.7.1 is a candidate requiring a native compatibility spike.
- One versioned document model and validated command boundary are proposed.
- Yjs plus a replaceable Trystero/WebRTC transport is proposed; direct connectivity is not guaranteed and TURN is unresolved.
- Local storage choice remains open until recovery experiments compare SQLite, Tauri APIs, and browser/Yjs persistence.
- draw.io compatibility will be an explicit tested subset with loss reporting.
- Codex via Sign in with ChatGPT and Codex app-server appears technically viable for eligible open-source/local apps, but the flow is a preview and terms/registration must be rechecked. No token exchange or model call was made.
- No product capability is implemented.

## Documents

- Product requirements/use cases: docs/requirements/product-definition.md.
- Architecture, Codex research, draw.io/catalog plans, and ADRs: docs/architecture/.
- Threat model and risks: docs/security/.
- Quality strategy: docs/quality/TEST_STRATEGY.md.
- Work packages, sprints, dependencies, and GitHub Issue map: PLANS.md.
- Branching, protection, CI, security, and setup process: docs/planning/github-workflow.md.
- Branding assets and visual direction: docs/branding/brand-guide.md.
- OpenSpec task-to-sub-issue mapping: docs/planning/subissue-map.md.
- OpenSpec baseline proposal/specs/design/tasks: openspec/changes/peer-canvas-foundation/.
- Agent workflow and reusable prompts: AGENTS.md and PROMPTS.md.

## GitHub state

The public repo is under the personal account VforVitorio. The setup script has been run and the remote settings currently show:

- Issues enabled, wiki disabled, merge commits enabled, squash/rebase disabled, delete merged branches enabled.
- Actions default workflow permission is read-only; release-please declares its narrower write permissions in its workflow.
- Dependabot vulnerability alerts and automated security fixes enabled.
- Secret scanning, push protection, and private vulnerability reporting enabled.
- Project labels and eight sprint milestones exist.
- Thirteen WP parent Issues and 41 native task sub-issues are open.
- Public [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2) contains all 54 issues; Status columns, Milestone, Parent issue, and sub-issue progress are visible.

No PRs or commits exist. Branch protection has not been applied because main and dev refs do not exist on the remote. The script skips protection until both refs exist and all exact required CI checks have successful runs on each branch.

Branch flow: short-lived feature/* from dev, PR to dev, then sprint promotion PR from dev to main. main is the default stable branch. Use merge commits, no squash/rebase, and delete merged feature branches. Do not create a test branch.

Repository settings, labels, security toggles, and branch protection must go through scripts/setup-github.sh. The user authorized the initial foundation commit and push. Push main, create/push dev from that commit, and let CI run before the script can apply protection. Future commits/pushes require separate explicit authorization.

## Verification completed locally

- Strict OpenSpec validation: passed; 4/4 change artifacts complete and 18 capability specs present.
- Prettier formatting check: passed.
- ESLint: passed.
- TypeScript typecheck: passed.
- Vitest: 1 file, 1 test passed.
- Vite production build: passed.
- Cargo fmt check: passed.
- Cargo test: passed, but Rust currently contains zero tests.
- Cargo clippy with warnings denied: passed.
- Tauri native macOS release build with --no-bundle: passed.
- GitHub setup script syntax check and dry run: passed; actual repository settings were applied and read back.

The Tauri development process reached the running application binary, but the standalone window was not exposed in the computer-use app inventory, so no visual UI smoke test is recorded. No GitHub Actions workflow has run. Windows/Linux native builds, installer packaging, signing, full dependency/license audit, visual/accessibility review, and real network/auth integration remain unverified.

## First sprint and first implementation task

S0 contains WP-00 and WP-01. The first product-code task is WP-01, tracked by GitHub Issue #3: mount the pinned Weave React renderer in the Tauri shell and record Windows/macOS/Linux compatibility evidence. It is blocked on the maintainer reviewing the plan and explicitly authorizing implementation.

## Commands

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run tauri -- dev
```

For a native release-mode compile without packaging:

```sh
npm run tauri -- build --no-bundle
```

## Open gates

- Weave/WebView compatibility across all targets.
- Storage engine and recovery semantics.
- TURN/signaling policy and credentials.
- Invitation cryptographic construction and enforceable viewer permissions.
- draw.io fixture corpus and supported feature matrix.
- Shape/logo redistribution rights.
- Current Sign in with ChatGPT eligibility, registration, limits, and terms.
- Exact supported OS floors, installer formats, code signing, and manual UI/accessibility checks.
- A full transitive license/SBOM review before release.
- The visible shell still contains the temporary “Engineering scaffold” copy. The first visual pass should replace that placeholder with a user-facing branded shell after reviewing docs/branding/brand-guide.md; it must preserve the approved Weave.js canvas direction and add no fake editor controls.

## Next steps

1. Review the local product definition, architecture, OpenSpec change, WPs, sub-issue map, sprint milestones, and public Project board.
2. Create the authorized first foundation commit on main and push it; create dev from main and push dev.
3. Wait for the CI checks on both refs, then rerun scripts/setup-github.sh to apply branch protection.
4. When ready to start product work, create a separate OpenSpec change for WP-01 and explicitly authorize its implementation. Do not apply the entire peer-canvas-foundation task list as one implementation.
