# Proposal

## Why

PeerCanvas has a product vision and a minimal desktop shell, but no versioned behavioral contracts linking requirements, architecture, security, work packages, and future GitHub work. Establishing one reviewable product baseline now prevents implementation from making incompatible choices about the document model, persistence, collaboration, imports, and AI authority.

The selected rendering stack also needs a bounded native compatibility gate before product editing work starts. S0 uses an isolated test-only Tauri/Weave probe to collect that evidence while the normal app remains the engineering scaffold.

## What Changes

- Add versioned baseline specifications for the product's 18 requested capabilities.
- Define user-facing behavior, acceptance scenarios, and security boundaries without implementing product features.
- Record proposed architecture decisions, validation experiments, and cross-capability dependencies.
- Link the specifications to the repository's product definition and work-package plan.
- Add a separately invoked S0 compatibility probe for native rendering, selection, transforms, connector rendering, and one in-memory Weave-store-backed edit; exclude its fixture and instrumentation from normal production builds.
- Require explicit maintainer review before any implementation of these capabilities.

## Capabilities

### New Capabilities

- **desktop-application**: Launch PeerCanvas as an optional-service desktop app on declared supported operating systems.
- **document-model**: Define the versioned canonical diagram document and validated mutation boundary.
- **canvas-editing**: Describe model-backed canvas interactions and selection behavior.
- **diagram-shapes**: Define nodes, connectors, and their shape/connection semantics.
- **shape-catalog**: Describe discoverable local libraries and asset provenance.
- **drawio-compatibility**: Define a safe, declared draw.io compatibility subset.
- **local-persistence**: Define local document and preference persistence.
- **p2p-collaboration**: Define optional Yjs synchronization over a replaceable peer transport.
- **secure-session-invitations**: Define temporary session links, admission, roles, expiry, and revocation.
- **presence-awareness**: Define ephemeral participant and cursor state separately from the document.
- **history-recovery**: Define undo/redo, checkpoints, and non-destructive recovery.
- **import-export**: Define document import/export boundaries and loss reporting.
- **codex-embedded-chat**: Define optional provider-backed chat and user-approved change proposals.
- **mcp-integration**: Define bounded, model-level MCP tools and the approval boundary.
- **user-codex-skills**: Define conditions for packaging user-facing skills after tools are verified.
- **security-privacy**: Define trust boundaries, secret handling, and permission enforcement.
- **cross-platform-compatibility**: Define supported OS evidence and platform-specific validation.
- **quality-testing**: Define verifiable quality, testing, and release evidence.

### Modified Capabilities

None. The repository has no existing OpenSpec baseline specifications.

## Impact

This change establishes OpenSpec planning artifacts and an isolated test-only compatibility probe, with references to the product definition, architecture, ADRs, risk register, and delivery plan. The normal application remains the engineering scaffold. The probe uses temporary fixture data and does not introduce a user document format, durable store, external API, or released editor capability. Product implementation of the React/Tauri editor, canonical document/persistence model, peer transport, import/export, and optional Codex/MCP process boundary remains outside this S0 scope.
