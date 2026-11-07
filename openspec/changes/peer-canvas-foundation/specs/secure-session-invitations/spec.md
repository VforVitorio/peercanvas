# Spec Delta

## Purpose

Defines temporary invitations to collaborative sessions and the host controls that govern admission, roles, expiration, and future access.

## ADDED Requirements

### Requirement: Generate a high-entropy invitation

The system SHALL generate a random session identifier and an invitation secret with at least 256 bits of cryptographic entropy.

#### Scenario: Create a session invitation

- **WHEN** the host creates a share invitation
- **THEN** the application generates the session identifier and secret using a cryptographic random source

### Requirement: Protect invitation secrets

The system SHALL keep invitation secrets out of URL query strings, ordinary application logs, telemetry, and crash reports.

#### Scenario: Handle an invitation link

- **WHEN** the application receives an invitation link
- **THEN** it extracts the secret through a channel not sent in ordinary HTTP requests and does not log the complete link

### Requirement: Expire or revoke invitations

The system SHALL allow the host to set an invitation expiry and revoke an invitation or participant.

#### Scenario: Expired invitation is used

- **WHEN** a participant attempts to use an expired invitation
- **THEN** the system denies access and explains that the invitation is no longer valid

#### Scenario: Host revokes a participant

- **WHEN** the host revokes a connected participant
- **THEN** the participant cannot perform future session operations

### Requirement: Require host admission when configured

The system SHALL support a host-controlled admission decision before a joining participant receives document access.

#### Scenario: Host denies admission

- **WHEN** a participant requests to join a session requiring approval and the host denies the request
- **THEN** the participant does not receive the session document

### Requirement: Assign an explicit participant role

The system SHALL assign each admitted participant an explicit viewer or editor role and enforce that role for future session operations.

#### Scenario: Participant joins as viewer

- **WHEN** the host admits a participant with viewer access
- **THEN** that participant cannot mutate the document through any supported session command

### Requirement: Disclose revocation limits

The system SHALL explain that revocation prevents future session access but cannot erase document content already received or copied by a participant.

#### Scenario: Host revokes a peer after data transfer

- **WHEN** a participant has already received document content and the host revokes that participant
- **THEN** the system blocks future access and does not claim to erase the participant's prior copy
