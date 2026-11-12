# Spec Delta

## Purpose

Defines how users discover installed shape libraries and how the application records provenance, licensing, and review status for distributed assets.

## ADDED Requirements

### Requirement: Describe catalog entries

The v1 manifest SHALL declare schema version 1. Every catalog entry SHALL have a stable identifier, display name, category, search keywords, source project/URL/revision, asset version, SHA-256 content hash, license identifier/source, attribution text, rights decisions, and review status/reviewer/date.

#### Scenario: Display an approved entry

- **WHEN** an installed catalog entry passes manifest validation and rights review
- **THEN** the user can see its name and provenance information

#### Scenario: Exclude an incomplete or invalid entry

- **WHEN** a catalog entry lacks required metadata or has an invalid manifest
- **THEN** the system excludes it from the usable catalog and reports the validation issue

#### Scenario: Exclude unreviewed entries

- **WHEN** an entry has not been reviewed or its review is rejected
- **THEN** the system excludes it from the usable catalog

#### Scenario: Exclude duplicate identifiers

- **WHEN** two or more entries use the same stable identifier
- **THEN** the system excludes every entry with that identifier and reports the conflict

### Requirement: Search installed shapes offline

The system SHALL allow users to browse and search installed shape entries without network access.

#### Scenario: Search while offline

- **WHEN** a user searches an installed local catalog without network access
- **THEN** case-insensitive substring matches across display name, category, and keywords are returned from local data in deterministic display-name and identifier order

#### Scenario: Browse without a search term

- **WHEN** the user leaves the search field empty
- **THEN** all usable installed entries are shown in deterministic order

### Requirement: Add an approved catalog shape

The system SHALL add a selected usable shape through the validated document command boundary and retain its stable catalog identifier and asset version with the node.

#### Scenario: Add a reviewed shape

- **WHEN** the user selects an approved, available catalog entry
- **THEN** the new node has a stable catalog reference and is rendered using its declared supported node type

#### Scenario: Add an unavailable shape

- **WHEN** the selected entry is invalid, unreviewed, rejected, or unavailable
- **THEN** the system does not mutate the document

### Requirement: Render only safe SVG previews

The system SHALL validate and sanitize SVG previews before rendering them.

#### Scenario: Reject active SVG content

- **WHEN** an SVG contains a script, event handler, external resource, embedded HTML, CSS, unsupported namespace, element, or attribute
- **THEN** the preview is rejected and no active content is rendered

#### Scenario: Reject an over-limit SVG

- **WHEN** the SVG exceeds 256 KiB, 2,000 elements, 32 levels of nesting, or 4,096 characters in an attribute value
- **THEN** the preview is rejected before rendering

### Requirement: Distribute only reviewed assets

The system SHALL NOT make an asset usable or bundle it unless its source, version, license, attribution obligations, and redistribution permission have been reviewed and redistribution is explicitly permitted.

#### Scenario: Asset rights are unknown

- **WHEN** an asset has no documented redistribution permission
- **THEN** the asset is not included in the bundled catalog
