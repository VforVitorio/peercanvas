# Spec Delta

## Purpose

Defines the user-visible editing and selection behavior for changing a diagram through the canvas while keeping the document model authoritative.

## ADDED Requirements

### Requirement: Render the current document state

The canvas SHALL render the active document's supported diagram elements and reflect accepted document mutations.

#### Scenario: Render a loaded document

- **WHEN** a valid document becomes active
- **THEN** its supported pages and elements are visible on the canvas

#### Scenario: Reflect an accepted command

- **WHEN** a valid model command changes an element
- **THEN** the canvas displays the resulting document state

### Requirement: Edit selected elements

The editor SHALL allow a user to select, move, resize, and remove supported elements through visible canvas interactions.

#### Scenario: Move a selected element

- **WHEN** the user moves a selected element and completes the gesture
- **THEN** the element's document position changes and is reflected in the canvas

#### Scenario: Cancel an edit gesture

- **WHEN** the user cancels an in-progress gesture
- **THEN** no incomplete mutation is committed to the document

### Requirement: Provide keyboard access to essential editing actions

The editor SHALL provide keyboard-operable equivalents for essential selection and editing actions.

#### Scenario: Edit without a pointer

- **WHEN** a user navigates the canvas using a keyboard
- **THEN** the user can reach and perform the documented essential selection and editing actions

### Requirement: Keep selection separate from document content

The system SHALL treat the current selection as transient interaction state unless a specific document command explicitly changes document content.

#### Scenario: Change the selection

- **WHEN** the user selects different elements
- **THEN** the selection changes without altering the saved document content
