# Proposal

## Why

The normal application is an engineering scaffold. A separately invoked, resettable UI demonstration will let the maintainer review complete interaction flows without implying that storage, interchange, collaboration, AI, or MCP services exist.

## What Changes

- Add a separate React/TypeScript/Vite/Tailwind demo entry with `npm run ui:mock`, retaining the normal shell and native probe.
- Demonstrate home/recent/search/create/open/rename/close/recovery, the Weave workspace, tools/shapes/pages/layers/inspector/selection/zoom/history, and simulated import/export.
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

Own `src/ui-mock/**`, the user-authorized shared pure `src/document/**`, and an isolated Vite configuration; coordinate `package.json` and documentation sequentially. S1 retains persistence and Rust ownership. Use existing pinned packages and reviewed assets. Publication remains unauthorized.

On 2026-11-10 the user explicitly authorized implementing the shared pure core in this branch after the dependency was explained. The frozen pure contract and exports are recorded in `docs/architecture/shared-document-contract.md`; no native persistence is authorized. S1 was notified through a queued message; owner acknowledgement remains pending. This is one canonical core for both consumers, not a substitute demo schema.
