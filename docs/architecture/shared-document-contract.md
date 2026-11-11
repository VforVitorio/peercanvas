# Shared pure document contract

Status: the pure TypeScript core was authorized by the maintainer on 2026-11-10. The native `.peercanvas` file policy is now selected separately in [ADR-0003](decisions/ADR-0003-local-persistence.md); this contract alone does not prove WP-02 or WP-03 acceptance.

Source: S1 draft `s1-document-persistence-contract.md` from its separate worktree, captured 2026-11-10, SHA-256 `2645f3392f34d0cf111aa29a659fa87f45ec875b0789ffeec12e0bd36c079eed`. The shared pure core lives at `src/document/index.ts`; the demo imports it. S1 acknowledged UI as the sole active core writer; the previous S1 implementation remains a frozen compatibility reference. The interim checkpoint does not claim completed compatibility reconciliation or S1 production acceptance. No original S1-worktree file is edited.

## Integration exports

Export `Document`, `Page`, `Layer`, `Node`, `Connection`, `Style`, `ModelState`, `Diagnostic`, `Result`, `createDocument({documentId,pageId,layerId,title,now})`, `validateDocument`, `parseDocument`, `serializeDocument`, and `executeCommand` from the index. Creation returns `Result<ModelState>` at revision 0. `validateDocument(unknown)` returns a detached `Result<Document>`. Commands accept unknown runtime payloads and return the result specified below. The demo implements inverse-command undo/redo using this same executor, never direct semantic snapshot replacement. Do not add native or React/Weave dependencies.

## Version 1 semantic snapshot

### Synthetic version 0 migration

The exact test-only, unreleased version 0 schema is version 1 except `schemaVersion: 0` and no `metadata.updatedAt`. The declared 0→1 migration copies `createdAt` to `updatedAt`, preserves all other semantic fields/IDs, validates the whole result, and reports `sourceVersion: 0, migrated: true`. No other older/future version is supported. This paragraph is extracted from the S1 draft's recovery/migration section; version 0 is not a previously shipped product. Migration never writes the source.

The persisted snapshot is UTF-8 JSON in a user-selected `.peercanvas` file. ADR-0003 selects this format as the native local document store. There is one semantic document, independent of React, Weave, Yjs, or database internals.

All fields below are required. Objects reject unknown keys; optional references use explicit `null`. Arrays preserve semantic order. Strings are preserved without trimming, HTML interpretation, or Unicode normalization.

```text
Document {
  schemaVersion: 1,
  documentId: Id,
  metadata: { title: string, description: string, createdAt: Timestamp, updatedAt: Timestamp },
  pages: Page[],
  styles: Style[],
  libraryReferences: [],
  sourceCompatibility: null
}
Page { pageId: Id, name: string, layers: Layer[] }
Layer { layerId: Id, name: string, nodes: Node[], connections: Connection[] }
Node {
  nodeId: Id, type: "rectangle" | "text",
  geometry: { x: number, y: number, width: number, height: number, rotation: number },
  text: string, styleId: Id | null
}
Connection {
  connectionId: Id, sourceNodeId: Id, targetNodeId: Id,
  routing: "straight", label: string, styleId: Id | null
}
Style {
  styleId: Id, fill: Color | null, stroke: Color | null, strokeWidth: number,
  textColor: Color, fontSize: number
}
```

`Id` is a canonical lowercase UUID v4 string. The document ID and all live page, layer, node, connection, and style IDs share one uniqueness scope within a document. Producers generate IDs outside the pure command boundary; live collisions reject without regeneration. Save/reopen, rename, migration, and recovery preserve IDs. Normal application creation requests fresh UUIDs; the pure boundary stores no historical tombstones and may accept an explicitly supplied previously removed ID once it is unused, including removal/re-addition within a batch. It never changes IDs of surviving entities. Different file copies may legitimately share `documentId`; a private session identifier distinguishes them locally.

