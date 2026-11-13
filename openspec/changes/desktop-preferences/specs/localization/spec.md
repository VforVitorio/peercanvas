# Spec Delta

## Purpose

Defines the English and Spanish interface behavior so users can operate PeerCanvas in either supported language without sending interface data to a network service.

## ADDED Requirements

### Requirement: Provide complete English and Spanish interface resources

The system SHALL provide English and Spanish resources for all user-visible interface text, including errors, dialogs, help text, and accessible names.

#### Scenario: Change the interface language

- **WHEN** the user selects English or Spanish
- **THEN** the visible interface and its accessible names use the selected language
- **AND** the document language attribute matches the selection while user-authored content stays unchanged

#### Scenario: Translate a native error or loss report

- **WHEN** native storage or draw.io interchange returns a stable message identifier with named parameters
- **THEN** the interface renders its complete translated phrase without weakening validation, confirmations, or source-preservation guarantees

#### Scenario: A translation is missing

- **WHEN** a requested resource key is missing in the selected language
- **THEN** the interface uses its English fallback and does not display an untranslated key

### Requirement: Select and remember the interface language

The system SHALL use the saved language preference when available and SHALL otherwise use a supported operating-system language or English as the fallback.

#### Scenario: Start with a saved language preference

- **WHEN** the application starts with a supported saved language
- **THEN** it uses that language until the user changes it

#### Scenario: Start with an unsupported operating-system language

- **WHEN** no saved preference exists and the operating-system language is unsupported
- **THEN** the interface starts in English

### Requirement: Format localized values for the selected language

The system SHALL format dates and numbers using the selected locale and SHALL insert named values into complete translated phrases.

#### Scenario: Display a localized date or count

- **WHEN** the interface displays a date, number, or count
- **THEN** it formats that value for the selected language without concatenating translated fragments
