# Spec Delta

## Purpose

Defines the evidence and release disclosures required to support PeerCanvas across Windows, macOS, and Linux with their distinct native webview and operating-system behavior.

## ADDED Requirements

### Requirement: Maintain a declared platform matrix

The project SHALL publish the supported operating system versions and native webview/runtime combinations for each release.

#### Scenario: Platform support changes

- **WHEN** a platform version is added, removed, or changes its minimum
- **THEN** the support matrix and release notes identify the change and its verification evidence

### Requirement: Validate native behavior per platform

The project SHALL distinguish frontend compilation from native desktop build and smoke evidence for each declared platform.

#### Scenario: Frontend build passes on one OS

- **WHEN** the frontend build succeeds on a single runner
- **THEN** the project does not claim native desktop behavior is verified on the other operating systems

### Requirement: Report platform-specific limitations

The system SHALL present a clear error or documented limitation when a native capability is unavailable on a declared platform.

#### Scenario: Native capability is unavailable

- **WHEN** the platform does not provide a required native capability
- **THEN** the user receives a visible error or alternative workflow instead of a silent failure
