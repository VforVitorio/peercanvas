# Spec Delta

## Purpose

Defines test evidence and release quality gates so product claims can be traced to repeatable checks rather than inferred from source or a single build.

## ADDED Requirements

### Requirement: Verify each declared requirement

Every in-scope functional and non-functional requirement SHALL have an acceptance scenario and automated or documented manual verification before release.

#### Scenario: Requirement has no evidence

- **WHEN** a requirement has no automated or documented manual evidence
- **THEN** the release record marks it unverified and does not claim it as complete

### Requirement: Record test environment and result

Performance and platform claims SHALL identify the tested machine, operating system/runtime, fixture, method, repetitions, and result.

#### Scenario: Report a performance measurement

- **WHEN** a performance result is published
- **THEN** the report includes the test conditions and does not generalize beyond the evidence

### Requirement: Test failure and recovery paths

The project SHALL verify error, cancellation, interruption, and recovery behavior for document storage, imports, collaboration, and AI/MCP operations.

#### Scenario: Failure-path check is missing

- **WHEN** a release contains a capability without tested failure behavior
- **THEN** the release record identifies the gap and the maintainer disposition

### Requirement: Review dependency and asset risks

Before release, the project SHALL review dependency vulnerabilities and third-party asset rights and record any accepted unresolved risk.

#### Scenario: High-severity finding remains open

- **WHEN** a critical or high finding has no resolution
- **THEN** the release is blocked unless the maintainer records an explicit disposition
