# Development agents

This repository-local configuration controls development work. It does not implement the optional assistant inside PeerCanvas, approve product features, or authorize publication. AGENTS.md remains the project rule source; CLAUDE.md imports it. No global client configuration, credentials, hooks, MCP servers, or permission grants are installed here.

## Routing and ownership

Codex Sol is the primary coordinator, architect, explorer, integrator, and reviewer. Start a local Codex session with `codex --model gpt-6.1-sol` when that model is available. Bounded non-visual implementation and tests use Codex Luna. Claude runs through Claude Code and has priority for frontend work.

| Responsibility                                         | Profile                                       | Model         |
| ------------------------------------------------------ | --------------------------------------------- | ------------- |
| Coordination, architecture, integration                | `.codex/agents/peer_coordinator.toml`         | `gpt-6.1-sol` |
| Read-only repository exploration                       | `.codex/agents/peer_explorer.toml`            | `gpt-6.1-sol` |
| Read-only correctness and security review              | `.codex/agents/peer_reviewer.toml`            | `gpt-6.1-sol` |
| Native Rust/Tauri implementation                       | `.codex/agents/peer_rust.toml`                | `gpt-6-luna`  |
| Non-visual TypeScript implementation                   | `.codex/agents/peer_typescript.toml`          | `gpt-6-luna`  |
| MCP and provider services                              | `.codex/agents/peer_mcp.toml`                 | `gpt-6-luna`  |
| Tests and recovery/security fixtures                   | `.codex/agents/peer_tests.toml`               | `gpt-6-luna`  |
| Bounded frontend fallback after Claude failure         | `.codex/agents/peer_frontend_fallback.toml`   | `gpt-6-luna`  |
| Isolated copy/styles, no architecture decisions        | `.claude/agents/peer-frontend-haiku.md`       | `haiku`       |
| Normal React components and interactions               | `.claude/agents/peer-frontend-sonnet.md`      | `sonnet`      |
| Broad UI changes, difficult diagnosis, UI architecture | `.claude/agents/peer-frontend-opus.md`        | `opus`        |
| Visual design and accessible component states          | `.claude/agents/peer-visual-designer-opus.md` | `opus`        |
| One exceptional consultation for blocked Haiku work    | `.claude/agents/peer-haiku-advisor-fable.md`  | `fable`       |

Codex owns the canonical document model, validated commands, persistence, native code, and services, even when they are written in TypeScript. Claude owns assigned UI files and consumes agreed interfaces. Split mixed files/tasks before concurrent work; do not let two agents edit the same file. Sol resolves overall architecture and integration. Opus can decide UI details only within approved scope and core contracts.

For a blocked Haiku mini-task, Sol records its identifier, blocker, attempts, and one concrete question. Sol checks that no Fable consultation has already occurred, invokes Fable once, and records the answer or failure. Fable provides advice only. Expanded work moves to Sonnet or Opus; core architecture stays with Sol. The one-consultation limit is a coordinator instruction, not a client-enforced counter. `maxTurns` bounds one Fable run, not repeated invocations. Do not use Fable for routine implementation or as an automatic fallback model.

## Delegation contract

Every assignment includes:

- Repository root, task identifier, and inspection or implementation mode.
- Approved source artifacts: requirement IDs, OpenSpec contract, ADRs, work package, and issue where applicable. Configuration-only inspection needs no new product contract.
- Exact owned files and read-only references, with interfaces agreed before mixed UI/core work.
- Acceptance criteria, relevant verification commands, and expected evidence.
- Exact paths to relevant skills that exist in that client's environment, plus key constraints. The coordinator consults the current skill map dynamically; never copy a private skill catalog or global memory into this repository. If a supplied skill is unavailable to Claude, Sol provides the necessary task constraints or takes that portion back.
- Stop conditions for material scope, security, or compatibility changes, plus a ban on unrelated edits and further delegation for workers.

Agents return changed files, decisions, exact checks/results, limitations, and integration notes. Sol reviews the final diff and runs proportionate checks. Approval to plan is not approval to implement product behavior. Local edits do not grant permission to commit, push, merge, release, or change repository settings.

## Client recognition and invocation

Codex discovers standalone TOML files in `.codex/agents/`; these are custom agent types, not `codex --profile` configuration overlays. Ask the coordinator to use a profile by its `name`, for example: “Use peer_explorer for this read-only inspection of AGENTS.md; do not edit or publish.” Restart an existing client session after adding profiles if it has already cached the catalog.

The tested Codex CLI's `--ignore-user-config` invocation did not register the project agent types, although normal discovery did. Use normal configuration loading for this workflow. In an ephemeral CLI session, explicitly pass `fork_turns="none"` and the full delegation contract when spawning; inherited-history spawning failed with a missing-rollout error in the installed version. The explicit-context route passed. These are observed client limitations, not permission to emulate an unknown profile or silently change its model.

Claude Code discovers Markdown frontmatter in `.claude/agents/`. Run from the repository root, for example:

```sh
claude --agent peer-frontend-sonnet
```

Supply the delegation contract in the prompt. The profile selects the model; avoid a conflicting `--model` override. The coordinator can invoke Claude Code from its shell when authorized. There is no cross-client scheduler or automatic retry service installed by this change; routing and fallback are coordinator responsibilities.

Profiles inherit the client/session permission boundary. Codex agent files cannot replace the parent's sandbox, provider, or approval policy. Claude implementation profiles use `permissionMode: default`; the Fable advisor has only Read/Glob/Grep tools and requests plan mode. Client parent modes can override subagent modes, so set the parent permissions deliberately. Read-only instructions are not a replacement for a read-only sandbox or restricted tool list. Do not launch with permission-bypass flags to work around a failure. No profile authorizes publication.

