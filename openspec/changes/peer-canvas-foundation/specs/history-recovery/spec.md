# Spec Delta

## Purpose

Defines how users reverse accepted diagram mutations and recover a complete prior document state after interruption or corruption.

## ADDED Requirements

### Requirement: Undo and redo accepted mutations

The system SHALL allow users to undo and redo supported accepted document mutations in their declared history scope.

#### Scenario: Undo an accepted edit

- **WHEN** the user undoes the latest undoable document edit
- **THEN** the document returns to the prior valid state

#### Scenario: Redo an undone edit

- **WHEN** the user redoes an edit that has not been invalidated by a new branch of edits
- **THEN** the document returns to the state produced by that edit

#### Scenario: Undo a connector or page/layer mutation

- **WHEN** the user undoes an accepted connector, page, or layer mutation
- **THEN** the supported entities, stable identifiers, endpoint references, and ordering return to the prior valid state

### Requirement: Create durable recovery checkpoints

The system SHALL retain a complete recovery checkpoint according to a documented persistence policy.

#### Scenario: Application stops unexpectedly

- **WHEN** the application restarts after an unexpected stop
- **THEN** the user can reopen the last complete checkpoint or review a recoverable newer state

### Requirement: Recover without destructive replacement

The system SHALL NOT overwrite a known-good document during failed recovery or migration.

#### Scenario: Recovery candidate is corrupt

- **WHEN** a recovery candidate fails integrity or schema validation
- **THEN** the system preserves the original document and offers a safe alternative or diagnostic
