# Design

## Context

See proposal.md for the motivation and capability list. The normal application contains an empty Tauri/React shell; none of the product capabilities in the specifications are implemented. S0 plans a separately invoked test-only Tauri/WebView probe for the rendering compatibility gate, with its fixture excluded from normal production builds. The product definition, architecture overview, ADRs, risk register, test strategy, and PLANS.md provide the surrounding contracts and execution plan.

The selected research baseline is Tauri 2, React 18.3.1, TypeScript, Vite 8, and Weave.js 5.7.1. React 18 is retained because the chosen Weave React package's peer range excludes React 19. This version matrix is a research snapshot, not proof that the renderer works in each native webview.

## Goals / Non-Goals

**Goals:**

- Establish one observable contract for each of the 18 requested capabilities.
- Keep behavior statements independent of internal classes, storage engines, and transport libraries.
- Make the canonical document and command boundary the shared consistency and authorization boundary.
- Keep local editing independent from peer networking and AI.
- Define security, privacy, errors, loss reporting, and failure recovery before implementation.
- Link requirements to the roadmap, ADRs, risk register, and later GitHub Issues.
- Validate the selected rendering stack through a bounded native test probe and report its fixture evidence per platform.

**Non-Goals:**

- Implement product workflows or replace the normal scaffold with editor controls.
- Include the compatibility probe or its instrumentation in normal production builds.
- Infer product-level Weave, Tauri WebView, Yjs transport, draw.io, OpenAI auth, or MCP readiness from the bounded probe.
- Select a persistence engine, TURN provider, installer format, supported OS floor, or external shape license without the planned evidence.
- Promise full draw.io parity, universal direct WebRTC connectivity, or unconditional ChatGPT-plan inference.

## Decisions

### One product contract with 18 capability boundaries

Create one OpenSpec spec file per capability listed by the proposal. Keep the product definition as the stable FR/UC index and keep OpenSpec as the detailed behavior contract. The product definition links each requirement range to capability paths; it must not become a second contradictory prose specification.

**Alternative considered:** one broad application spec. Rejected because persistence, import/export, collaboration, identity, and AI have distinct ownership and security lifecycles that need independent evolution.

### One versioned document model and validated command boundary

Treat pages, layers, nodes, connections, styles, and supported metadata as one semantic document. UI gestures, import, remote collaboration, Codex, and MCP mutations must resolve to validated commands. Selection, renderer state, presence, and conversation history remain separate or derived.

**Alternative considered:** use renderer state or Yjs transport state as the independent document authority. Rejected because it can diverge from durable content or let external inputs bypass validation.

### Adapter boundaries for renderer, storage, and transport

Use Weave.js as the renderer candidate behind an adapter. Keep local persistence and peer transport behind separate adapters. Yjs with a Trystero/WebRTC adapter is the proposed collaboration path, but network connectivity and participant validation require experiments.

**Alternative considered:** bind the document contracts directly to a particular transport or storage API. Rejected until compatibility, recovery, and failure tests establish the contract.

### Keep the S0 compatibility probe isolated from the product

Use the pinned Weave renderer and only the required frontend composition in a separately invoked Tauri/WebView test probe. One controlled fixture exercises native launch, rendering, selection, transforms, connector rendering, and one in-memory store-backed edit. Record exact OS/WebView/dependency versions and adopted source notices; report native compilation separately from interaction results. A blocked required behavior needs a blocking issue and explicit fallback decision.

The probe does not introduce a second product document model, durable storage, persisted Yjs updates, or user save/open/recovery workflows. The normal application retains its honest scaffold state. This test instrumentation is excluded from normal production builds.

### Keep local storage choice behind a recovery experiment

Do not select SQLite, a Tauri storage plugin, IndexedDB, or persisted Yjs updates in this change. WP-03 compares viable options and chooses one durable source of truth with rebuildable caches and indexes.

**Alternative considered:** select a database before modeling recovery. Rejected because cross-platform atomicity, backup behavior, migration, and crash recovery are not yet measured.

### Use capability invitations, but do not equate a link with identity

The invitation contract requires at least 256 bits of cryptographic entropy, expiry, optional host admission, viewer/editor roles, secret redaction, and revocation of future access. The detailed cryptographic construction and read-only enforcement must pass a security review before implementation.

**Alternative considered:** public room names or mandatory centralized identity. Rejected because neither fits the stated temporary private-session goal without separate security or infrastructure requirements.

### Keep AI optional and treat it as a proposer

Plan an optional provider boundary. Current official OpenAI documentation describes Sign in with ChatGPT plan usage for eligible open-source/local apps through OAuth and the Codex app-server, but marks the usage flow as a preview and documents request/tool limitations. WP-09 must recheck the current registration, terms, callback, token-storage, model, and usage requirements before implementing it. No login or model call has been made.

Every mutating AI or MCP operation uses the validated command boundary and requires a user-visible preview and approval.

**Alternative considered:** a shared server-side API key or hosted proxy. Rejected because it would make a local-first desktop project carry centralized credentials and operational costs.

### Treat draw.io support as an explicit subset

Parse files into temporary validated state, publish a compatibility matrix, report known semantic losses, and preserve unsupported source fragments only when safe and within resource limits.

**Alternative considered:** claim full format parity or silently omit unknown data. Rejected because the file format includes compressed content, metadata, styles, custom elements, and embedded assets with different semantics.

### Plan skills after the real tools exist

User-facing Codex skills remain a later capability. They can be distributed only after each referenced MCP tool is implemented, verified, and reviewed.

**Alternative considered:** ship skill prompts against planned tool names. Rejected because this would advertise non-existent behavior and make the permissions contract unverifiable.

## Risks / Trade-offs

- **Weave does not work in one target WebView** → WP-01 gates canvas implementation on a three-platform compatibility spike; update ADR-0001 before choosing a fallback.
- **Local saves can corrupt user data** → WP-03 tests atomic writes, interrupted saves, migrations, and recovery before selecting a store.
- **Some peer networks cannot connect directly** → WP-07 records LAN, NAT, STUN, and TURN results and exposes connection failure; no universal-connectivity claim is allowed.
- **Yjs updates cannot safely enforce viewer roles by UI alone** → WP-08 validates authorization at the command boundary and runs negative tests against direct remote mutation paths.
- **A participant copies content before revocation** → the invitation specification limits revocation to future session access and requires that limit to be disclosed.
- **ChatGPT-plan usage eligibility or limits change** → WP-09 rechecks official documentation and terms; local editing remains available without that provider.
- **Imported XML/SVG contains active or resource-intensive input** → WP-06 and WP-11 apply parser limits, sanitization, and hostile fixtures.
- **Bundled logos or stencils have separate rights** → WP-05 blocks an asset from distribution until provenance and redistribution permission are recorded.
- **Automated builds overstate platform readiness** → the release evidence distinguishes compilation from native launch, webview, deep-link, WebRTC, and accessibility checks.

## Migration Plan

This change has no normal-app runtime or stored-data migration. The compatibility probe operates only on temporary fixture data. Review the proposal, 18 specs, design, and task list as one product-contract baseline with a bounded S0 validation harness. After maintainer approval, product behavior changes will use new OpenSpec changes, implementation branches from dev, PRs to dev, and sprint promotion PRs to main. Any change to an approved requirement must update the relevant spec and traceability before implementation continues.

## Open Questions

The storage engine, precise supported OS versions, TURN service and credentials, cryptographic invitation construction, draw.io compatibility corpus, shape asset set, and OpenAI OAuth client registration are intentionally delegated to the validation work packages in PLANS.md. They do not block this behavior baseline; each must be resolved with evidence before the dependent implementation starts.
