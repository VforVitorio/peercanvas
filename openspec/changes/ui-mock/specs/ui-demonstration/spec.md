# Spec Delta

## Purpose

Provide a separately invoked, deterministic demonstration of the planned editor UI and its optional workflows without representing simulated services as implemented product capabilities.

## ADDED Requirements

### Requirement: Isolate and identify the demonstration

The demo SHALL use a separate entry and build output, retain the normal shell and native probe, and persistently identify its data and service results as simulated. It SHALL NOT access real user files, providers, network services, credentials, or persistent browser storage.

#### Scenario: Launch the normal application

- **WHEN** the normal application is built or launched
- **THEN** the demo entry, fixtures, and instrumentation are absent from that application

#### Scenario: Launch the demonstration

- **WHEN** the demo is launched
- **THEN** a persistent notice explains that data is fictional and nothing is saved or sent

### Requirement: Select scenarios and reset deterministically

The demo SHALL offer empty, multi-page/layer diagram, collaboration, and assistant-proposal fixtures, selectable success/wait/cancel/error scenarios, and a reset action that restores deterministic initial state and cancels pending simulated work.

#### Scenario: Reset during pending work

- **WHEN** reset is selected during a waiting operation
- **THEN** the initial fixture and transient UI state are restored and the old operation cannot later modify the reset session

### Requirement: Demonstrate document lifecycle

The demo SHALL provide recent documents, search, create, open, rename, close, simulated save states, and explicit recovery preview and activation. Failed or cancelled replacement SHALL preserve the active document. Every persistence result SHALL be labeled simulated.

#### Scenario: Cancel replacement of a dirty document

- **WHEN** the user cancels the unsaved-changes decision
- **THEN** the active document remains open with its changes

#### Scenario: Recover a fixture

- **WHEN** the user previews and explicitly activates a recovery candidate
- **THEN** the demo displays that candidate and identifies the result as simulated recovery without writing any file

### Requirement: Consume the canonical command boundary

Document mutations SHALL consume the approved S1 snapshot and validated command boundary in memory. The demo SHALL NOT define a competing document schema or authoritative renderer store. Rejected commands SHALL preserve document state and show a safe actionable result.

#### Scenario: Reject an invalid document mutation

- **WHEN** a simulated operation supplies an invalid command
- **THEN** the canonical boundary rejects it and the document remains unchanged

### Requirement: Demonstrate the editor workspace

The demo SHALL expose menus, tools, shape selection, pages, layers, inspector, selection, zoom, and undo/redo history around a Weave canvas. Document actions SHALL use canonical commands; selection and viewport SHALL remain transient. Canvas initialization and failure SHALL be visible.

#### Scenario: Inspect and change an element

- **WHEN** the user selects an element and submits a valid property change
- **THEN** the inspector and canvas reflect the accepted canonical change

#### Scenario: Undo an accepted edit

- **WHEN** the user undoes an accepted edit and then redoes it
- **THEN** the corresponding canonical states are restored through the agreed command integration

### Requirement: Demonstrate interchange outcomes

Import/export SHALL simulate progress, cancellation, errors, and incompatibility reports using deterministic fixtures. Import SHALL preview changes before applying canonical commands. Export SHALL show a simulated outcome without parsing user files, creating downloads, or implying actual format support.

#### Scenario: Cancel import

- **WHEN** an in-progress simulated import is cancelled
- **THEN** the document is unchanged and cancellation is visible

#### Scenario: Inspect incompatibilities

- **WHEN** an incompatible fixture is chosen
- **THEN** the demo lists simulated incompatibilities and the user can decline without changing the document

### Requirement: Demonstrate collaboration and roles

The demo SHALL simulate participants, invitations, admission/denial, roles, revocation, and disconnect/reconnect. Invitations SHALL be visibly fictional and unusable. A simulated viewer SHALL be denied document mutations at the demo service boundary rather than only through hidden controls.

#### Scenario: Admit a viewer

- **WHEN** a pending participant is admitted as viewer
- **THEN** the participant list reflects the role and a viewer mutation attempt is rejected without a document change

#### Scenario: Disconnect the simulated session

- **WHEN** the scenario disconnects peers
- **THEN** the connection state explains the simulation while local editing remains usable

### Requirement: Demonstrate assistant and MCP approval

The demo SHALL simulate conversations, responses, cancellation, errors, and assistant/MCP proposals. Each mutating proposal SHALL show a preview and require explicit approval before canonical commands execute. Rejected, cancelled, stale, or already resolved proposals SHALL NOT mutate the document.

#### Scenario: Reject a proposal

- **WHEN** the user rejects a previewed proposal
- **THEN** the proposal is marked rejected and the document remains unchanged

#### Scenario: Approve a proposal once

- **WHEN** the user explicitly approves a valid pending proposal
- **THEN** its validated commands apply once and a repeated approval cannot apply them again

### Requirement: Provide preferences and assistance

The demo SHALL expose transient preferences, light/dark themes, shortcut help, general help, and existing asset/package attribution. Theme and preference choices SHALL reset without persistent storage. No new unreviewed asset SHALL be introduced.

#### Scenario: Change theme and reset

- **WHEN** the user changes theme and resets the demo
- **THEN** the initial theme returns along with the initial scenario state

### Requirement: Make controls observable and keyboard operable

Every control SHALL perform an observable action or explain its unavailability. Essential flows SHALL be keyboard operable, with accessible names, visible focus, announced results, modal focus containment/restoration, and reduced-motion support. The painted canvas SHALL have an accessible structure/selection alternative.

#### Scenario: Dismiss a dialog with the keyboard

- **WHEN** the user opens a dialog, navigates it by keyboard, and presses Escape
- **THEN** focus stays inside while open and returns to the invoking control after dismissal

#### Scenario: Invoke an unavailable action

- **WHEN** an unavailable control is reached or invoked
- **THEN** it explains the reason without reporting a simulated service as real
