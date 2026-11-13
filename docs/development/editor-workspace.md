# Production editor workspace and preferences

Status: implemented on the open `feature/wp13-editor-preferences` PR, 2026-11-13. Automated and browser checks below pass. The maintainer authorized focused commits and a source-branch push. Fluent human Spanish review and native platform integration remain open acceptance gates; this work is not merged or released.

## Contract and scope

The maintainer approved `editor-workspace-refresh` together with `desktop-preferences`, advancing the selected S8/WP-13 work ahead of S4. The change reorganizes implemented S3 functions and adds independent System/Light/Dark and English/Spanish preferences. The existing canonical document, command validation, history, renderer projection, `.peercanvas` format, native recovery, and draw.io review boundaries remain authoritative.

The workspace uses a compact document header and File menu, Shapes/Structure navigation, contextual properties, a central canvas, and bottom zoom controls. At 1280 px and above the side panels are 240/280 px; at 1024–1279 px they are 220/260 px; the left becomes a drawer at 760–1023 px and both become drawers below 760 px. Panels scroll independently. Help describes existing shortcuts in a dialog.

Collaboration, invitations, AI, MCP, grouping, onboarding, new document tools, dependencies, and artwork are outside this task. The isolated UI demonstration supplies no production code or services.

## Preference and message boundaries

Preferences extend the native application record that already stores `lastDocument`. Reads and partial updates share the document persistence lock. Missing theme follows the system; missing language resolves Spanish/English from the system and otherwise English. Native preference loading does not write the record. There is no persistent browser cache. Failed writes apply the selection for the session and produce a visible warning without making the diagram dirty.

Migration preserves the prior supported record for rollback. Older versions can reject the new fields; restore the retained pre-upgrade backup before opening preferences with an old version. Diagram files need no migration for this change.

Native errors, warnings, and draw.io reports cross the frontend boundary as stable identifiers with named parameters. Presentation translates whole phrases locally; document/user-authored text and technical source identifiers remain intact. Interface locale updates `html.lang` and uses `Intl` for numbers/dates. The canvas paper stays white and explicit diagram styles remain independent of chrome.

## Spanish terminology and review

Use concise, consistent Spanish from Spain where variants differ. Product and file-format names remain unchanged. These terms guide review of complete phrases rather than fragment concatenation:

| English                     | Spanish                           |
| --------------------------- | --------------------------------- |
| File                        | Archivo                           |
| Save / Save As              | Guardar / Guardar como            |
| Open / Reopen last          | Abrir / Reabrir último            |
| Undo / Redo                 | Deshacer / Rehacer                |
| Preferences                 | Preferencias                      |
| System / Light / Dark       | Sistema / Claro / Oscuro          |
| Shapes / Structure          | Formas / Estructura               |
| Page / Layer                | Página / Capa                     |
| Properties                  | Propiedades                       |
| Connector / Source / Target | Conector / Origen / Destino       |
| Apply                       | Aplicar                           |
| Unsaved changes             | Cambios pendientes                |
| Recovery / Backup           | Recuperación / Copia de seguridad |
| Compatibility losses        | Pérdidas de compatibilidad        |
| Fit to content              | Ajustar al contenido              |

Automated key/parameter parity and agent copy review do not replace the fluent human Spanish sign-off required by #100. Keep that acceptance item open until a reviewer records the result.

## Verification record

The final checks ran on macOS 26.7.1 arm64 with Node 24.21.0 and an isolated temporary Rust 1.100.0 toolchain. The toolchain and dependency cache are under `/private/tmp/peercanvas-editor-refresh`; global Rust configuration was not changed.

| Check                                                                                     | Result                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                                                       | Pass                                                                                       |
| `npm run lint`                                                                            | Pass                                                                                       |
| `npm run format:check`                                                                    | Pass                                                                                       |
| `npm test`                                                                                | 333 tests in 29 files pass                                                                 |
| `npm run build`                                                                           | Pass; existing large-chunk warning remains (approximately 1,009 kB JavaScript before gzip) |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                  | Pass                                                                                       |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml`                                | 43 Rust tests pass on macOS                                                                |
| `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Pass                                                                                       |
| `openspec validate --all --strict --no-interactive`                                       | All 5 changes pass                                                                         |
| Final diff review and `git diff --check`                                                  | Pass; no dependency or product-asset changes                                               |

