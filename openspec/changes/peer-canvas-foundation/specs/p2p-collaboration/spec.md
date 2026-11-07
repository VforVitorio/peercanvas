# Spec Delta

## Purpose

Defines optional peer-to-peer collaboration behavior while keeping the host's durable local document usable when peers or network services are unavailable.

## ADDED Requirements

### Requirement: Synchronize concurrent document updates

The system SHALL synchronize accepted concurrent document updates among connected session participants and converge on the same supported document state.

#### Scenario: Two peers edit concurrently

- **WHEN** two connected participants make valid concurrent edits
- **THEN** each participant eventually observes the same converged document state

### Requirement: Initialize a joining peer

The system SHALL provide a joining participant with the current session document state before declaring that participant ready to collaborate.

#### Scenario: Participant completes initial sync

- **WHEN** a participant joins and initial synchronization completes
- **THEN** the participant sees the current document and an explicit connected state

### Requirement: Preserve local work through network loss

The system SHALL retain the host's last durable local document when a peer connection or signaling path fails.

#### Scenario: Peer connection is interrupted

- **WHEN** a participant loses the network connection
- **THEN** the application reports the disconnected state and does not delete or corrupt the host's local document

### Requirement: Surface transport limitations

The system SHALL expose connection failures and retry status without promising that every pair of networks can establish a direct connection.

#### Scenario: Direct peer connection is unavailable

- **WHEN** the configured network path cannot connect the peers
- **THEN** the application explains the failure and provides the documented retry or fallback choices

### Requirement: Validate remote document changes

The system SHALL validate remote document changes against the same document invariants and session permissions used for local mutations.

#### Scenario: Remote change violates an invariant

- **WHEN** a peer sends a change that violates the document schema or its assigned permission
- **THEN** the change is rejected and the local document remains valid
