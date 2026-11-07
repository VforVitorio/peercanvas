# Spec Delta

## Purpose

Defines security and privacy requirements that apply across local files, imports, peer sessions, AI providers, and MCP clients.

## ADDED Requirements

### Requirement: Treat external inputs as untrusted

The system SHALL validate imported files, peer messages, provider output, and MCP arguments before they can affect document state.

#### Scenario: External input is invalid

- **WHEN** an external input fails schema, size, or permission validation
- **THEN** the system rejects it without partially changing the document

### Requirement: Enforce roles at the mutation boundary

The system SHALL enforce document and session roles for every supported mutation path, independent of whether a user interface control is visible.

#### Scenario: Viewer attempts a mutation

- **WHEN** a viewer submits a document mutation through the UI, a peer message, or an MCP call
- **THEN** the system rejects the mutation and preserves the document

### Requirement: Protect credentials and session secrets

The system SHALL NOT expose OAuth credentials or invitation secrets to the renderer, ordinary logs, telemetry, or crash reports.

#### Scenario: Diagnostic output is generated

- **WHEN** the application records an error or diagnostic event
- **THEN** credentials, invitation secrets, and complete invitation links are redacted

### Requirement: Disclose external data sharing

The system SHALL disclose when document content or selected diagram context leaves the local device and require user action before sharing it with an AI provider.

#### Scenario: AI context is not enabled

- **WHEN** the user sends a prompt without enabling diagram context
- **THEN** the system does not include the document or selection in the provider request

### Requirement: Do not execute imported active content

The system SHALL NOT execute scripts or fetch external content embedded in imported XML or SVG documents.

#### Scenario: Import contains active content

- **WHEN** imported content contains script, event handlers, or external resource references
- **THEN** the system rejects or sanitizes the content before display or export
