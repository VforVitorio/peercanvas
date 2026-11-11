# Spec Delta

## Purpose

Defines durable local document workflows and protects the user's last known-good data across normal errors and interrupted writes.

## ADDED Requirements

### Requirement: Create, open, and save local documents

The system SHALL allow users to create, open, save, rename, and close diagram documents on the local device.

#### Scenario: Save and reopen a document

- **WHEN** a user saves a valid document and later reopens it
- **THEN** the supported document content is restored

#### Scenario: Rename a document title

- **WHEN** the user renames an open document and saves it
- **THEN** the new title is restored on reopen and the document path remains unchanged

#### Scenario: Save a copy to a new path

- **WHEN** the user uses Save As and selects a new path
- **THEN** the new file contains the current supported document and the prior file remains unchanged

#### Scenario: Cancel an unsaved close

- **WHEN** the user chooses to cancel a close with unsaved changes
- **THEN** the document remains open with its changes intact

#### Scenario: Cancel a native app-menu quit

- **WHEN** the user requests quit from a native app menu or its keyboard shortcut on a platform that exposes that action
- **THEN** the same Save, Discard, or Cancel decision is shown, and Cancel leaves the document and application open

### Requirement: Preserve the last known-good document

A failed or interrupted save SHALL NOT silently replace the last known-good document with incomplete content.

#### Scenario: Storage write fails

- **WHEN** a save fails because of an I/O or permission error
- **THEN** the system reports the error and retains the last known-good document state

#### Scenario: Recover after interruption

- **WHEN** the application restarts after an interrupted write
- **THEN** it opens the last complete saved state or offers a validated prior complete backup without overwriting the damaged source

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

#### Scenario: Save after migrating a supported version

- **WHEN** the user opens a supported older document version and saves the migrated document
- **THEN** the new save uses the current schema version and the original source remains unchanged until that save succeeds
