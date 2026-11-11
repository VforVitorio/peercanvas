# In-memory demo adapter

`createDemoService()` owns the single active shared `src/document` model state. React subscribes through `subscribe` and `getSnapshot`; snapshots are recursively frozen. Document changes use the canonical executor, including assistant/import/MCP approval and inverse-command undo/redo. Selection, viewport, participants, conversation, operation status, and simulated save metadata are transient.

The four bundle-owned fixtures use deterministic IDs and timestamps. `reset()` returns to the home state; `reset(fixture)` activates that fixture. Reset cancels timers and invalidates pending completion. Scenario `success` completes after a short timer; `wait` requires `finishWaiting()` or cancellation; `cancel` and `error` preserve the document. The scenario is captured when an operation starts.

Save records the captured revision only, so edits made during a simulated save remain dirty. New/open/recovery/close require a save/discard decision when dirty. A failed/cancelled save or a replacement racing with accepted edits preserves the active document. `resolveDecision` supports service consumers; the demo presentation can also retry the original action with an explicit decision.

`moveNode({ documentId, pageId, layerId, nodeId, x, y, expectedRevision })` returns a boolean. It checks the active document/page/layer, node ownership, editor role, matching safe revision and finite bounded coordinates, then uses the existing `node.update` command. One accepted movement creates one revision and undo entry; zero displacement succeeds without replacing state or clearing redo. The UI owns only a transient preview and cancels interrupted gestures.

Viewer changes are rejected inside the adapter before canonical execution. Proposals are bound to the originating document/revision, require explicit approval, and can apply once. Rejection, cancellation, stale approval, and reset do not apply pending commands. Undo/redo records forward and inverse command batches; it does not overwrite semantic snapshots. Commands without a complete inverse clear available history instead of exposing a partial undo.

No file, clipboard, browser storage, network, provider, credential, native persistence, or MCP transport API is used. Invitations and all I/O outcomes are fictional. `dispose()` cancels pending work and listeners for consumers that end the service lifetime. This adapter is not a production document/file/session service.
