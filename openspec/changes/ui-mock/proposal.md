# Proposal

## Why

The normal application is an engineering scaffold. A separately invoked, resettable UI demonstration will let the maintainer review complete interaction flows without implying that storage, interchange, collaboration, AI, or MCP services exist.

## What Changes

- Add a separate React/TypeScript/Vite/Tailwind demo entry with `npm run ui:mock`, retaining the normal shell and native probe.
- Demonstrate home/recent/search/create/open/rename/close/recovery, the Weave workspace, validated node dragging, tools/shapes/pages/layers/inspector/selection/zoom/history, and simulated import/export.
- Demonstrate simulated participants/invitations/admission/roles/disconnects and assistant/MCP conversations/cancellation/proposals/approval/rejection.
- Include preferences, light/dark themes, shortcuts, help, attribution, deterministic success/wait/cancel/error scenarios, and reset.
- Implement the explicitly authorized shared pure S1 core at `src/document/**` and consume its snapshots and validated commands in memory; do not implement a competing document model or native persistence.
- Clearly identify every simulated result; every control responds or explains its unavailability. No real file, network, provider, credential, or clipboard integration.

## Capabilities

### New Capabilities

- `ui-demonstration`: isolated, deterministic, interactive UI scenarios across the planned editor and optional services.

### Modified Capabilities

None. This demo does not complete the foundation's production capability requirements or close their child issues.

## Impact

Own `src/ui-mock/**`, the user-authorized shared pure `src/document/**`, and an isolated Vite configuration; coordinate `package.json` and documentation sequentially. S1 retains persistence and Rust ownership. Use existing pinned packages and reviewed assets. The maintainer authorized commit, push and a PR to dev on 2026-11-11; merge/release remains separately authorized.

On 2026-11-10 the user explicitly authorized implementing the shared pure core in this branch after the dependency was explained. The frozen pure contract and exports are recorded in `docs/architecture/shared-document-contract.md`; no native persistence is authorized. S1 acknowledged sole UI core ownership in the prior handoff; the maintainer explicitly accepted the corrected exact core and sole canonical S1 consumption on 2026-11-11. This is one canonical core for both consumers, not a substitute demo schema.

## Phase 1 completion authorization (2026-11-11)

The maintainer explicitly authorized completion of the entire mock UI demo, including dragging, the shared core, and technical/visual/S1 acceptance. This supersedes the historical UI implementation freeze; it does not authorize publication or S1/checkpoint writes. All five remaining tasks belong to phase 1. Missing mandatory acceptance keeps phase 1 open; no mandatory demo work moves to phase 2. See [the completion inventory](../../../docs/development/phase1-completion-20261111.md).

## Accepted phase 1 and delivery

The maintainer accepted the exact shared core and its sole canonical consumption in S1 after all local gates and independent reviews passed. Phase 1 is closed (18/18). The current instruction authorizes staging, commit, push and a PR to dev; no S1/checkpoint writes, merge/release or phase-2 product implementation is authorized.
