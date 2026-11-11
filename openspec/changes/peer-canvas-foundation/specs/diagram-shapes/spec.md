# Spec Delta

## Purpose

Defines the semantic behavior of diagram nodes and connections, including their identifiers, editable properties, and valid endpoint relationships.

## ADDED Requirements

### Requirement: Represent supported diagram nodes

The system SHALL represent each node with a stable identifier, declared shape type, geometry, and validated shape properties.

#### Scenario: Add a supported node

- **WHEN** the user adds a supported shape to an editable page
- **THEN** the document contains one node with valid geometry and properties

#### Scenario: Reject an unsupported node type

- **WHEN** a command requests a shape type that is not available
- **THEN** the system rejects the command without changing the document

### Requirement: Represent connections between valid endpoints

The system SHALL represent a connection with a stable identifier and references to valid nodes on the applicable page.

#### Scenario: Connect two existing nodes

- **WHEN** the user creates a connection between two valid nodes
- **THEN** the connection references both endpoints and preserves its supported routing and style properties

#### Scenario: Edit a connection

- **WHEN** the user changes a connection's label or endpoints to valid nodes on the same page
- **THEN** the stable connection identifier is retained, the canvas line reflects the accepted endpoints, and the connection list/inspector show the accepted label and properties

#### Scenario: Reject a missing endpoint

- **WHEN** a connection references a node that does not exist on the page
- **THEN** the system rejects the connection and leaves the document unchanged

#### Scenario: Reject an endpoint on another page

- **WHEN** the user edits a connection to reference a node on a different page
- **THEN** the system rejects the command and leaves the document unchanged

### Requirement: Preserve supported shape properties

The system SHALL preserve each supported shape's documented properties when a document is saved and reopened.

#### Scenario: Reopen a styled shape

- **WHEN** a document containing a supported styled node is reopened
- **THEN** its declared geometry, text, and style values are retained