`Timestamp` is an ISO UTC string in `YYYY-MM-DDTHH:mm:ss.sssZ` form with a valid calendar date. `updatedAt >= createdAt`. A successful content-changing command receives an injected timestamp no earlier than the current `updatedAt`. Reads and serialization never consult a clock or generate IDs. `Color` is lowercase `#rrggbb`; no CSS expressions or external resources are accepted. Default visual values for a null style are white fill, black stroke/text, stroke width 1, font size 16; text nodes have no rendered fill/stroke. These defaults belong to the adapter contract, not extra persisted renderer state.

Library references and imported compatibility payloads are reserved as empty/null in this version. A non-empty or unknown extension is rejected rather than discarded. Later support requires a declared version/migration; it cannot silently widen this schema.

### Invariants and bounds

- A document has 1–100 ordered pages; each has at least one ordered layer. All S1 pages/layers are editable; read-only page/layer settings are not introduced here. Deleting the last page or last layer of a page rejects.
- A node belongs to exactly one layer of one page. Connections belong to one layer and reference two distinct existing nodes on that same page; cross-layer endpoints on that page are allowed. Direction is source to target; parallel connections are allowed. Routing is derived from node geometry, without renderer-generated IDs or paths in the file.
- Deleting a node removes all incident connections, including those owned by other layers on that page, in the same atomic command. Deleting a layer/page removes its subtree and incident connections. No dangling style or node references are allowed. Deleting a referenced style rejects.
- Geometry values are finite numbers. Coordinates lie in `[-1000000, 1000000]`; width/height in `(0, 1000000]`; rotation in `[0, 360)`. `strokeWidth` lies in `[0, 1000]`, `fontSize` in `[1, 1000]`. Normalize numeric negative zero to zero when parsing/serializing.
- Per document: at most 1,000 layers, 100,000 nodes plus connections, and 10,000 styles. Source and serialized output are limited to 10 MiB UTF-8. Names/title are 1–256 Unicode code points; description at most 4,096; node text/connection label at most 100,000. Empty text/description/labels are valid. These are proposed safety ceilings, not measured performance targets.
- Reject duplicate JSON object keys, invalid JSON, invalid UTF-8 at the native read boundary, unknown fields, wrong scalar types, and unsupported types/versions. Validation is bounded to 100 diagnostics; report deterministic document-field/array order. Check byte bounds before parsing. Implementations must not merge input objects into prototypes or treat metadata as executable content.

Application preferences, file paths/handles, saved fingerprints, revision counters, selection, viewport, renderer caches, presence, conversations, transport state, credentials, and invitations are outside the snapshot. An allowlist serializer prevents application state from leaking into files. This is not a promise to detect secrets a user types into free text.

### Pure entry points and structured outcomes

```text
Diagnostic { code: ErrorCode, path: string, message: string }
Result<T> = { ok: true, value: T }
          | { ok: false, errors: Diagnostic[] }
parseDocument(source: string): Result<{
  document: Document, sourceVersion: 0 | 1, migrated: boolean
}>
serializeDocument(document: unknown): Result<string>
ModelState { document: Document, revision: nonnegativeSafeInteger }
executeCommand(state: ModelState, command: unknown, context: {
  expectedRevision: nonnegativeSafeInteger, now: Timestamp
}): Result<{ state: ModelState, changed: boolean, affectedIds: Id[] }>
```

No entry point throws for rejected input or exposes raw input in diagnostics. Paths are JSON pointers; messages are safe summaries. Codes are `INVALID_JSON`, `INVALID_SCHEMA`, `UNSUPPORTED_VERSION`, `LIMIT_EXCEEDED`, `DUPLICATE_ID`, `MISSING_REFERENCE`, `INVALID_GEOMETRY`, `LAST_PAGE`, `LAST_LAYER`, `STYLE_IN_USE`, `INVALID_COMMAND`, and `REVISION_CONFLICT`. Syntax/size/version errors stop before semantic validation; otherwise diagnostics follow field/array order. Duplicate object keys use `INVALID_JSON`; non-finite or out-of-range geometry uses `INVALID_GEOMETRY`; no-op and revision overflow behavior are defined below.

