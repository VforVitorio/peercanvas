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

#### Scenario: Migrate schema v1

- **WHEN** the system opens a valid schema-v1 document
- **THEN** it migrates to schema v2, preserves all supported content, initializes catalog references to null, and reports that saving will update the document format

### Requirement: Retain catalog references and safe interchange fragments

Schema v2 SHALL store an optional stable shape identifier and asset version on each catalog-backed node, and SHALL retain bounded inert draw.io source fragments with source page/cell IDs separately from rendered document content.

#### Scenario: Reopen a catalog-backed shape

- **WHEN** a schema-v2 document is saved and reopened
- **THEN** each catalog-backed node retains its stable shape identifier and asset version

#### Scenario: Reopen preserved draw.io fragments

- **WHEN** a schema-v2 document with safe draw.io source fragments is saved and reopened
- **THEN** the fragments and source-ID mappings remain available to the interchange exporter and are never rendered or executed

#### Scenario: Reject invalid compatibility data

- **WHEN** compatibility data has an unsupported format, invalid page reference, or exceeds its documented bounds
- **THEN** document validation fails without partially loading the document
