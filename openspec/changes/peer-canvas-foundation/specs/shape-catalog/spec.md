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
- **THEN** matching entries are returned from local data

### Requirement: Distribute only reviewed assets

The system SHALL NOT make an asset usable or bundle it unless its source, version, license, attribution obligations, and redistribution permission have been reviewed and redistribution is explicitly permitted.

#### Scenario: Asset rights are unknown

- **WHEN** an asset has no documented redistribution permission
- **THEN** the asset is not included in the bundled catalog
