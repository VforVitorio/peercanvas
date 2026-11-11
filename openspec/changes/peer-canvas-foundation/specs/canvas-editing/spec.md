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
- **THEN** supported rendered geometry reflects the command and the relevant inspector or list shows the accepted properties

### Requirement: Edit selected elements

The editor SHALL allow a user to select, move, resize, and remove supported elements through visible canvas interactions.

#### Scenario: Move a selected element

- **WHEN** the user moves a selected element and completes the gesture
- **THEN** the element's document position changes and is reflected in the canvas

#### Scenario: Cancel an edit gesture

- **WHEN** the user cancels an in-progress gesture
- **THEN** no incomplete mutation is committed to the document

### Requirement: Inspect and edit supported properties

The editor SHALL show the declared properties of a selected node or connection and submit supported edits through the validated document command boundary.

#### Scenario: Inspect a selected element

- **WHEN** the user selects a node or connection
- **THEN** the inspector shows its supported text, geometry, endpoint, label, routing, and appearance values
- **AND** the connection list identifies the selected connection and the inspector shows its endpoints and supported properties

#### Scenario: Apply a supported property edit

- **WHEN** the user applies a valid node text/geometry or connection endpoint/label edit
- **THEN** a validated command updates the canonical document and the relevant rendered geometry, inspector, or list reflects the accepted value

#### Scenario: Reject an invalid property edit

- **WHEN** a property edit violates document validation
- **THEN** the document remains unchanged and the inspector explains the error

### Requirement: Navigate ordered pages and layers

The editor SHALL allow a user to switch between the document's ordered pages and layers and create or rename them through validated commands.

#### Scenario: Change the active page or layer

- **WHEN** the user selects a different page or layer
- **THEN** the canvas displays that page's content, the active layer is identified, and transient selection is reconciled

#### Scenario: Add or rename a page or layer

- **WHEN** the user adds or renames a page or layer with valid values
- **THEN** the canonical order and identifiers are preserved and the change is reflected by the editor

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
