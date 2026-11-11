# Design

## Context

See proposal.md for the motivation and capability list. At the S0 baseline, the normal application contained an empty Tauri/React shell and no product workflows. Later, separately authorized WP-04 tasks added an in-memory editor; WP-03 persistence is now in progress. The S0 probe remains a separately invoked test-only Tauri/WebView check, with its fixture excluded from normal production builds. Current implementation status is recorded in PLANS.md and the session handoff.

The selected baseline is Tauri 2, React 18.3.1, TypeScript, Vite 8, and Weave.js 5.7.1. React 18 is retained because the selected Weave React package's peer range excludes React 19. The S0 probe verifies a bounded fixture on the hosted runner images in `docs/support/platform-matrix.md`; package versions alone remain research facts, and this result does not set minimum OS support floors or establish product editor integration.

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

- Treat the S0 compatibility probe as implementation of product workflows or as approval to replace the normal scaffold.
- Include the compatibility probe or its instrumentation in normal production builds.
- Infer product-level Weave, Tauri WebView, Yjs transport, draw.io, OpenAI auth, or MCP readiness from the bounded probe.
- Select a TURN provider, installer format, supported OS floor, or external shape license without the planned evidence.
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

### Store portable JSON documents through a native adapter

Use one user-selected `.peercanvas` JSON file as the durable document source, using the canonical model's serializer and parser. Keep native dialogs and bounded filesystem operations in Rust commands; keep app preferences in a separate app-data file. Save through a temporary sibling and one prior-version backup. Never publish an incomplete candidate or overwrite the source when recovery validation fails. The detailed policy and measured option comparison are in [ADR-0003](../../../docs/architecture/decisions/ADR-0003-local-persistence.md).

**Alternative considered:** use SQLite as the document source. Rejected for the initial editor because the product's open/save workflow is built around portable user-managed files, and the JSON file already matches the canonical versioned snapshot without a database projection or a separate export/import format. SQLite remains suitable for future indexes if they stay rebuildable and do not become a second semantic authority.

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

The S0 compatibility probe operates only on temporary fixture data and remains excluded from normal builds. Later implementation work follows the task-specific OpenSpec items and GitHub Issues; this session addresses WP-02/WP-03 dependencies and WP-04 acceptance under explicit maintainer authorization. Behavior changes continue to update the relevant spec, issue traceability, and handoff before PR promotion from dev to main.

## Open Questions

The selected local document format and policy are recorded in ADR-0003. Precise supported OS versions, TURN service and credentials, cryptographic invitation construction, draw.io compatibility corpus, shape asset set, and OpenAI OAuth client registration remain delegated to the validation work packages in PLANS.md; each requires evidence before the dependent implementation starts.
