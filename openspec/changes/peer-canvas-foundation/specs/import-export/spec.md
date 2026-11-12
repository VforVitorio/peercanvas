# Spec Delta

## Purpose

Defines explicit document import and export workflows that protect the active document from malformed files, failed writes, and unreported semantic loss.

## ADDED Requirements

### Requirement: Import into a validated document

The system SHALL parse an imported file into temporary state, show its compatibility report, and validate it before changing or creating an active document.

#### Scenario: Import succeeds

- **WHEN** the source file is supported and passes validation
- **THEN** the system presents the imported document and compatibility report without overwriting the source file

#### Scenario: Import fails

- **WHEN** the source is malformed, unsupported, or unsafe
- **THEN** the active document remains unchanged and the user receives a useful error

### Requirement: Export to a user-selected destination

The system SHALL export supported document content to an explicitly selected destination and format, and SHALL ask for confirmation before replacing an existing destination.

#### Scenario: Export succeeds

- **WHEN** the user confirms an export to a writable destination
- **THEN** the system writes a new export containing the supported document semantics

#### Scenario: Export is cancelled or fails

- **WHEN** the user cancels or the destination cannot be written
- **THEN** the active document and any previous destination content remain unchanged

#### Scenario: Confirm an existing destination

- **WHEN** an export destination already exists
- **THEN** the system replaces it only after explicit confirmation and preserves its prior complete contents if export fails

### Requirement: Disclose known transformation losses

The system SHALL disclose known unsupported or lossy transformations before the user confirms an export or import that would discard meaning.

#### Scenario: User declines a lossy export

- **WHEN** the user declines after reviewing the loss report
- **THEN** no export is written
