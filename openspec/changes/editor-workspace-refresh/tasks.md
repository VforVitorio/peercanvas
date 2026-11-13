# Tasks

## 1. Contracts and traceability

- [x] 1.1 Record the approved workspace contract and WP-13 sequencing exception, reconcile desktop-preferences defaults and issue links, and pass strict OpenSpec validation.

## 2. Production workspace

- [x] 2.1 Compose the compact header and File menu around existing document actions; verify editable title, real status, undo/redo, shortcuts, and cancellation with regression tests.
- [x] 2.2 Separate Shapes/Structure navigation, contextual inspector, and canvas chrome; verify catalog insertion, page/layer commands, selection, geometry, text, connector editing, and history through tests.
- [x] 2.3 Implement the responsive panel/drawer breakpoints and accessible help/preferences overlays; verify keyboard operation, focus restoration, busy guards, independent scrolling, and wide/narrow rendered states.

## 3. Preference and lifecycle integration

- [x] 3.1 Integrate the desktop-preferences native snapshots and translated messages; verify session fallback after failed writes and document bytes/revision/dirty/history invariance across appearance/language changes.
- [x] 3.2 Preserve and test save/open/reopen, recovery, invalid input, and draw.io import/export loss-review flows; report browser and native results separately.

## 4. Integrated review

- [x] 4.1 Review rendered wide/narrow states in both themes and languages, complete code review and proportional frontend/Rust/OpenSpec checks, and update evidence and handoff with remaining platform limitations.

## Workflow follow-up

- The maintainer separately authorized focused commits and a push of `feature/wp13-editor-preferences` after implementation. PR creation, merges, releases, and issue mutations remain outside that authorization.
- Native verification on Windows, macOS, and Linux remains tracked by desktop-preferences/4.1 and #101 until each platform has evidence.
- Archive only after the full contract and review gates are satisfied.
