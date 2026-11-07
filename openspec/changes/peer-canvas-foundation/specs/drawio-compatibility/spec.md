# Spec Delta

## Purpose

Defines the supported draw.io document subset and how the application reports unsupported or lossy content during interchange.

## ADDED Requirements

### Requirement: Publish the supported draw.io subset

The system SHALL document the draw.io formats and semantic features it supports for each release.

#### Scenario: Import a supported document

- **WHEN** a user imports a document using a declared supported format and feature subset
- **THEN** the system maps supported semantics into the active document and reports any unsupported content

### Requirement: Report unsupported draw.io content

The system SHALL identify unsupported or lossy constructs before the user confirms an import or export that would discard their meaning.

#### Scenario: Import includes an unsupported construct

- **WHEN** an imported document contains a construct outside the declared supported subset
- **THEN** the system presents a compatibility report and does not silently claim full fidelity

#### Scenario: Export would lose content

- **WHEN** exporting would omit or change supported source content
- **THEN** the system reports the known loss before writing the destination file

### Requirement: Preserve safe unsupported source content

The system SHALL preserve unsupported source fragments for possible round-trip only when doing so is safe and within documented resource limits.

#### Scenario: Preserve an unknown safe fragment

- **WHEN** an unknown fragment is within configured limits and passes safety checks
- **THEN** the system retains it without executing or rendering it as trusted content

### Requirement: Reject unsafe or over-limit files

The system SHALL reject files that exceed documented parser, decompression, nesting, or resource limits without partially changing the active document.

#### Scenario: Input exceeds a limit

- **WHEN** the importer detects an unsafe or over-limit input
- **THEN** it stops parsing, reports the limit, and leaves the active document unchanged
