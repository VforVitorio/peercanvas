# Spec Delta

## Purpose

Defines the canonical, versioned semantic representation of a diagram and the validated boundary through which document mutations are accepted.

## ADDED Requirements

### Requirement: Represent a diagram document

A document SHALL represent ordered pages and layers, diagram nodes and connections, styles, metadata, and references needed to interpret its content.

#### Scenario: Create an empty document

- **WHEN** the user creates a document
- **THEN** the system returns a valid document with a stable identifier and at least one editable page

#### Scenario: Preserve document structure

- **WHEN** a document is serialized and loaded
- **THEN** its supported pages, layers, nodes, connections, styles, and metadata retain their semantic values

### Requirement: Assign stable element identifiers

Every document, page, layer, node, and connection SHALL have an identifier that is unique within its required scope and remains stable across save and reopen.

#### Scenario: Create elements with identifiers

- **WHEN** a valid command creates an element
- **THEN** the resulting element has an identifier that does not collide with an existing element in that scope

### Requirement: Validate document mutations

The system SHALL validate each document mutation against the current schema and document invariants before applying any part of the mutation.

#### Scenario: Reject an invalid mutation

- **WHEN** a command references a missing endpoint or violates a document invariant
- **THEN** the command fails with a structured error and the document remains unchanged

#### Scenario: Apply a valid mutation

- **WHEN** a command satisfies the document schema and invariants
- **THEN** the complete mutation is applied as one observable document change

### Requirement: Version document schemas

Persisted documents SHALL identify their schema version, and the system SHALL reject or explicitly migrate unsupported versions without silently discarding content.

#### Scenario: Open a supported older schema

- **WHEN** the system opens a document with a supported older schema version
- **THEN** it performs the declared migration and reports whether the document was changed

#### Scenario: Open an unsupported schema

- **WHEN** the document schema is not supported and no migration exists
- **THEN** the system leaves the source unchanged and explains that it cannot safely open the document
