# Spec Delta

## Purpose

Defines local appearance and language preferences independently from a user's diagram documents and editing history.

## ADDED Requirements

### Requirement: Persist desktop preferences separately

The system SHALL store the user's appearance and language choices separately from diagram content and document history.

#### Scenario: Change a preference

- **WHEN** the user changes the theme or interface language
- **THEN** the preference is saved without changing the active document revision, dirty state, or undo history

#### Scenario: Existing preferences are upgraded

- **WHEN** a supported application preference file lacks the new fields
- **THEN** the application preserves existing fields, applies defaults for missing fields, and leaves diagram files unchanged

#### Scenario: Save and update preferences concurrently

- **WHEN** the last-document record and appearance/language choices are updated consecutively or concurrently
- **THEN** serialized partial updates preserve all fields and a pre-migration backup remains available

#### Scenario: A preference write fails

- **WHEN** a selected preference cannot be persisted
- **THEN** it applies for the current session with an accessible warning and no change to document content, revision, dirty state, or history

### Requirement: Let the user choose the editor theme

The system SHALL provide accessible System, Light, and Dark choices for application chrome and SHALL keep diagram appearance independent from that choice.

#### Scenario: Switch from light to dark

- **WHEN** the user activates the theme control
- **THEN** the application chrome changes to the selected theme while the diagram paper and explicit diagram styles remain unchanged

#### Scenario: Use the operating-system theme before a choice

- **WHEN** no saved theme choice exists
- **THEN** the application follows the operating-system appearance preference

#### Scenario: Load saved preferences

- **WHEN** native preference loading finishes after system appearance was initially displayed
- **THEN** the saved preference takes effect without an initial animation or second persistent cache

### Requirement: Respect reduced motion during theme changes

The system SHALL limit theme transitions to a brief color and surface change and SHALL reduce or remove that transition when the operating system requests reduced motion.

#### Scenario: Reduced motion is enabled

- **WHEN** the user switches theme while reduced motion is enabled
- **THEN** the application changes theme without a non-essential animated transition
