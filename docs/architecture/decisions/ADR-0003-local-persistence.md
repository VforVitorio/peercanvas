# ADR-0003: Store local diagrams as versioned `.peercanvas` files

- **Status:** Accepted for the initial local editor.
- **Date:** 2026-11-11.

## Context

At the initial WP-03 baseline, the canonical TypeScript model validated and deterministically serialized schema v1. S3 adds schema-v2 catalog references and bounded draw.io compatibility data under [ADR-0007](ADR-0007-document-schema-v2-compatibility.md). The persisted snapshot remains UTF-8 JSON capped at 10 MiB. The product requires user-controlled create, open, save, rename, close, and reopen workflows without a network connection. Preferences, file paths, history, selection, and renderer state must stay outside the document snapshot.

The storage decision must preserve one semantic source of truth, leave a known-good version after an interrupted save, and support the existing `.peercanvas` file contract. The app currently has one local editor window and no collaborative editing.

## Options considered

1. **SQLite through Tauri's SQL plugin.** SQLite transactions provide atomic commits and the benchmark below shows fast small-document writes. A database file would still need an import/export format for user-managed `.peercanvas` documents and would add a second representation or a database-specific file format.
2. **Browser IndexedDB.** IndexedDB defines atomic transactions and a strict durability hint. It stores data inside the WebView profile, so a separate file import/export path would still be needed and browser storage would become a second location users must understand.
3. **Versioned `.peercanvas` JSON through a Rust persistence adapter.** This reuses the canonical serializer/parser, keeps documents portable and user-managed, and avoids a data projection. A safe replacement and recovery protocol is required because filesystem rename and durability behavior varies by platform.
4. **Persisted Yjs updates.** Rejected as the local source of truth. Yjs is a proposed synchronization adapter; persisting its state alongside the canonical model would create competing document authorities before collaboration is implemented.

## Storage evaluation

A local raw-I/O comparison used synthetic schema-v1-shaped documents (500 nodes + 500 connections; 5,000 + 5,000; and 10,000 + 10,000), a temporary sibling file with file and parent-directory `fsync`, and SQLite with `journal_mode=DELETE` and `synchronous=FULL`. It ran 20 save/read trials per fixture using Python 3.14.7 and the platform standard libraries on macOS 27.2.1, Mac17,3, 10 cores. Values are median/p95 milliseconds; these measure storage I/O only, not model parsing, serialization, dialogs, or a Tauri UI run.

| Fixture         |   JSON size |     JSON save |   SQLite save |     JSON read |   SQLite read |
| --------------- | ----------: | ------------: | ------------: | ------------: | ------------: |
| 1,000 elements  |   401,521 B | 0.749 / 0.880 | 0.047 / 0.050 | 0.268 / 0.320 | 0.070 / 0.085 |
| 10,000 elements | 4,014,521 B | 1.131 / 2.444 | 1.023 / 1.114 | 0.274 / 0.302 | 0.711 / 0.749 |
| 20,000 elements | 9,569,521 B | 2.005 / 2.304 | 2.082 / 2.354 | 0.579 / 0.745 | 1.647 / 1.718 |

The file and SQLite paths both fit the proposed 2-second 1,000-element I/O target on this Mac. This is a single-machine storage comparison, not evidence of app-level or cross-platform performance. CI and native smoke evidence remains required for the actual persistence adapter.

## Decision

Use a user-selected `.peercanvas` UTF-8 JSON file as the only durable diagram document. Use the existing `serializeDocument` and `parseDocument` entry points; do not add a database schema or persisted renderer/Yjs model. Keep native path selection and filesystem operations in Tauri Rust commands. The Rust backend uses Tauri's dialog plugin to obtain paths, then `std::fs`; it does not expose a generic filesystem API to the renderer.

The Rust store enforces the 10 MiB byte limit before reading or writing. Save stages and syncs a temporary sibling file, preserves the previous complete file as a `.bak` recovery candidate, then publishes the new file. On any failure, the backend retains a valid source or backup and returns a safe diagnostic. Recovery validates candidate JSON through the canonical TypeScript parser; choosing a backup opens it as an unsaved document and requires Save As, leaving the damaged source untouched.

The app stores only the last document path in a separate application preferences file. A document title change uses the canonical metadata command; Save As chooses a new filename and leaves the previous file intact. Preferences, file paths, revision counters, history, selection, and viewport are never serialized into `.peercanvas` content.

The app has no autosave and does not open a document automatically on launch; the user can choose Reopen last. Unsaved changes require Save, Discard, or Cancel before replacing a document or closing the window. Cmd+Q and the custom native Quit menu item follow the same decision, then call the native app-exit command. A macOS Dock-context-menu Quit or OS-level termination may bypass this renderer-controlled path; this is a release risk until native interaction proves otherwise or the limitation is explicitly accepted. After a crash, Reopen last loads the last complete save and a corrupt primary can offer the `.bak` recovery candidate. Supported v0 and v1 documents migrate in memory to schema v2 and become dirty; the original is not rewritten until the user saves.

## Consequences

- Documents remain portable, inspectable JSON and preserve the model's stable identifiers, ordering, and declared schema version.
- JSON file I/O is simpler for the initial single-user editor than a hidden database plus a separate import/export path.
- One `.bak` file may remain next to each saved document. It is the prior complete version and can contain user content.
- The editor detects an external change before overwriting an open file and refuses the save. It does not merge concurrent edits from two processes; collaboration remains a future adapter.
- A crash can lose unsaved edits, but not the last successful save. The UI must keep that distinction visible.

## Validation

WP-03 tests normal save/reopen, save cancellation, schema-v0 migration, unsupported versions, corrupt primary plus valid backup, invalid backup, interrupted publication, permission/disk errors, concurrent external modification, and limits. Run the native storage tests on Windows, macOS, and Linux; verify the full create/edit/connect/save/close/reopen flow in the macOS Tauri WebView and record its version. Do not infer native interaction from compilation alone.

## References

- [Shared document contract](../shared-document-contract.md)
- [Tauri file system and Rust filesystem guidance](https://v2.tauri.app/plugin/file-system/)
- [Tauri native dialog plugin](https://v2.tauri.app/plugin/dialog/)
- [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html)
- [Indexed Database transaction and durability model](https://www.w3.org/TR/IndexedDB/)
- [Rust `std::fs::rename` platform behavior](https://doc.rust-lang.org/stable/std/fs/fn.rename.html)
