import type {
  Color,
  CommandContext,
  CommandOutcome,
  Connection,
  CreateDocumentInput,
  Diagnostic,
  Document,
  DocumentCommand,
  ErrorCode,
  Geometry,
  Id,
  Layer,
  ModelState,
  Node,
  NonBatchCommand,
  Page,
  ParsedDocument,
  Result,
  Style,
  Timestamp,
} from "../../src/document";
import { executeCommand } from "../../src/document";

declare const id: Id;
declare const timestamp: Timestamp;
declare const color: Color;
declare const geometry: Geometry;
declare const page: Page;
declare const layer: Layer;
declare const node: Node;
declare const connection: Connection;
declare const style: Style;
declare const document: Document;
declare const state: ModelState;
declare const context: CommandContext;
declare const outcome: CommandOutcome;
declare const parsed: ParsedDocument;
declare const input: CreateDocumentInput;
declare const command: DocumentCommand;
declare const nonBatch: NonBatchCommand;
declare const diagnostic: Diagnostic;
declare const result: Result<ModelState>;
declare const errorCode: ErrorCode;

void [
  id,
  timestamp,
  color,
  geometry,
  page,
  layer,
  node,
  connection,
  style,
  document,
  state,
  context,
  outcome,
  parsed,
  input,
  command,
  nonBatch,
  diagnostic,
  result,
  errorCode,
];

// Public snapshots and outcomes must be immutable at every nested level.
// @ts-expect-error readonly state revision
state.revision = 2;
// @ts-expect-error readonly nested metadata
state.document.metadata.title = "changed";
// @ts-expect-error readonly page collection
state.document.pages.push(page);
// @ts-expect-error readonly layers
page.layers.push(layer);
// @ts-expect-error readonly nodes
layer.nodes.push(node);
// @ts-expect-error readonly geometry fields
node.geometry.x = 4;
// @ts-expect-error readonly connection fields
connection.label = "changed";
// @ts-expect-error readonly style collection
document.styles.push(style);
// @ts-expect-error readonly result outcome
outcome.changed = false;
// @ts-expect-error readonly affected IDs
outcome.affectedIds.push(id);
// @ts-expect-error readonly create input
input.title = "changed";
// @ts-expect-error readonly context
context.now = timestamp;
// @ts-expect-error readonly diagnostic
diagnostic.path = "/changed";
// @ts-expect-error readonly result envelope
result.ok = false;
// @ts-expect-error readonly parsed envelope
parsed.migrated = true;
// @ts-expect-error readonly command payload node
if (command.type === "node.add") command.node.text = "changed";
// @ts-expect-error readonly reorder payload
if (command.type === "page.reorder") command.pageIds.push(id);
// @ts-expect-error readonly batch payload
if (command.type === "batch") command.commands.push(nonBatch);
// @ts-expect-error exact command union rejects unknown discriminator
const unknownCommand: DocumentCommand = { type: "unknown.command" };
void unknownCommand;
// @ts-expect-error exact non-batch union excludes batch
const batchAsLeaf: NonBatchCommand = { type: "batch", commands: [nonBatch] };
void batchAsLeaf;

// Exact command payloads are authorable without assertions.
const accepted: DocumentCommand = { type: "document.setMetadata", title: "Title", description: "" };
const acceptedNode: NonBatchCommand = {
  type: "node.add",
  pageId: id,
  layerId: id,
  index: 0,
  node: { nodeId: id, type: "text", geometry, text: "", styleId: null },
};
const commands = [
  accepted,
  { type: "page.add", page, index: 0 },
  { type: "page.remove", pageId: id },
  { type: "page.rename", pageId: id, name: "Page" },
  { type: "page.reorder", pageIds: [id] },
  { type: "layer.add", pageId: id, layer, index: 0 },
  { type: "layer.remove", pageId: id, layerId: id },
  { type: "layer.rename", pageId: id, layerId: id, name: "Layer" },
  { type: "layer.reorder", pageId: id, layerIds: [id] },
  acceptedNode,
  { type: "node.update", pageId: id, layerId: id, node },
  { type: "node.remove", pageId: id, layerId: id, nodeId: id },
  { type: "connection.add", pageId: id, layerId: id, connection, index: 0 },
  { type: "connection.update", pageId: id, layerId: id, connection },
  { type: "connection.remove", pageId: id, layerId: id, connectionId: id },
  { type: "style.put", style },
  { type: "style.remove", styleId: id },
  { type: "batch", commands: [acceptedNode] },
] satisfies readonly DocumentCommand[];
const untrusted: unknown = { type: "future.command" };
const stillUnknown: Parameters<typeof executeCommand>[1] = untrusted;
void accepted;
void acceptedNode;
void errorCode;
void commands;
void stillUnknown;
