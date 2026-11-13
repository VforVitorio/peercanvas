# PeerCanvas agent instructions

## Product boundary

PeerCanvas is a local-first desktop diagram editor. Read [README.md](README.md), [the product definition](docs/requirements/product-definition.md), [the architecture overview](docs/architecture/overview.md), and [PLANS.md](PLANS.md) before changing product behavior.

The app has delivered the canonical document model and local editor, versioned `.peercanvas` persistence/recovery, the licensed shape catalog, and a declared draw.io subset. Peer collaboration, secure invitations, real assistant/provider calls, and MCP remain planned. Check the current handoff and live branch state before making capability claims; planning documents distinguish proposals from verified behavior.

## OpenSpec and implementation

- Use the generated OpenSpec Codex skills in .agents/skills/ for a coherent behavior change.
- OpenSpec artifacts, requirements, work package, GitHub Issue, implementation, and PR must agree.
- Planning is not implementation approval. Stop after producing or revising a complete plan and wait for explicit maintainer approval before product code.
- Do not use OpenSpec as a sprint/backlog system; keep that in PLANS.md and GitHub Issues.
- Before implementation, read the current OpenSpec spec and linked ADRs from disk. Update contracts and traceability when behavior changes.
- If work reveals a material scope, security, or compatibility change, stop and request maintainer review.

## Skills and delegation

- For each substantive task, the primary agent consults the current global skill map and subagent-routing guidance, then reads only available skills that match the task.
- Before delegating, pass each agent the exact relevant skill paths and key constraints, plus its bounded ownership, source artifacts, and acceptance criteria.
- Select skills dynamically as the responsibility changes; do not maintain a fixed skill inventory per model or agent.
- Keep private global-memory content out of this public repository.
- Do not copy the global skill catalog into each agent or repository. Task-specific delegation prompts carry only the skills needed for that assignment.

## Engineering boundaries

- Keep one canonical document model. Rendering, selection, presence, conversations, and transport state must not become competing document sources of truth.
- Route UI, import, peer, AI, and MCP mutations through the validated command boundary.
- Treat imported XML/SVG, network peers, providers, and MCP clients as untrusted.
- Mutating AI/MCP operations require a preview and explicit user approval.
- Keep collaboration and AI optional. Core local editing must not depend on network access or a provider account.
- Do not add assets unless source, version, license, attribution, and redistribution rights are recorded and reviewed.
- Keep API tokens, OAuth credentials, invitation secrets, and private data out of source, logs, screenshots, tests, and telemetry.
- Prefer existing pinned dependencies and the smallest change that meets an approved requirement.

## Quality and verification

- Follow the test layers and release gates in [TEST_STRATEGY.md](docs/quality/TEST_STRATEGY.md).
- Add tests for non-trivial new behavior, security boundaries, migrations, and failure recovery.
- Run relevant checks before proposing a PR. Report exact commands and distinguish local, CI, native, and manual evidence.
- A frontend build is not a native OS smoke test. A successful transport unit test is not proof that NAT traversal works.
- Do not invent performance results. Record the hardware, OS/WebView, fixture, method, and measurements.

## Repository workflow

- Branch flow: feature/* from dev, PR into dev, then sprint promotion PR from dev to main.
- main is the stable default branch. Do not add a long-lived test branch.
- PeerCanvas is co-developed. Before integrating, refresh main/dev and open PRs. When frontend work from the user's collaborator using Claude overlaps or conflicts, preserve that version and adapt our changes around it; never overwrite or revert it to simplify a merge.
- Use Conventional Commit subjects in English. Do not add AI attribution or Co-Authored-By lines.
- The maintainer owns merges and releases. Agents may commit or push only when the user explicitly authorizes those actions for the current task; never infer publication permission from local edits. Agents must not merge unless explicitly authorized.
- Never add AI attribution or Co-Authored-By lines to commits, PRs, or GitHub content.
- Keep PRs single-concern. A task PR links and closes its child sub-issue and references the parent WP issue; a promotion PR to main lists the completed parent WPs and closed child issues.
- PR descriptions state what/why/how/out-of-scope/checks. The maintainer closes a parent WP only after all children are complete and its acceptance criteria pass.
- Change GitHub repository configuration only through scripts/setup-github.sh.

## Documentation and handoff

- Write repository documentation in English. Keep claims bounded by evidence and mark proposals, blockers, and unknowns.
- Update the relevant requirement IDs, OpenSpec spec, ADR, risk register, and work-package traceability when affected.
- Keep docs/handoff/START_HERE.md current at the end of a substantial work session. It must state what is not implemented and the next authorized task.
- Do not copy private global memory or unrelated personal/project information into this public repository.
