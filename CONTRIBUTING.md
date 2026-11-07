# Contributing to PeerCanvas

PeerCanvas is in an engineering-foundation phase. Discuss a substantial behavior change in a GitHub Issue before implementation and link it to the relevant requirement and OpenSpec capability. Small documentation corrections can use a focused PR without a separate issue.

## Local setup

1. Install Node.js 24 and the stable Rust toolchain.
2. Install the native platform prerequisites from the [Tauri guide](https://v2.tauri.app/start/prerequisites/).
3. Run npm ci.
4. Use npm run dev for the frontend shell or npm run tauri -- dev for the desktop shell.
5. Run the checks listed in the PR template before opening a PR.

## Change workflow

1. Check the parent WP issue, the matching child sub-issue, OpenSpec task, requirements, ADRs, and risks.
2. For a substantial behavior change, prepare one OpenSpec change and get maintainer approval before product implementation.
3. Create a short-lived feature/* branch from dev.
4. Keep the PR focused, link the child task and parent WP issue, and close the child when verified.
5. Add tests and documentation for the behavior changed.
6. Open the PR against dev. Sprint promotion PRs target main.
7. The maintainer reviews and merges. Agents may commit or push only when explicitly authorized for the current task; merges always remain maintainer-owned unless separately authorized.

Use Conventional Commit subjects in English, for example feat(canvas): add connector editing. Do not add AI attribution.

## Review requirements

- Explain what changed, why it is needed, how it works, what is out of scope, and which checks ran.
- Link FR/UC IDs and the OpenSpec capability where relevant.
- Include user-visible behavior, accessibility, cross-platform, data migration, privacy, and security impact.
- Include test evidence. Name manual checks and OS/WebView versions.
- Never include secrets, OAuth tokens, real user documents, or private data in fixtures.
- Do not bundle third-party shape assets without documented redistribution rights and attribution.

## Documentation and support

Read [AGENTS.md](AGENTS.md), [PLANS.md](PLANS.md), and [TEST_STRATEGY.md](docs/quality/TEST_STRATEGY.md). Report security issues as described in [SECURITY.md](SECURITY.md).
