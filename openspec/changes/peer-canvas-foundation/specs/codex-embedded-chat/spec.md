# Spec Delta

## Purpose

Defines the optional Codex assistant experience, including conversation state, explicit diagram context, streaming, cancellation, and approval of proposed document changes.

## ADDED Requirements

### Requirement: Keep Codex optional

The system SHALL allow users to use core local document workflows without enabling Codex or authenticating with an AI provider.

#### Scenario: User has not configured Codex

- **WHEN** the user opens PeerCanvas without AI credentials
- **THEN** local document workflows remain available and the application does not block editing

### Requirement: Share diagram context explicitly

The system SHALL send document or selection context to the provider only after the user has enabled the assistant and the context is disclosed for the request.

#### Scenario: Ask about the current selection

- **WHEN** the user submits a prompt with selected diagram context enabled
- **THEN** only the disclosed context is included in the provider request

### Requirement: Stream and cancel conversations

The system SHALL display supported streamed responses and allow users to cancel an in-progress request.

#### Scenario: Cancel an active response

- **WHEN** the user cancels a provider response
- **THEN** the system stops the request where supported and makes the interrupted state visible

### Requirement: Preview and approve proposed changes

The system SHALL present proposed document changes for review and require explicit user approval before applying any mutation.

#### Scenario: User rejects a proposal

- **WHEN** the user rejects a proposed change
- **THEN** the document remains unchanged

#### Scenario: User approves a valid proposal

- **WHEN** the user approves a validated proposal
- **THEN** the system applies it through the normal document mutation boundary

### Requirement: Preserve conversation state locally

The system SHALL retain the supported conversation history needed to resume the user's assistant interaction without assuming it exists in ChatGPT conversation history.

#### Scenario: Resume a local conversation

- **WHEN** the user reopens a saved assistant conversation
- **THEN** the application displays its locally retained messages and their outcome state
