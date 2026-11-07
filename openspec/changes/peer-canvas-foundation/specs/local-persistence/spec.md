# Spec Delta

## Purpose

Defines durable local document workflows and protects the user's last known-good data across normal errors and interrupted writes.

## ADDED Requirements

### Requirement: Create, open, and save local documents

The system SHALL allow users to create, open, save, rename, and close diagram documents on the local device.

#### Scenario: Save and reopen a document

- **WHEN** a user saves a valid document and later reopens it
- **THEN** the supported document content is restored

#### Scenario: Cancel an unsaved close

- **WHEN** the user chooses to cancel a close with unsaved changes
- **THEN** the document remains open with its changes intact

### Requirement: Preserve the last known-good document

A failed or interrupted save SHALL NOT silently replace the last known-good document with incomplete content.

#### Scenario: Storage write fails

- **WHEN** a save fails because of an I/O or permission error
- **THEN** the system reports the error and retains the last known-good document state

#### Scenario: Recover after interruption

- **WHEN** the application restarts after an interrupted write
- **THEN** it offers the last complete state or a non-destructive recovery option

### Requirement: Keep preferences separate from document content

The system SHALL store application preferences separately from diagram content.

#### Scenario: Change a local preference

- **WHEN** a user changes an application preference
- **THEN** the preference is persisted without changing the active diagram document

### Requirement: Preserve document schema version

The system SHALL persist a schema version with each document and use declared migrations when opening older supported documents.

#### Scenario: Migration is unavailable

- **WHEN** the persisted schema cannot be safely migrated
- **THEN** the source remains unchanged and the user receives an explicit unsupported-version error