The Cargo commands ran through `rust-check.py` in the temporary evidence directory, with `RUSTUP_HOME` and `CARGO_HOME` pointing there and its `cargo/bin` on the process PATH. Frontend evidence is in `frontend-final.log`; native evidence is in `rust-test.log` and `rust-clippy.log` in that directory.

Chromium 153.0.8010.12 rendered the real production editor at 1440, 1100, 900, and 600 CSS pixels, each at 960 px high, in English/Spanish and Light/Dark: 16 combinations passed without runtime errors or horizontal overflow. The canvas remained usable and white. Five additional browser scenarios passed: File menu keyboard/focus, shortcut-help focus and mutation guards, theme/locale preserving a real node draft/revision/dirty state with undo/redo, and Escape/focus restoration in each drawer. Spanish page/layer rename fields were measured at at least 100 px after correcting their wrapping layout.

Local artifacts are in `/private/tmp/peercanvas-editor-refresh/screenshots/`: `{en,es}-{light,dark}-{1440,1100,900,600}.png`, `help-en-light.png`, `preferences-es-dark.png`, `selected-es-dark.png`, `navigation-es-dark-600.png`, and `inspector-es-dark-600.png`. `browser-results.json` and `interaction-results.json` record the checks. These are temporary local QA artifacts, not shipped application assets.

Rendered review exposed a pre-existing arrow adapter defect: the real pinned Weave SDK inherits `unknown` arrow defaults, while the test mock supplied `arrow`. Explicit adapter discriminants now make the existing connectors visible. A regression uses the actual package default and verifies projected points, style, and unchanged canonical content. The isolated demo's shared-renderer test was adjusted only to assert the safe error code rather than raw exception text; no demo implementation or service was copied or changed.

Preference tests cover old-record migration, preservation of the recent document and source permissions, corrupt-primary/valid-backup recovery, latest recovery retention, serialized partial updates, failed writes, uncertain directory durability, retries that retain failed fields, and newer choices superseding failed older values. Real App tests assert unchanged serialized bytes, revision, dirty state, history, and form drafts across theme/language switches. Native errors/loss reports use a finite translated catalog with key/parameter parity checks; prototype-name and malformed message identifiers use safe fallback phrases.

Adapted temporary development profiles retain the VoltAgents MIT notice, copyright 2025, and pinned source revision `ed74d115b7fb7026a22a4f816a8e3250f425e3b4`; they were not added to this repository. Independent code review found and verified fixes for native recovery, permissions, warning semantics, typed command arguments, Unicode titles, preference retry races, and unsafe resource lookups.

Code Review Graph was rebuilt with this repository's explicit absolute root and final tracked-file impact inspected. This installation indexes only tracked files; new untracked modules were therefore reviewed directly in source. Its incomplete graph is navigation evidence, not proof of an empty impact radius. Focused ast-grep checks covered resource indexing and absence of browser preference persistence.

The isolated native QA configuration used identifier `org.peercanvas.editor-refresh-qa` and the existing Vite server. `npm run tauri -- dev --no-watch --config /private/tmp/peercanvas-editor-refresh/native-qa.conf.json` compiled and launched the native executable. The computer-use controller could not select that unbundled app by name or executable path, so native file-dialog, preference-restart, menu, and WebView interactions were **not verified**. The QA child processes were stopped. No new installer/package claim is made, and the earlier icon-packaging issue remains under #90.

The initial PR #132 CI run passed typecheck, lint, formatting, tests, frontend build, CodeQL, OSV, and Gitleaks, but its native-linux, native-macos, and native-windows checks failed. This branch is being synchronized with the S4 `dev` changes while preserving its frontend; rerun the native checks before merging. A screen-reader audit and fluent human Spanish sign-off were not performed. Keep #100, #101, and parent #93 open until those external acceptance requirements are satisfied. No OpenSpec change was archived.

## Traceability

- Requirements: FR-003..004, FR-010..012, FR-016, FR-018, FR-021..023, FR-050..051, UC-11, NFR-010.
- Contracts: `openspec/changes/editor-workspace-refresh` and `openspec/changes/desktop-preferences`.
- Work package: WP-13/#93; children #96 (contracts), #95 (appearance), #100 (localization), #101 (platform integration).
- Data decisions: ADR-0003, ADR-0006, ADR-0007. Risks: R-14, R-19, R-20 and native evidence risk R-11.
- The maintainer subsequently authorized focused commits and a push of `feature/wp13-editor-preferences`. PR creation, issue mutations, merges, and releases are outside that authorization.
