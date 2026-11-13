# Spec Delta

## Purpose

Defines optional peer-to-peer collaboration behavior while keeping the host's durable local document usable when peers or network services are unavailable.

## ADDED Requirements

### Requirement: Synchronize concurrent document updates

The system SHALL synchronize accepted concurrent document commands among connected session participants and converge on the same supported document state. The host SHALL serialize proposals through the canonical command validator before publishing Yjs updates. A stale proposal may be rebased only when its affected IDs do not overlap intervening accepted commands; conflicting or expired proposals are rejected with the current session state.

#### Scenario: Two peers edit concurrently

- **WHEN** two connected participants submit valid concurrent edits to disjoint elements
- **THEN** the host accepts them in sequence and each participant eventually observes the same valid document state

#### Scenario: Concurrent proposals change the same element

- **WHEN** a participant submits a proposal based on an older session revision and an intervening accepted command changed one of its affected IDs
- **THEN** the host rejects the proposal, returns the current state, and leaves the canonical document unchanged

### Requirement: Initialize a joining peer

The system SHALL provide a joining participant with the host's current validated snapshot and subsequent accepted commands before declaring that participant ready to collaborate.

#### Scenario: Participant completes initial sync

- **WHEN** a participant joins and initial synchronization completes
- **THEN** the participant validates the complete snapshot and applies the ordered commit tail before seeing the current document and an explicit ready state

### Requirement: Preserve local work through network loss

The system SHALL retain the host's last durable local document when a peer connection or signaling path fails. The session Y.Doc SHALL remain transient and SHALL NOT replace or create a second durable document store. Network loss SHALL NOT implicitly save or discard unsaved changes.

#### Scenario: Peer connection is interrupted

- **WHEN** the host or a participant loses the peer or signaling path
- **THEN** the application reports the disconnected state and leaves the host's last successfully saved `.peercanvas` document intact; unsaved changes continue to follow the existing save decision

### Requirement: Surface transport limitations

The system SHALL expose sanitized connection failures and retry status through the session API without promising that every pair of networks can establish a direct connection. User-facing share/join controls consume this state under WP-08.

#### Scenario: Direct peer connection is unavailable

- **WHEN** the configured network path cannot connect the peers
- **THEN** the session API reports the failure and exposes retry status for the consuming interface

### Requirement: Validate remote document changes

The host SHALL validate each participant command through `executeCommand` against the canonical document before broadcasting it. Participants SHALL apply host-authored Yjs updates only after replaying and validating the accepted command. Session admission and viewer/editor authorization are owned by WP-08.

#### Scenario: Remote change violates an invariant

- **WHEN** a peer sends a command that violates the document schema or a document invariant
- **THEN** the host rejects it and no participant's canonical document changes

#### Scenario: A peer sends a raw Yjs mutation

- **WHEN** a participant sends a Yjs update that was not authored by the host
- **THEN** every participant ignores it for canonical document state
