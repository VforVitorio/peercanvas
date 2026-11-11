# Design

## Context

See [proposal.md](proposal.md) and the two capability contracts in `specs/`. FR-016 already requires application preferences to remain outside diagram documents. The current product code stores only the last-document path; the UI demonstration has a temporary light/dark control and keeps the diagram paper white. Neither demo behavior nor temporary preferences count as production implementation.

## Goals / Non-Goals

**Goals:**

- Extend local preferences without changing `.peercanvas` documents or `last_document` behavior.
- Use one selected theme and locale across the production workspace, dialogs, errors, and accessible names.
- Keep English/Spanish resources local and check them for key and parameter parity.
- Keep the diagram canvas appearance independent from the surrounding application theme.

**Non-Goals:**

- Change document content, explicit diagram colors, save state, or history when a preference changes.
- Localize user-authored diagram text or provider output.
- Add remote translation, network requests, or a localization dependency before message-format needs require one.
- Copy UI demonstration components or code into the production app.

## Decisions

### Extend the existing application preference record

Add optional `theme` and `locale` fields to the app preference record while preserving `last_document`. Missing fields receive defaults; malformed preferences fall back safely and do not block document Open. Store migrations must be bounded, and a preference write failure must not modify or mark the diagram dirty.

**Alternative considered:** store theme/locale in each diagram. Rejected because these choices belong to the user and should follow them across documents.

### Default to the operating-system language and appearance

On first launch, use Spanish or English when the operating-system locale is supported; otherwise use English. Follow system appearance until the user chooses Light or Dark. Explicit choices persist and remain authoritative on later launches.

**Alternative considered:** default every user to English or infer a language from document content. Rejected because the first is less useful to Spanish-speaking users and the second would conflate interface preference with user-authored content.

### Use an explicit theme control and CSS color transition

Place a labeled Light/Dark action in the production View controls and make the selected value available in Preferences. Apply theme tokens to application chrome. Keep the canvas paper white and preserve explicit node/connector styles. Use a short CSS transition for color and surface properties; reduce or remove it under `prefers-reduced-motion`.

**Alternative considered:** animate the full UI tree or diagram contents. Rejected because that adds motion and can change perceived document colors without improving the task.

### Keep locale resources local and complete

Use semantic resource files by locale and UI domain, with matching English/Spanish keys and named parameters. Begin with `common`, `documents`, and `editor`; add `onboarding` when WP-15 is implemented. Format dates and numbers through `Intl`. Keep stable error codes separate from translated user-facing messages. Translate whole phrases instead of joining fragments. Have a fluent Spanish reviewer check the product glossary and copy.

**Alternative considered:** add a message-format dependency immediately. Rejected until actual plural and interpolation requirements are known; resource parity and parameter checks can be tested without committing to a library now.

## Risks / Trade-offs

- **The current preference file is damaged or has a failed migration** → retain the previous valid preference backup where available, fall back to OS defaults, and leave diagrams untouched.
- **A UI string bypasses localization** → audit visible and accessible text, then test resource-key parity and both locales.
- **Theme tokens make diagram content look different** → keep diagram paper and explicit style values independent; verify projection and saved bytes before and after a theme switch.
- **The Spanish text reads as literal translation** → review complete user-facing phrases with a glossary and a fluent reviewer before release.

## Migration Plan

1. Review FR-050, FR-051, UC-11, and the two specs before implementation.
2. Extend the app preference record with defaults that preserve existing `last_document` data.
3. Add the theme control and locale resources; verify switching leaves diagram bytes, revision, dirty state, and history unchanged.
4. Run native preference persistence and UI checks on Windows, macOS, and Linux. Roll back by ignoring the optional preference fields; diagram files require no migration.

## Open Questions

None block the planned implementation. A message-format library can be selected later if the shipped strings require plural or rich-message support.
