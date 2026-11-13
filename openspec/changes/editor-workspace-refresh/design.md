# Design

## Context

See [proposal.md](proposal.md). S3 already uses a canonical document and history in the production app, a disposable Weave projection, a Rust local-file boundary, and explicit interchange reviews. The isolated UI demonstration is a visual reference only. ADR-0003, ADR-0006, and ADR-0007 remain authoritative for data and recovery.

## Goals / Non-Goals

**Goals:** Preserve verified commands and guards while making the canvas the primary workspace; expose actual state; provide complete local English/Spanish presentation and persistent user preferences.

**Non-Goals:** New document operations, renderer tools, network services, alternate stores, schema changes, or copying demonstration components. Publication and GitHub mutations are not authorized.

## Decisions

### Separate composition from document ownership

Extract header, navigation, canvas chrome, and inspector components with typed callbacks. Keep the canonical model, immediate command acceptance, history, selection reconciliation, and file lifecycle authoritative. Keep Apply buttons for form drafts. A second document store or uncontrolled renderer mutation is rejected.

### Prioritize canvas space with responsive panels

Use a compact header with the existing symbol, editable title, actual document status, File menu, Save, Undo/Redo, Preferences, and Help. Shapes includes catalog search and expandable attribution; Structure includes pages, layers, elements, and connections. Place page/layer context above the canvas and zoom/fit below. Use 240/280 px panels at 1280 px and above, 220/260 px at 1024–1279 px, a left drawer at 760–1023 px, and two drawers below 760 px. Panels scroll independently. Permanent narrow columns and decorative future tools are rejected.

### Contextual inspector and accessible overlays

A node exposes existing text, geometry, movement, appearance, and delete controls. A connection exposes existing endpoints and label. An empty selection offers connector creation and help. Menus, dialogs, and drawers support keyboard navigation, Escape where safe, visible focus, and focus restoration. Busy operations and unsaved/recovery/loss reviews retain their current protection boundaries.

### Independent preferences and localized messages

Consume `desktop-preferences` typed native snapshots and partial updates. Resolve system appearance initially, then apply loaded preferences without initial animation or browser persistence. Follow system changes while System is selected. Resolve saved language, then supported system language, then English. Translate stable message codes and named parameters at presentation time so pending errors and reviews can change language. Preserve user-authored text and document colors. Retain white canvas paper in both themes.

### Ownership and provenance

Keep native preferences and message contracts separate from production composition, styles, resources, and dialogs. Assign bounded ownership and review the integrated data boundaries and rendered result. The maintainer approved the final corrections and verification. Temporary adapted development profiles retain the VoltAgents MIT notice and pinned source revision; no demo code or services enter the production app.

### Preserve declared behavior found during rendered verification

Rendered review exposed a pre-existing Weave arrow adapter defect: the pinned SDK's arrow default inherits an unknown node type. Set explicit renderer arrow discriminants in the disposable projection adapter, with a real-package regression and browser confirmation. The canonical connection and file format remain unchanged. New-document initialization also accepts optional validated page/layer names so the current language supplies initial defaults without translating existing content.

## Risks / Trade-offs

- Refactoring could weaken locks or shortcuts → retain regression tests and test cancel, busy, recovery, and loss-confirmation states.
- Small windows or translated labels could hide controls → inspect wide/narrow layouts in both languages and themes.
- Native and browser behavior differ → report browser, automated, build, and native evidence separately.
- Cross-platform UI acceptance cannot be inferred from local checks → leave unverified platform work open under #101.

## Migration Plan

The document format is unchanged. Preferences upgrade under `desktop-preferences`, preserving last-document data and the old preference backup. Rollback restores that preference backup before using an older strict reader. The maintainer separately authorized focused commits and a feature-branch push after verification; merges, releases, and issue-status changes remain outside that authorization.
