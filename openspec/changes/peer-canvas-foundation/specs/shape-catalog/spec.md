# Spec Delta

## Purpose

Defines how users discover installed shape libraries and how the application records provenance, licensing, and review status for distributed assets.

## ADDED Requirements

### Requirement: Describe catalog entries

Every catalog entry SHALL have a stable identifier, display name, category, source, version, license, and review status.

#### Scenario: Display an approved entry

- **WHEN** an installed catalog entry passes manifest validation and rights review
- **THEN** the user can see its name and provenance information

#### Scenario: Reject an incomplete entry

- **WHEN** a catalog entry lacks required metadata or has an invalid manifest
- **THEN** the system excludes it from the usable catalog and reports the validation issue

### Requirement: Search installed shapes offline

The system SHALL allow users to browse and search installed shape entries without network access.

#### Scenario: Search while offline

- **WHEN** a user searches an installed local catalog without network access
- **THEN** matching entries are returned from local data

### Requirement: Distribute only reviewed assets

The system SHALL NOT bundle an asset unless its source, version, license, attribution obligations, and redistribution permission have been reviewed.

#### Scenario: Asset rights are unknown

- **WHEN** an asset has no documented redistribution permission
- **THEN** the asset is not included in the bundled catalog
