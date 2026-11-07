# Spec Delta

## Purpose

Defines the participant and cursor information visible during a shared session and keeps ephemeral awareness separate from durable diagram content.

## ADDED Requirements

### Requirement: Show active participant presence

The system SHALL show the current connection state and presence of participants in an active collaborative session.

#### Scenario: Participant joins

- **WHEN** a participant is admitted to a session
- **THEN** other participants can see that the participant is present with the assigned display identity and role

#### Scenario: Participant disconnects

- **WHEN** a participant disconnects or leaves
- **THEN** the session presence view marks that participant as disconnected or removes the active presence

### Requirement: Share cursor awareness only within the session

The system SHALL share a participant's cursor or selection awareness only with participants in the same active session.

#### Scenario: Cursor moves during a session

- **WHEN** a participant moves their cursor in a shared session
- **THEN** other admitted participants can observe the cursor state without changing the document

### Requirement: Keep awareness out of durable document state

The system SHALL keep presence and cursor awareness separate from persisted diagram content.

#### Scenario: Save while peers are present

- **WHEN** the host saves a document while a peer is connected
- **THEN** transient cursor and presence data are not written as diagram content
