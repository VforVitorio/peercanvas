# ADR-0003: Local persistence remains undecided until a recovery spike

- **Status:** Proposed, no storage engine selected.
- **Date:** 2026-11-07.

## Context

PeerCanvas is local-first and needs documents, versions, assets, preferences, and recovery. Candidate stores include SQLite, Tauri storage APIs, browser IndexedDB, and persisted Yjs updates. Choosing without platform and failure testing could create multiple sources of truth.

## Options

1. SQLite via a Tauri plugin.
2. Browser IndexedDB.
3. Tauri filesystem APIs with a versioned file format.
4. A hybrid that stores document state in more than one authority.

## Decision

Do not choose the engine yet. WP-03 will compare viable options and select one durable source of truth plus rebuildable indexes/caches. A hybrid is allowed only when ownership, transaction boundaries, and recovery are explicit.

## Rationale and consequences

This avoids treating an attractive storage API as proof of atomicity or recovery behavior. No persistence code should be added until the format, migrations, and recovery tests are designed.

## Risks and validation

Use representative document sizes on all target OSes. Test normal close, interrupted write, disk full, corrupt snapshot, schema migration, backup restore, and concurrent session writes. Record performance as evidence with machine/runtime details.
