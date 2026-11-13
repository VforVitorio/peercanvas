# Proposal

## Why

The production workspace needs persistent appearance and language controls before the PMV. A local light/dark toggle and complete English/Spanish resources make the editor usable across preferred environments without changing the diagram or requiring a network service.

## What Changes

- Add application-level appearance and language preferences, stored separately from diagram documents.
- Add clearly labeled System/Light/Dark preferences and a short color transition that respects reduced-motion settings, with no startup transition.
- Add complete English and Spanish local resources for visible text, errors, and accessible labels; review Spanish for natural, consistent wording.
- Define startup locale fallback and preference migration before implementation.
- Keep the canvas paper and explicit document styles independent from the surrounding editor theme.

## Capabilities

### New Capabilities

- `user-preferences`: Persistent local appearance and language choices, kept separate from diagrams and document history.
- `localization`: English and Spanish user-interface resources and locale-aware formatting.

### Modified Capabilities

None. The existing foundation change defines FR-016's separation boundary; this change adds theme and localization behavior as new capabilities.

## Impact

The desktop preference store, production React UI, CSS theme tokens, user-facing strings, accessibility labels, tests, product definition, and S8/WP-13 tracking are affected. No runtime dependency is selected in this proposal; message-format needs will be reviewed before implementation. The UI demonstration is a visual reference only and is not a source of production code.

The maintainer approved implementation on 2026-11-13 together with `editor-workspace-refresh`, advancing this bounded S8 scope ahead of S4. No document schema change, collaboration, grouping, onboarding, or publication is included.
