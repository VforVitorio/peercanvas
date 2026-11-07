# Proposal

## Why

PeerCanvas has a product vision and a minimal desktop shell, but no versioned behavioral contracts linking requirements, architecture, security, work packages, and future GitHub work. Establishing one reviewable product baseline now prevents implementation from making incompatible choices about the document model, persistence, collaboration, imports, and AI authority.

## What Changes

- Add versioned baseline specifications for the product's 18 requested capabilities.
- Define user-facing behavior, acceptance scenarios, and security boundaries without implementing product features.
- Record proposed architecture decisions, validation experiments, and cross-capability dependencies.
- Link the specifications to the repository's product definition and work-package plan.
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

This change creates only OpenSpec planning artifacts and references the existing product definition, architecture, ADRs, risk register, and delivery plan. It affects no application behavior, data format, external API, or released package. Future implementation will affect the React/Tauri shell, Weave adapter, document/persistence model, peer transport, import/export, and optional Codex/MCP process boundary; each remains out of scope for this proposal.