Parsing constructs a detached candidate and validates the whole graph before returning success. Serialization revalidates, writes the field order shown above, uses two-space indentation and one final LF, and retains array order. Serializing a valid round-tripped document yields the same bytes. Semantic equality includes all declared fields and array ordering, with negative zero treated as zero; JSON object input key order is irrelevant. Serialization never mutates its input or embeds session state.

Commands validate their complete exact payload at runtime as well as through TypeScript types. They operate on a candidate and commit only after whole-document validation. Rejection preserves the input state, its nested objects, and revision; it triggers neither persistence nor projection events. A changed command increments revision once and sets `metadata.updatedAt` to `context.now`. Revision overflow rejects as `LIMIT_EXCEEDED`. A semantic no-op returns the original state, `changed: false`, and no affected IDs; it does not update timestamps or revision. Stale `expectedRevision` rejects as `REVISION_CONFLICT`, including for a no-op. Successful affected IDs are unique and lexicographically sorted, including removed IDs.

New documents start at session revision 0 with externally supplied document/page/layer IDs, title, and timestamp; they contain one page named `Page 1`, one layer named `Layer 1`, no elements/styles, empty description, and reserved fields as above. Creation also returns a structured result and validates supplied values. New documents have no saved revision and require a first-save destination.

### Command payloads

Each row is an exact payload with a `type` discriminant plus the listed fields. An add accepts a full validated entity, including its children where applicable. An update replaces the complete entity; it cannot change its ID or ownership. Reorder uses an exact permutation without missing/duplicate IDs. Index values are integers in `[0, currentLength]` before insertion; there is no implicit append on an invalid index.

| Type                                                         | Fields and behavior                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `document.setMetadata`                                       | `title`, `description`; timestamps/IDs are not editable payload fields                                                               |
| `page.add` / `page.remove` / `page.rename`                   | `{ page, index }` / `{ pageId }` / `{ pageId, name }`                                                                                |
| `page.reorder`                                               | `{ pageIds }`, a permutation of all pages                                                                                            |
| `layer.add` / `layer.remove` / `layer.rename`                | `{ pageId, layer, index }` / `{ pageId, layerId }` / `{ pageId, layerId, name }`                                                     |
| `layer.reorder`                                              | `{ pageId, layerIds }`, a permutation of that page's layers                                                                          |
| `node.add` / `node.update` / `node.remove`                   | `{ pageId, layerId, node, index }` / `{ pageId, layerId, node }` / `{ pageId, layerId, nodeId }`                                     |
| `connection.add` / `connection.update` / `connection.remove` | `{ pageId, layerId, connection, index }` / `{ pageId, layerId, connection }` / `{ pageId, layerId, connectionId }`                   |
| `style.put` / `style.remove`                                 | `{ style }`, replace existing same-ID style or append new style / `{ styleId }`, reject if referenced                                |
| `batch`                                                      | `{ commands }`, 1–1,000 non-batch commands, applied in order as one candidate transaction; one failed child rejects the entire batch |

Node/connection array order is the stacking order within its category; layers are back to front, with connections drawn before nodes within a layer. Updates retain array positions. Style array order is preserved; `style.put` does not reorder an existing style. A batch updates timestamps/revision once if its final semantic state changes. Its diagnostics include the child command index. Referential validity is required after each child; no temporarily dangling references are allowed.

The S1 entry point is an internal local service; it does not expose remote/MCP/AI mutation paths. Later adapters must perform authorization/approval and submit validated commands, never make a renderer/Yjs store authoritative. Fixture projection into the pinned Weave package must be disposable and rebuilt from model state; it cannot reuse the S0 probe as evidence of product editing.
