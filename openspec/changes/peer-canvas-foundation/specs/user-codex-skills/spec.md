# Spec Delta

## Purpose

Defines when PeerCanvas may distribute Codex skills to users and what each published skill must disclose about its tools and permissions.

## ADDED Requirements

### Requirement: Publish skills only for verified tools

The project SHALL publish a user-facing skill only after every tool and behavior it invokes is implemented, tested, and reviewed.

#### Scenario: Skill references an unavailable tool

- **WHEN** a proposed skill depends on an unimplemented or unverified tool
- **THEN** the project does not publish that skill as usable

### Requirement: Document skill permissions and limits

Each published skill SHALL document its purpose, required tools, permissions, installation, limitations, and examples.

#### Scenario: User reviews a skill before installation

- **WHEN** a user opens the skill documentation
- **THEN** the required tool access and possible document effects are stated before installation

### Requirement: Keep skills optional and removable

The system SHALL allow users to disable or remove PeerCanvas Codex skills without affecting core local document workflows.

#### Scenario: Skill package is removed

- **WHEN** the user removes the optional skill package
- **THEN** local editing, saving, and export workflows remain available
