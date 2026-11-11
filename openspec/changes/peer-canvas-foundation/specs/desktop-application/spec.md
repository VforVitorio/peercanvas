# Spec Delta

## Purpose

Defines the desktop lifecycle and the requirement that core local document work remains available without optional network or AI services.

## ADDED Requirements

### Requirement: Launch on declared supported operating systems

The system SHALL launch as a desktop application on each operating system and minimum runtime version declared in its support matrix.

#### Scenario: Launch on a supported platform

- **WHEN** a user launches a release on an operating system listed as supported
- **THEN** the main application window becomes interactive without requiring an account

#### Scenario: Unsupported runtime

- **WHEN** the operating system does not meet the published minimum
- **THEN** the application reports that the runtime is unsupported without claiming the platform was tested

### Requirement: Core document work is local-first

The system SHALL allow core document creation, editing, saving, and reopening without requiring a PeerCanvas-hosted service or AI provider.

#### Scenario: Work while offline

- **WHEN** network access and AI integration are unavailable
- **THEN** the user can perform the implemented local document workflows

### Requirement: Publish platform support evidence

Each release SHALL identify the operating system and webview/runtime combinations that were built and smoke-tested.

#### Scenario: Release support matrix

- **WHEN** a release is published
- **THEN** its support notes distinguish automated build evidence from manual native smoke evidence

### Requirement: Include the authorized application icon in native packages

Each reproducible native application package SHALL include the reviewed PeerCanvas icon for its declared operating system.

#### Scenario: Launch a package built from a clean checkout

- **WHEN** a native package is built from the declared source and launched
- **THEN** the operating system displays the authorized PeerCanvas icon in the application surface and the package records reproducible icon inputs
