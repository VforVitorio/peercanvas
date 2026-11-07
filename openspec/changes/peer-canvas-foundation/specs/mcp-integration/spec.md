# Spec Delta

## Purpose

Defines the structured interface through which an MCP client can inspect a diagram or propose document operations without bypassing PeerCanvas validation, permissions, or user approval.

## ADDED Requirements

### Requirement: Provide bounded read tools

The system SHALL provide MCP read operations for the explicitly selected document, current selection, and available shape search.

#### Scenario: Read the active document

- **WHEN** an authorized MCP client requests document information
- **THEN** the system returns a bounded structured view of the explicitly selected document

#### Scenario: No active document is selected

- **WHEN** a read tool is called without an active document scope
- **THEN** the system returns a structured error and does not choose another document implicitly

### Requirement: Validate tool inputs and permissions

The system SHALL validate each tool request against its declared schema, document scope, and current session role before returning data or a proposal.

#### Scenario: Tool request is malformed or unauthorized

- **WHEN** a request has invalid arguments or exceeds the caller's permissions
- **THEN** the system returns a structured error and makes no document mutation

### Requirement: Require approval for mutating tools

MCP operations that create, modify, delete, connect, lay out, or export document content SHALL be presented as a proposal and require explicit user approval before execution.

#### Scenario: User declines a proposed operation

- **WHEN** the user rejects or cancels an MCP mutation proposal
- **THEN** the document remains unchanged

#### Scenario: User approves a valid operation

- **WHEN** the user approves a schema-valid operation allowed by the current document role
- **THEN** the system applies it through the normal document command boundary

### Requirement: Record safe operation outcomes

The system SHALL expose success, failure, denial, and cancellation outcomes without exposing credentials or invitation secrets.

#### Scenario: Tool operation fails validation

- **WHEN** a proposal fails document validation
- **THEN** the client receives a structured error and the document remains unchanged