## Availability checks and fallback

Check installation, authentication, recognition, and actual inference separately:

```sh
codex --version
claude --version
codex login status
claude auth status --text
claude plugin validate .claude/agents --strict
```

Authentication output can contain account identifiers: inspect locally and record only a sanitized status. A successful login status or bundled model catalog does not establish model entitlement or service availability.

For the installed Codex client, `codex debug prompt-input` renders the model-visible agent catalog without inference. Inspect locally, checking each project agent name; never commit the raw output, which can include private instructions. `codex debug models` can inspect a refreshed catalog; `--bundled` checks only client metadata. Do not record unrelated catalog content.

Probe Claude aliases with a short no-tool request and inspect both success and the returned model usage. For example:

```sh
claude --print --model haiku --tools '' --permission-mode plan \
  --no-session-persistence --output-format json \
  'Availability probe only: reply OK.'
```

Repeat for Sonnet, Opus, and Fable as needed. An availability probe is not a Fable mini-task consultation and must not include implementation work. For profile inspection, use `--agent`, `--tools Read,Glob,Grep`, and `--permission-mode plan`, with an explicit read-only assignment. Isolate probes from unrelated user settings, hooks, plugins, and MCP servers when the installed client supports those controls. Do not save raw transcripts or debug/auth output in the repository.

Use the documented aliases rather than guessing versioned model IDs. Check `claude --help` and official documentation for the installed version. If an alias is rejected, verify the provider's supported identifier and record any deliberate mapping; do not silently substitute a different tier. Record actual returned model IDs because provider settings, organization allowlists, or runtime fallback may change the selected model. If the requested tier is unavailable, record that failure and use Codex.

Fallback record template (in the task's local evidence/handoff, with secrets removed):

```text
Task / approved scope:
Requested Claude profile and alias:
Client version and check performed:
Result: unavailable client | authentication | access | quota | service | timeout
Sanitized reason (no credentials, account identifiers, or raw transcript):
Actual returned model, if any:
Codex owner: Sol for decisions; Luna profile for bounded implementation
Owned files / acceptance / checks:
Outcome and limitations:
```

Proceed with Codex after an access/availability failure; do not wait indefinitely or change authentication, permissions, subscriptions, or global configuration. A fallback drill must be labeled simulated and must not be described as a real Claude outage. See [local validation evidence](agent-validation.md) for this revision's results and remaining limits.

## Provenance and license ledger

Adaptation source: [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), pinned revision [`ed74d115b7fb7026a22a4f816a8e3250f425e3b4`](https://github.com/VoltAgent/awesome-claude-code-subagents/tree/ed74d115b7fb7026a22a4f816a8e3250f425e3b4), reviewed 2026-11-10. The selected prompts are MIT-licensed, copyright (c) 2025 VoltAgent. The unmodified upstream license is retained in [LICENSES/VoltAgent-MIT.txt](../../LICENSES/VoltAgent-MIT.txt). Adapted prompt files remain under MIT; first-party coordinator/explorer profiles follow the repository's Apache-2.0 license. This is development guidance, not bundled runtime functionality or an endorsement.

All upstream links below point to that pinned revision. Every local adapted profile is mapped here:

| Local profile(s)                                                                                  | Upstream prompt(s)                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `peer_frontend_fallback`, `peer-frontend-haiku`, `peer-frontend-opus`, `peer-haiku-advisor-fable` | [frontend-developer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/01-core-development/frontend-developer.md), [ui-designer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/01-core-development/ui-designer.md) |
| `peer-frontend-sonnet`                                                                            | [frontend-developer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/01-core-development/frontend-developer.md)                                                                                                                                                                        |
| `peer-visual-designer-opus`                                                                       | [ui-designer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/01-core-development/ui-designer.md)                                                                                                                                                                                      |
| `peer_rust`                                                                                       | [rust-engineer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/02-language-specialists/rust-engineer.md)                                                                                                                                                                              |
| `peer_typescript`                                                                                 | [typescript-pro](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/02-language-specialists/typescript-pro.md)                                                                                                                                                                            |
| `peer_mcp`                                                                                        | [mcp-developer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/06-developer-experience/mcp-developer.md)                                                                                                                                                                              |
| `peer_tests`                                                                                      | [test-automator](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/04-quality-security/test-automator.md)                                                                                                                                                                                |
| `peer_reviewer`                                                                                   | [code-reviewer](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/04-quality-security/code-reviewer.md), [security-auditor](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/ed74d115b7fb7026a22a4f816a8e3250f425e3b4/categories/04-quality-security/security-auditor.md) |
| `peer_coordinator`, `peer_explorer`                                                               | First-party PeerCanvas instructions; no upstream prompt copied                                                                                                                                                                                                                                                                                             |

Adaptation review removed the upstream context-manager protocol and references to uninstalled agents/tools, static skill requirements, unrelated frameworks/deployment/compliance work, numerical coverage demands, and example success/benchmark claims. Context now comes from the coordinator and repository source. The profiles retain focused discovery, typed interfaces, accessibility, safe ownership, schema/authorization checks, deterministic tests, and evidence-based review. PeerCanvas scope, optional services, approval, provenance, and publication rules take precedence.

## Official client references

- [OpenAI custom subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): project TOML discovery, required fields, model settings, and inherited permissions.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents): frontmatter, project discovery, model aliases, tools, permissions, and validation.
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config): Haiku, Sonnet, Opus, Fable aliases and provider-dependent access/fallback.

Reviewed 2026-11-10. Client recognition, model availability, and returned IDs must be rechecked on the machine/account used for later work.
