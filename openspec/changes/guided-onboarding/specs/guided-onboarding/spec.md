# Spec Delta

## Purpose

Defines optional guided tours that teach verified PeerCanvas workflows without changing a user's active document or leaving the local application boundary.

## ADDED Requirements

### Requirement: Offer restartable tours for verified workflows

The system SHALL offer optional guided tours only for workflows that are implemented and included in the reviewed PMV journey inventory.

#### Scenario: Start a reviewed tour

- **WHEN** the user starts a tour for an implemented workflow
- **THEN** the tour presents the reviewed steps for that workflow and can be started again later

#### Scenario: A planned workflow is not implemented

- **WHEN** no implemented workflow matches a planned tour
- **THEN** the application does not offer that tour or claim that the workflow is available

### Requirement: Keep tour state isolated from active work

The system SHALL run tour previews without mutating the active document, changing its route, replacing drafts, or calling file, network, collaboration, or provider operations.

#### Scenario: Browse a tour while a document is open

- **WHEN** the user advances, skips, or closes the tour
- **THEN** the active document, selection, history, route, and draft remain unchanged

### Requirement: Make spotlight tours operable and recoverable

The system SHALL provide keyboard operation, a visible close action, focus restoration, and a useful fallback when a spotlight target is missing or outside the visible area.

#### Scenario: Close a tour with the keyboard

- **WHEN** the user presses Escape or activates the close action
- **THEN** the tour closes and focus returns to the control that started it

#### Scenario: A target moves or is unavailable

- **WHEN** the window resizes, scrolls, advances steps, or the target cannot be found
- **THEN** the spotlight is recalculated or the tour presents a clear fallback instead of pointing at stale content

### Requirement: Localize tour content and respect motion preferences

The system SHALL provide tour text in the selected interface language and SHALL reduce non-essential spotlight motion when the operating system requests reduced motion.

#### Scenario: Use a tour in Spanish

- **WHEN** the selected interface language is Spanish
- **THEN** tour titles, instructions, controls, and accessible names use reviewed Spanish resources

#### Scenario: Reduced motion is enabled

- **WHEN** the user advances a tour with reduced motion enabled
- **THEN** the spotlight changes without non-essential animated movement
