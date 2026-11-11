# Development-agent validation

Date: 2026-11-10. Scope: repository-local development profiles and instructions only. Work was performed on `feature/development-agent-profiles`, created from a clean `dev` checkout. Product source, dependency manifests/lockfiles, CI, OpenSpec, and GitHub configuration were unchanged. No commit, push, merge, or release was performed.

## Client and model evidence

| Check                                                              | Observed result                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `codex --version`                                                  | `codex-cli 0.167.0-alpha.3.2`                                                                                           |
| `claude --version`                                                 | `2.1.312 (Claude Code)`                                                                                                 |
| `codex login status`                                               | Authenticated status reported; account details omitted                                                                  |
| `claude auth status --text`                                        | Authenticated status reported; account details omitted                                                                  |
| Codex `debug prompt-input`                                         | All eight project agent types and their fixed model/effort settings appeared in the model-visible catalog               |
| Claude runtime initialization                                      | All five project agent names appeared in the loaded-agent list                                                          |
| Haiku profile, read-only heading/copy routing inspection           | Passed; response usage reported `claude-haiku-5-5`                                                                      |
| Sonnet profile, read-only component/core ownership inspection      | Passed; runtime model and response usage reported `claude-sonnet-5-5`                                                   |
| Opus frontend profile, read-only architecture ownership inspection | Passed; runtime model and response usage reported `claude-opus-5-5`                                                     |
| Opus visual profile, read-only brand-guide inspection              | Passed; runtime model and response usage reported `claude-opus-5-5`                                                     |
| Fable alias, no-tool availability probe                            | Passed with `OK`; runtime model and response usage reported `claude-fable-5-1`                                          |
| Codex Sol parent with `peer_explorer` and `peer_frontend_fallback` | Both completed read-only inspections with explicit fresh context; configured models were `gpt-6.1-sol` and `gpt-6-luna` |

Claude responses had no permission denials and reported no further delegation. Claude usage metadata supplied the returned model IDs; these are observations for this account/provider at this time, not guaranteed future alias mappings. Codex model names are verified profile/catalog settings and the successful routing result, not independently attested backend identities.

## Commands and inspection assignments

The following checks passed:

```sh
claude plugin validate .claude/agents --strict --json
codex debug prompt-input 'Profile discovery validation only; no model call.'
npm ci --ignore-scripts
npm run format:check
git diff --check
git diff --exit-code HEAD -- src src-tauri openspec package.json package-lock.json .github
```

The prompt-input output was redirected to temporary local storage and inspected only for project agent names/settings. A one-off Python 3.14 check parsed all eight TOML files with `tomllib`, checked required and allowed fields, unique names matching filenames, routing models, inherited-permission instructions, and catalog discovery. It also checked the five Claude frontmatters against the routing table, default/plan permission modes, Fable's read-only tool list, the canonical `@AGENTS.md` import, and byte-for-byte equality of the retained upstream license. All passed. This temporary verification helper is not a new repository dependency or CI gate.

Claude inspections used this command shape from the repository root:

```sh
claude --print --agent peer-frontend-sonnet --tools Read,Glob,Grep \
  --permission-mode plan --no-session-persistence --output-format stream-json \
  --verbose --setting-sources project --settings '{"disableAllHooks":true}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' -- \
  'Read-only inspection: read AGENTS.md, docs/development/agents.md, and src/App.tsx. No editable files, additional skills, delegation, or publication. Identify one UI element and the owner of commands/persistence.'
```

Haiku inspected the existing `PeerCanvas` heading and isolated copy/style routing. Sonnet confirmed the heading and Codex core ownership. Opus confirmed complex UI ownership stays within Sol's overall architecture/core contracts. The visual designer read the existing brand guide and correctly avoided inventing CSS color values. The Fable availability probe used `--model fable --tools ''` with the same isolation flags and a request to reply `OK`; it was not a mini-task advisory consultation. Fable's missing-blocker refusal and the coordinator's cross-run consultation limit were reviewed in configuration, not exercised as a real blocked-task scenario.

The final Codex smoke invocation used:

```sh
codex exec --ephemeral --sandbox read-only --model gpt-6.1-sol \
  -c 'model_reasoning_effort="medium"' -c 'features.apps=false' \
  -c 'features.plugins=false' --json \
  --output-last-message /private/tmp/peercanvas-codex-routing-final.txt \
  '<explicit read-only delegation contract described below>'
```

The assignment explicitly requested the actual `peer_explorer` and `peer_frontend_fallback` agent types, each with `fork_turns="none"`, the absolute repository root, both instruction paths, no edit ownership, no additional skills, and no further delegation/publication. Explorer inspected AGENTS.md routing; fallback returned `PeerCanvas` from `src/App.tsx:6`. The parent waited for both and reported completion. This was a **simulated Claude outage drill**; actual Claude probes passed. No real service outage was asserted. The parent consulted the repository-local graph; the fallback reported unavailable graph tools and used ordinary source inspection as permitted by project guidance.

## Failures, corrections, and limits

- Initial sandboxed Claude inference returned `Not logged in`, despite a positive login-status check. The same inspection succeeded after permission to use the client's local authentication outside the outer sandbox. No login, credential, subscription, or global-config change was made. Authentication status alone would have overstated availability.
- Codex prompt rendering and process initialization were initially denied by the outer sandbox. Permission was obtained for the client runtime; the inspection session retained its own `read-only` sandbox.
- A Codex run with `--ignore-user-config` rejected the project agent types. Its subsequent emulated assignments were excluded from profile-recognition evidence. Normal configuration loading recognized the types.
- Normal-config spawning with inherited history in an ephemeral session failed with `no rollout found for thread id`. Explicit `fork_turns="none"` and a full assignment resolved it. Use the documented working route until this client behavior is rechecked.
- The system Python lacked `tomllib`; the available Python 3.14 interpreter completed the static checks. No Python dependency was installed.
- `npm ci --ignore-scripts` initially failed on sandbox DNS resolution, then passed with network permission. It reported eight existing dependency audit findings (seven moderate, one high). Manifests and lockfiles were unchanged; dependency remediation remains the separate WP-11.3/#50 work.
- The local Code Review Graph was built/updated with the explicit repository root and remains ignored. Impact inspection found no changed code symbols or flows; configuration and Markdown require direct review and client checks regardless of that result. No syntax-aware source rewrite was needed, so ast-grep was not used.
- No product behavior, full implementation task, provider failure recovery, native UI, network, performance, or CI run was tested. Rust/TypeScript/MCP/test/reviewer profiles were parsed and recognized but did not implement features. The Fable limit and routing remain coordinator rules, not an installed orchestration service or cross-run enforcement mechanism.

Only sanitized findings are recorded here. Raw prompts, auth output, client state, model catalogs, and transcripts were kept out of repository content. Recheck access and recognition when changing clients, providers, accounts, or model identifiers.
