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

Add optional `theme` and `locale` fields to the app preference record while preserving `lastDocument` (the existing serialized field). Theme accepts System, Light, and Dark; an unset locale resolves to supported system language, then English. Typed read and partial-update operations share the document persistence mutex so Save/Open cannot overwrite preferences. Missing or malformed fields fall back safely and do not block document Open. Keep reads bounded and preserve the old preference record before migration. A preference write failure applies the choice for this session, displays a warning, and must not modify or mark the diagram dirty.

**Alternative considered:** store theme/locale in each diagram. Rejected because these choices belong to the user and should follow them across documents.

### Default to the operating-system language and appearance

On first launch, use Spanish or English when the operating-system locale is supported; otherwise use English. Follow system appearance until the user chooses Light or Dark. Explicit choices persist and remain authoritative on later launches.

**Alternative considered:** default every user to English or infer a language from document content. Rejected because the first is less useful to Spanish-speaking users and the second would conflate interface preference with user-authored content.

### Use an explicit theme control and CSS color transition

Place labeled System/Light/Dark choices in the production Preferences dialog linked from the compact header. Apply theme tokens to application chrome. Keep the canvas paper white and preserve explicit node/connector styles. Start with system appearance and apply the native result without an initial transition or second persistent cache. Later changes use a short color/surface transition, removed under `prefers-reduced-motion`.

**Alternative considered:** animate the full UI tree or diagram contents. Rejected because that adds motion and can change perceived document colors without improving the task.

### Keep locale resources local and complete

Use semantic resource files by locale and UI domain, with matching English/Spanish keys and named parameters. Begin with `src/i18n/locales/{en,es}/{common,documents,editor}.json`; add `onboarding` resources when WP-15 is implemented. Update `html.lang` and format dates and numbers through `Intl`. At the native/frontend boundary, errors, warnings, and loss reports use stable message identifiers and named parameters; validations and safe source preservation remain unchanged. Translate whole phrases instead of joining fragments. Have a fluent Spanish reviewer check the product glossary and copy.

New-document title, page, and layer defaults use the selected language at creation time. The pure initializer accepts optional validated initial names; no locale state or translation dependency enters the canonical model. Existing names remain unchanged. Resource lookup accepts only own string-valued entries so unknown message identifiers such as prototype property names safely use the localized fallback.

**Alternative considered:** add a message-format dependency immediately. Rejected until actual plural and interpolation requirements are known; resource parity and parameter checks can be tested without committing to a library now.

## Risks / Trade-offs

- **The current preference file is damaged or has a failed migration** → retain the previous valid preference backup where available, fall back to OS defaults, and leave diagrams untouched.
- **An older app version rejects new preference fields during rollback** → preserve the prior preference file in `.bak` before the first upgraded write; rollback must restore that file or reset preferences. The previous version is not assumed to ignore unknown fields, and diagram files remain unaffected.
- **A UI string bypasses localization** → audit visible and accessible text, then test resource-key parity and both locales.
- **Theme tokens make diagram content look different** → keep diagram paper and explicit style values independent; verify projection and saved bytes before and after a theme switch.
- **The Spanish text reads as literal translation** → review complete user-facing phrases with a glossary and a fluent reviewer before release.

## Migration Plan

The maintainer's 2026-11-13 implementation request approves this scope together with `editor-workspace-refresh`, ahead of S4. It does not authorize collaboration, grouping, onboarding, commits, or publication. WP-13 remains traced to #93 and #95/#96/#100/#101; platform acceptance stays open until verified.

1. Review FR-050, FR-051, UC-11, and the two specs before implementation.
2. Extend the app preference record with defaults that preserve existing `last_document` data.
3. Add the theme control and locale resources; verify switching leaves diagram bytes, revision, dirty state, and history unchanged.
4. Run native preference persistence and UI checks on Windows, macOS, and Linux. For rollback, restore the prior preference backup or reset preferences before launching a version that rejects the new fields; diagram files require no migration.

## Open Questions

None block the planned implementation. A message-format library can be selected later if the shipped strings require plural or rich-message support.
