# Proposal

## Why

The implemented S3 editor exposes real local editing, catalog, and interchange features in a crowded shell. The maintainer approved a production workspace refresh with persistent appearance and language preferences on 2026-11-13, advancing the selected WP-13 work ahead of S4.

## What Changes

- Arrange existing actions in a compact document header, File menu, Shapes/Structure panel, central canvas, and contextual inspector.
- Keep document state, file operations, recovery, validation, and draw.io loss confirmations visible and truthful.
- Provide responsive drawers and keyboard-accessible menus and dialogs, including shortcut help.
- Integrate the `desktop-preferences` change: System/Light/Dark chrome and English/Spanish interface resources, independent from diagram content.
- Retain the existing renderer, command boundary, file format, dependency versions, and reviewed brand assets.

## Capabilities

### New Capabilities

- `editor-workspace`: Responsive, accessible composition of implemented local editing and document workflows.

### Modified Capabilities

None. Theme and localization contracts remain in `desktop-preferences`; existing foundation editing and persistence contracts remain authoritative.

## Impact

Production React composition, panels, CSS, menus, dialogs, localized status presentation, and tests change. Native preferences and typed message contracts are delivered through `desktop-preferences`. Traceability covers FR-003..004, FR-010..012, FR-016, FR-018, FR-021..023, FR-050..051, NFR-010, and WP-13/#93 with #95, #96, #100, and #101. No collaboration, invitations, AI, MCP, grouping, onboarding, demo services, new artwork, or publication is included.
