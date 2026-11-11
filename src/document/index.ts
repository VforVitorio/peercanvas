export type Id = string;
export type Timestamp = string;
export type Color = string;
export type DiagnosticCode =
  | "INVALID_JSON"
  | "INVALID_SCHEMA"
  | "UNSUPPORTED_VERSION"
  | "LIMIT_EXCEEDED"
  | "DUPLICATE_ID"
  | "MISSING_REFERENCE"
  | "INVALID_GEOMETRY"
  | "LAST_PAGE"
  | "LAST_LAYER"
  | "STYLE_IN_USE"
  | "INVALID_COMMAND"
  | "REVISION_CONFLICT";
export type ErrorCode = DiagnosticCode;
export interface Diagnostic {
  readonly code: ErrorCode;
  readonly path: string;
  readonly message: string;
}
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };
export interface Geometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}
export interface Node {
  readonly nodeId: Id;
  readonly type: "rectangle" | "text";
  readonly geometry: Geometry;
  readonly text: string;
  readonly styleId: Id | null;
}
export interface Connection {
  readonly connectionId: Id;
  readonly sourceNodeId: Id;
  readonly targetNodeId: Id;
  readonly routing: "straight";
  readonly label: string;
  readonly styleId: Id | null;
}
export interface Style {
  readonly styleId: Id;
  readonly fill: Color | null;
  readonly stroke: Color | null;
  readonly strokeWidth: number;
  readonly textColor: Color;
  readonly fontSize: number;
}
export interface Layer {
  readonly layerId: Id;
  readonly name: string;
  readonly nodes: readonly Node[];
  readonly connections: readonly Connection[];
}
export interface Page {
  readonly pageId: Id;
  readonly name: string;
  readonly layers: readonly Layer[];
}
export interface Document {
  readonly schemaVersion: 1;
  readonly documentId: Id;
  readonly metadata: {
    readonly title: string;
    readonly description: string;
    readonly createdAt: Timestamp;
    readonly updatedAt: Timestamp;
  };
  readonly pages: readonly Page[];
  readonly styles: readonly Style[];
  readonly libraryReferences: readonly [];
  readonly sourceCompatibility: null;
}
export interface ModelState {
  readonly document: Document;
  readonly revision: number;
}
export interface CreateDocumentInput {
  readonly documentId: Id;
  readonly pageId: Id;
  readonly layerId: Id;
  readonly title: string;
  readonly now: Timestamp;
}
export interface CommandOutcome {
  readonly state: ModelState;
  readonly changed: boolean;
  readonly affectedIds: readonly Id[];
}

export type ParsedDocument = {
  readonly document: Document;
  readonly sourceVersion: 0 | 1;
  readonly migrated: boolean;
};

// Public command types are deliberately readonly; the runtime entry point still
// accepts unknown data and validates it before applying any mutation.
export type CommandContext = Readonly<{ expectedRevision: number; now: Timestamp }>;
export type NonBatchCommand =
  | Readonly<{ type: "document.setMetadata"; title: string; description: string }>
  | Readonly<{ type: "page.add"; page: Page; index: number }>
  | Readonly<{ type: "page.remove"; pageId: Id }>
  | Readonly<{ type: "page.rename"; pageId: Id; name: string }>
  | Readonly<{ type: "page.reorder"; pageIds: readonly Id[] }>
  | Readonly<{ type: "layer.add"; pageId: Id; layer: Layer; index: number }>
  | Readonly<{ type: "layer.remove"; pageId: Id; layerId: Id }>
  | Readonly<{ type: "layer.rename"; pageId: Id; layerId: Id; name: string }>
  | Readonly<{ type: "layer.reorder"; pageId: Id; layerIds: readonly Id[] }>
  | Readonly<{ type: "node.add"; pageId: Id; layerId: Id; node: Node; index: number }>
  | Readonly<{ type: "node.update"; pageId: Id; layerId: Id; node: Node }>
  | Readonly<{ type: "node.remove"; pageId: Id; layerId: Id; nodeId: Id }>
  | Readonly<{
      type: "connection.add";
      pageId: Id;
      layerId: Id;
      connection: Connection;
      index: number;
    }>
  | Readonly<{ type: "connection.update"; pageId: Id; layerId: Id; connection: Connection }>
  | Readonly<{ type: "connection.remove"; pageId: Id; layerId: Id; connectionId: Id }>
  | Readonly<{ type: "style.put"; style: Style }>
  | Readonly<{ type: "style.remove"; styleId: Id }>;
export type DocumentCommand =
  NonBatchCommand | Readonly<{ type: "batch"; commands: readonly NonBatchCommand[] }>;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COLOR = /^#[0-9a-f]{6}$/;
type Obj = Record<string, unknown>;
type Mutable<T> = T extends readonly []
  ? []
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;
const success = <T>(value: T): Result<T> => ({ ok: true, value });
const failure = (code: DiagnosticCode, path: string, message: string): Result<never> => ({
  ok: false,
  errors: [{ code, path, message }],
});
const isObject = (v: unknown): v is Obj =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const own = (o: Obj, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const esc = (s: string): string => s.replace(/~/g, "~0").replace(/\//g, "~1");
const keys = (
  o: Obj,
  expected: string[],
  path: string,
  errors: Diagnostic[],
  code: DiagnosticCode = "INVALID_SCHEMA",
): void => {
  for (const k of Object.keys(o).sort())
    if (!expected.includes(k)) push(errors, code, `${path}/${esc(k)}`, "Unknown field.");
  for (const k of expected)
    if (!own(o, k)) push(errors, code, `${path}/${k}`, "Required field is missing.");
};
const push = (errors: Diagnostic[], code: DiagnosticCode, path: string, message: string): void => {
  if (errors.length < MAX_DIAGNOSTICS) errors.push({ code, path, message });
};
const string = (v: unknown, min: number, max: number): boolean =>
  typeof v === "string" && [...v].length >= min && [...v].length <= max;
const validId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const validTimestamp = (v: unknown): v is string => {
  if (typeof v !== "string" || !TIMESTAMP.test(v)) return false;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) && d.toISOString() === v;
};
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const norm = (v: number): number => (Object.is(v, -0) ? 0 : v);

const FIELD_ORDER = new Map([
  ["schemaVersion", 0],
  ["documentId", 1],
  ["metadata", 2],
  ["title", 0],
  ["description", 1],
  ["createdAt", 2],
  ["updatedAt", 3],
  ["pages", 3],
  ["pageId", 0],
  ["name", 1],
  ["layers", 2],
  ["layerId", 0],
  ["nodes", 2],
  ["connections", 3],
  ["nodeId", 0],
  ["connectionId", 0],
  ["type", 1],
  ["geometry", 2],
  ["x", 0],
  ["y", 1],
  ["width", 2],
  ["height", 3],
  ["rotation", 4],
  ["text", 3],
  ["styleId", 4],
  ["sourceNodeId", 1],
  ["targetNodeId", 2],
  ["routing", 3],
  ["label", 4],
  ["styles", 4],
  ["fill", 1],
  ["stroke", 2],
  ["strokeWidth", 3],
  ["textColor", 4],
  ["fontSize", 5],
  ["libraryReferences", 5],
  ["sourceCompatibility", 6],
]);
function sortDiagnostics(errors: Diagnostic[]): Diagnostic[] {
  const tokens = (path: string): string[] =>
    path
      .split("/")
      .slice(1)
      .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  return errors
    .map((diagnostic, index) => ({ diagnostic, index, parts: tokens(diagnostic.path) }))
    .sort((a, b) => {
      const length = Math.min(a.parts.length, b.parts.length);
      for (let i = 0; i < length; i++) {
        const left = a.parts[i];
        const right = b.parts[i];
        if (left === right) continue;
        const fieldOrder = (parts: string[], index: number): number | undefined => {
          const field = parts[index];
          if (field === "styleId") {
            if (parts[0] === "styles") return 0;
            if (parts.includes("connections")) return 5;
          }
          return /^\d+$/.test(field) ? Number(field) : FIELD_ORDER.get(field);
        };
        const leftIndex = fieldOrder(a.parts, i);
        const rightIndex = fieldOrder(b.parts, i);
        if (leftIndex !== undefined && rightIndex !== undefined && leftIndex !== rightIndex)
          return leftIndex - rightIndex;
        if (leftIndex !== undefined && rightIndex === undefined) return -1;
        if (leftIndex === undefined && rightIndex !== undefined) return 1;
        return left.localeCompare(right);
      }
      return a.parts.length - b.parts.length || a.index - b.index;
    })
    .map((entry) => entry.diagnostic);
}

function validate(value: unknown): Result<Document> {
  const errors: Diagnostic[] = [];
  if (!isObject(value)) return failure("INVALID_SCHEMA", "", "Expected a document object.");
  keys(
    value,
    [
      "schemaVersion",
      "documentId",
      "metadata",
      "pages",
      "styles",
      "libraryReferences",
      "sourceCompatibility",
    ],
    "",
    errors,
  );
  if (value.schemaVersion !== 1 && own(value, "schemaVersion"))
    push(errors, "UNSUPPORTED_VERSION", "/schemaVersion", "Unsupported document version.");
  if (!validId(value.documentId))
    push(errors, "INVALID_SCHEMA", "/documentId", "Expected a lowercase UUID v4.");
  const metadata = value.metadata;
  if (!isObject(metadata)) push(errors, "INVALID_SCHEMA", "/metadata", "Expected metadata object.");
  else {
    keys(metadata, ["title", "description", "createdAt", "updatedAt"], "/metadata", errors);
    if (!string(metadata.title, 1, 256))
      push(errors, "INVALID_SCHEMA", "/metadata/title", "Title must contain 1–256 code points.");
    if (!string(metadata.description, 0, 4096))
      push(errors, "INVALID_SCHEMA", "/metadata/description", "Description exceeds its limit.");
    if (!validTimestamp(metadata.createdAt))
      push(errors, "INVALID_SCHEMA", "/metadata/createdAt", "Expected a valid UTC timestamp.");
    if (!validTimestamp(metadata.updatedAt))
      push(errors, "INVALID_SCHEMA", "/metadata/updatedAt", "Expected a valid UTC timestamp.");
    if (
      validTimestamp(metadata.createdAt) &&
      validTimestamp(metadata.updatedAt) &&
      metadata.updatedAt < metadata.createdAt
    )
      push(errors, "INVALID_SCHEMA", "/metadata/updatedAt", "Update time precedes creation time.");
  }
  if (!Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100)
    push(errors, "LIMIT_EXCEEDED", "/pages", "Document must contain 1–100 pages.");
  if (!Array.isArray(value.styles) || value.styles.length > 10000)
    push(errors, "LIMIT_EXCEEDED", "/styles", "Style limit exceeded.");
  if (!Array.isArray(value.libraryReferences) || value.libraryReferences.length !== 0)
    push(
      errors,
      "INVALID_SCHEMA",
      "/libraryReferences",
      "Library references are reserved in version 1.",
    );
  if (value.sourceCompatibility !== null)
    push(
      errors,
      "INVALID_SCHEMA",
      "/sourceCompatibility",
      "Compatibility data is reserved in version 1.",
    );
  const ids = new Set<string>();
  const addId = (id: unknown, path: string): void => {
    if (!validId(id)) {
      push(errors, "INVALID_SCHEMA", path, "Expected a lowercase UUID v4.");
      return;
    }
    if (ids.has(id)) push(errors, "DUPLICATE_ID", path, "Identifier is already in use.");
    else ids.add(id);
  };
  if (validId(value.documentId)) addId(value.documentId, "/documentId");
  let layerCount = 0;
  let elementCount = 0;
  const nodeLocations = new Map<string, { page: number; layer: number }>();
  if (Array.isArray(value.pages))
    value.pages.forEach((p, pi) => {
      const pp = `/pages/${pi}`;
      if (!isObject(p)) {
        push(errors, "INVALID_SCHEMA", pp, "Expected page object.");
        return;
      }
      keys(p, ["pageId", "name", "layers"], pp, errors);
      addId(p.pageId, `${pp}/pageId`);
      if (!string(p.name, 1, 256))
        push(errors, "INVALID_SCHEMA", `${pp}/name`, "Name must contain 1–256 code points.");
      if (!Array.isArray(p.layers) || p.layers.length < 1)
        push(errors, "LAST_LAYER", `${pp}/layers`, "A page must contain at least one layer.");
      if (Array.isArray(p.layers))
        p.layers.forEach((l, li) => {
          const lp = `${pp}/layers/${li}`;
          layerCount++;
          if (!isObject(l)) {
            push(errors, "INVALID_SCHEMA", lp, "Expected layer object.");
            return;
          }
          keys(l, ["layerId", "name", "nodes", "connections"], lp, errors);
          addId(l.layerId, `${lp}/layerId`);
          if (!string(l.name, 1, 256))
            push(errors, "INVALID_SCHEMA", `${lp}/name`, "Name must contain 1–256 code points.");
          for (const field of ["nodes", "connections"] as const)
            if (!Array.isArray(l[field]))
              push(errors, "INVALID_SCHEMA", `${lp}/${field}`, "Expected an array.");
          if (Array.isArray(l.nodes))
            l.nodes.forEach((n, ni) => {
              const np = `${lp}/nodes/${ni}`;
              elementCount++;
              if (!isObject(n)) {
                push(errors, "INVALID_SCHEMA", np, "Expected node object.");
                return;
              }
              keys(n, ["nodeId", "type", "geometry", "text", "styleId"], np, errors);
              addId(n.nodeId, `${np}/nodeId`);
              if (validId(n.nodeId)) nodeLocations.set(n.nodeId, { page: pi, layer: li });
              if (n.type !== "rectangle" && n.type !== "text")
                push(errors, "INVALID_SCHEMA", `${np}/type`, "Unsupported node type.");
              if (!string(n.text, 0, 100000))
                push(errors, "INVALID_SCHEMA", `${np}/text`, "Text exceeds its limit.");
              if (n.styleId !== null && !validId(n.styleId))
                push(errors, "INVALID_SCHEMA", `${np}/styleId`, "Expected a UUID or null.");
              const g = n.geometry;
              if (!isObject(g))
                push(errors, "INVALID_GEOMETRY", `${np}/geometry`, "Expected geometry object.");
              else {
                keys(
                  g,
                  ["x", "y", "width", "height", "rotation"],
                  `${np}/geometry`,
                  errors,
                  "INVALID_GEOMETRY",
                );
                if (
                  !num(g.x) ||
                  g.x < -1000000 ||
                  g.x > 1000000 ||
                  !num(g.y) ||
                  g.y < -1000000 ||
                  g.y > 1000000 ||
                  !num(g.width) ||
                  g.width <= 0 ||
                  g.width > 1000000 ||
                  !num(g.height) ||
                  g.height <= 0 ||
                  g.height > 1000000 ||
                  !num(g.rotation) ||
                  g.rotation < 0 ||
                  g.rotation >= 360
                )
                  push(
                    errors,
                    "INVALID_GEOMETRY",
                    `${np}/geometry`,
                    "Geometry is outside supported bounds.",
                  );
              }
            });
          if (Array.isArray(l.connections))
            l.connections.forEach((c, ci) => {
              const cp = `${lp}/connections/${ci}`;
              elementCount++;
              if (!isObject(c)) {
                push(errors, "INVALID_SCHEMA", cp, "Expected connection object.");
                return;
              }
              keys(
                c,
                ["connectionId", "sourceNodeId", "targetNodeId", "routing", "label", "styleId"],
                cp,
                errors,
              );
              addId(c.connectionId, `${cp}/connectionId`);
              if (!validId(c.sourceNodeId) || !validId(c.targetNodeId))
                push(errors, "MISSING_REFERENCE", cp, "Connection endpoint is missing.");
              if (c.sourceNodeId === c.targetNodeId)
                push(errors, "INVALID_SCHEMA", cp, "Connection endpoints must differ.");
              if (c.routing !== "straight")
                push(errors, "INVALID_SCHEMA", `${cp}/routing`, "Unsupported routing mode.");
              if (!string(c.label, 0, 100000))
                push(errors, "INVALID_SCHEMA", `${cp}/label`, "Label exceeds its limit.");
              if (c.styleId !== null && !validId(c.styleId))
                push(errors, "INVALID_SCHEMA", `${cp}/styleId`, "Expected a UUID or null.");
            });
        });
    });
  if (layerCount > 1000) push(errors, "LIMIT_EXCEEDED", "/pages", "Layer limit exceeded.");
  if (elementCount > 100000) push(errors, "LIMIT_EXCEEDED", "/pages", "Element limit exceeded.");
  const stylesById = new Set<string>();
  if (Array.isArray(value.styles))
    value.styles.forEach((s, i) => {
      const sp = `/styles/${i}`;
      if (!isObject(s)) {
        push(errors, "INVALID_SCHEMA", sp, "Expected style object.");
        return;
      }
      keys(s, ["styleId", "fill", "stroke", "strokeWidth", "textColor", "fontSize"], sp, errors);
      addId(s.styleId, `${sp}/styleId`);
      if (validId(s.styleId)) stylesById.add(s.styleId);
      for (const f of ["fill", "stroke"] as const)
        if (s[f] !== null && (typeof s[f] !== "string" || !COLOR.test(s[f])))
          push(errors, "INVALID_SCHEMA", `${sp}/${f}`, "Expected a lowercase RGB color or null.");
      if (typeof s.textColor !== "string" || !COLOR.test(s.textColor))
        push(errors, "INVALID_SCHEMA", `${sp}/textColor`, "Expected a lowercase RGB color.");
      if (
        !num(s.strokeWidth) ||
        s.strokeWidth < 0 ||
        s.strokeWidth > 1000 ||
        !num(s.fontSize) ||
        s.fontSize < 1 ||
        s.fontSize > 1000
      )
        push(errors, "INVALID_SCHEMA", sp, "Style dimensions are outside supported bounds.");
    });
  // References checked after all IDs have been collected, independent of declaration order.
  const checkStyle = (id: unknown, path: string): void => {
    if (id !== null && validId(id) && !stylesById.has(id))
      push(errors, "MISSING_REFERENCE", path, "Referenced style does not exist.");
  };
  if (Array.isArray(value.pages))
    value.pages.forEach((p, pi) => {
      if (isObject(p) && Array.isArray(p.layers))
        p.layers.forEach((l, li) => {
          if (!isObject(l)) return;
          if (Array.isArray(l.nodes))
            l.nodes.forEach((n, ni) => {
              if (isObject(n))
                checkStyle(n.styleId, `/pages/${pi}/layers/${li}/nodes/${ni}/styleId`);
            });
          if (Array.isArray(l.connections))
            l.connections.forEach((c, ci) => {
              if (isObject(c)) {
                checkStyle(c.styleId, `/pages/${pi}/layers/${li}/connections/${ci}/styleId`);
                for (const endpoint of ["sourceNodeId", "targetNodeId"] as const) {
                  const loc = validId(c[endpoint]) ? nodeLocations.get(c[endpoint]) : undefined;
                  if (!loc)
                    push(
                      errors,
                      "MISSING_REFERENCE",
                      `/pages/${pi}/layers/${li}/connections/${ci}/${endpoint}`,
                      "Connection endpoint does not exist.",
                    );
                  else if (loc.page !== pi)
                    push(
                      errors,
                      "MISSING_REFERENCE",
                      `/pages/${pi}/layers/${li}/connections/${ci}/${endpoint}`,
                      "Connection endpoint belongs to another page.",
                    );
                }
              }
            });
        });
    });
  if (errors.length) return { ok: false, errors: sortDiagnostics(errors) };
  try {
    return success(detachAndNormalize(value) as unknown as Document);
  } catch {
    return failure("INVALID_SCHEMA", "", "Document could not be copied safely.");
  }
}

function detachAndNormalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(detachAndNormalize) as T;
  if (isObject(value)) {
    const result: Obj = Object.create(null) as Obj;
    for (const key of Object.keys(value))
      Object.defineProperty(result, key, {
        value: detachAndNormalize(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return result as T;
  }
  return typeof value === "number" ? (norm(value) as T) : value;
}

const MAX_INPUT_DEPTH = 128;
const MAX_INPUT_VALUES = 2_000_000;
function snapshotUnknown(value: unknown): unknown {
  let visited = 0;
  const copies = new WeakMap<object, unknown>();
  const active = new WeakSet<object>();
  const copy = (input: unknown, depth: number): unknown => {
    if (++visited > MAX_INPUT_VALUES || depth > MAX_INPUT_DEPTH) throw new Error("limit");
    if (input === null || typeof input !== "object") return input;
    if (active.has(input)) throw new Error("cycle");
    const prior = copies.get(input);
    if (prior !== undefined) return prior;
    active.add(input);
    if (Array.isArray(input)) {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const length = (descriptors as Record<string, PropertyDescriptor>).length?.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_INPUT_VALUES)
        throw new Error("array");
      const ownKeys = Reflect.ownKeys(descriptors);
      if (ownKeys.length !== length + 1) throw new Error("array");
      const output: unknown[] = new Array(length);
      copies.set(input, output);
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
          throw new Error("array");
        output[index] = copy(descriptor.value, depth + 1);
      }
      active.delete(input);
      return output;
    }
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("object");
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const output: Obj = Object.create(null) as Obj;
    copies.set(input, output);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") throw new Error("symbol");
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !("value" in descriptor)) throw new Error("descriptor");
      Object.defineProperty(output, key, {
        value: copy(descriptor.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    active.delete(input);
    return output;
  };
  return copy(value, 0);
}
export function validateDocument(value: unknown): Result<Document> {
  try {
    const checked = validate(snapshotUnknown(value));
    if (!checked.ok) return checked;
    const canonicalSize = new TextEncoder().encode(
      `${JSON.stringify(checked.value, null, 2)}\n`,
    ).length;
    if (canonicalSize > MAX_BYTES)
      return failure("LIMIT_EXCEEDED", "", "Canonical document exceeds the 10 MiB limit.");
    return checked;
  } catch {
    return failure("INVALID_SCHEMA", "", "Document validation failed.");
  }
}

// Strict JSON parser: validates syntax and rejects duplicate object keys before any object is constructed.
function parseJsonStrict(source: string): unknown {
  let i = 0;
  let depth = 0;
  const ws = (): void => {
    while (/[ \t\r\n]/.test(source[i] ?? "") && i < source.length) i++;
  };
  const str = (): string => {
    const start = i++;
    while (i < source.length) {
      const c = source[i++];
      if (c === '"') return JSON.parse(source.slice(start, i)) as string;
      if (c === "\\") {
        if (i >= source.length) throw new Error();
        i++;
      } else if (c.charCodeAt(0) < 0x20) throw new Error();
    }
    throw new Error();
  };
  const value = (): unknown => {
    ws();
    const c = source[i];
    if (c === '"') return str();
    if (c === "{") {
      if (++depth > MAX_INPUT_DEPTH) throw new Error("depth");
      i++;
      ws();
      const out: Obj = Object.create(null) as Obj;
      const seen = new Set<string>();
      if (source[i] === "}") {
        i++;
        depth--;
        return out;
      }
      while (true) {
        ws();
        if (source[i] !== '"') throw new Error();
        const key = str();
        if (seen.has(key)) throw new Error("duplicate");
        seen.add(key);
        ws();
        if (source[i++] !== ":") throw new Error();
        const child = value();
        Object.defineProperty(out, key, {
          value: child,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        ws();
        const sep = source[i++];
        if (sep === "}") {
          depth--;
          return out;
        }
        if (sep !== ",") throw new Error();
      }
    }
    if (c === "[") {
      if (++depth > MAX_INPUT_DEPTH) throw new Error("depth");
      i++;
      ws();
      const out: unknown[] = [];
      if (source[i] === "]") {
        i++;
        depth--;
        return out;
      }
      while (true) {
        out.push(value());
        ws();
        const sep = source[i++];
        if (sep === "]") {
          depth--;
          return out;
        }
        if (sep !== ",") throw new Error();
      }
    }
    const rest = source.slice(i);
    for (const literal of ["true", "false", "null"])
      if (rest.startsWith(literal)) {
        i += literal.length;
        return literal === "true" ? true : literal === "false" ? false : null;
      }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (match) {
      i += match[0].length;
      const n = Number(match[0]);
      // Numeric overflow is valid JSON syntax. Semantic validation classifies
      // non-finite geometry as INVALID_GEOMETRY rather than INVALID_JSON.
      return norm(n);
    }
    throw new Error();
  };
  const parsed = value();
  ws();
  if (i !== source.length) throw new Error();
  return parsed;
}
export function parseDocument(source: string): Result<ParsedDocument> {
  try {
    if (typeof source !== "string") return failure("INVALID_JSON", "", "Expected UTF-8 JSON text.");
    if (new TextEncoder().encode(source).length > MAX_BYTES)
      return failure("LIMIT_EXCEEDED", "", "Document exceeds the 10 MiB limit.");
    const raw = parseJsonStrict(source);
    if (isObject(raw) && raw.schemaVersion === 0) return migrateV0(raw);
    if (isObject(raw) && own(raw, "schemaVersion") && raw.schemaVersion !== 1)
      return failure("UNSUPPORTED_VERSION", "/schemaVersion", "Unsupported document version.");
    const checked = validateDocument(raw);
    if (!checked.ok) return checked;
    const canonical = serializeDocument(checked.value);
    return canonical.ok
      ? success({ document: checked.value, sourceVersion: 1, migrated: false })
      : canonical;
  } catch {
    return failure("INVALID_JSON", "", "Input is not valid JSON or contains duplicate keys.");
  }
}
function migrateV0(raw: Obj): Result<ParsedDocument> {
  const errors: Diagnostic[] = [];
  keys(
    raw,
    [
      "schemaVersion",
      "documentId",
      "metadata",
      "pages",
      "styles",
      "libraryReferences",
      "sourceCompatibility",
    ],
    "",
    errors,
  );
  if (raw.schemaVersion !== 0)
    push(errors, "UNSUPPORTED_VERSION", "/schemaVersion", "Unsupported document version.");
  if (!isObject(raw.metadata))
    push(errors, "INVALID_SCHEMA", "/metadata", "Expected metadata object.");
  else keys(raw.metadata, ["title", "description", "createdAt"], "/metadata", errors);
  if (errors.length) return { ok: false, errors: sortDiagnostics(errors) };

  const metadata = raw.metadata as Obj;
  const migrated = {
    schemaVersion: 1,
    documentId: raw.documentId,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      createdAt: metadata.createdAt,
      updatedAt: metadata.createdAt,
    },
    pages: raw.pages,
    styles: raw.styles,
    libraryReferences: raw.libraryReferences,
    sourceCompatibility: raw.sourceCompatibility,
  };
  const result = validateDocument(migrated);
  if (!result.ok) return result;
  const canonical = serializeDocument(result.value);
  return canonical.ok
    ? success({ document: result.value, sourceVersion: 0, migrated: true })
    : canonical;
}
export function serializeDocument(value: unknown): Result<string> {
  const valid = validateDocument(value);
  if (!valid.ok) return valid;
  try {
    const d = valid.value;
    const text = `${JSON.stringify({ schemaVersion: d.schemaVersion, documentId: d.documentId, metadata: { title: d.metadata.title, description: d.metadata.description, createdAt: d.metadata.createdAt, updatedAt: d.metadata.updatedAt }, pages: d.pages.map((p) => ({ pageId: p.pageId, name: p.name, layers: p.layers.map((l) => ({ layerId: l.layerId, name: l.name, nodes: l.nodes.map((n) => ({ nodeId: n.nodeId, type: n.type, geometry: { x: n.geometry.x, y: n.geometry.y, width: n.geometry.width, height: n.geometry.height, rotation: n.geometry.rotation }, text: n.text, styleId: n.styleId })), connections: l.connections.map((c) => ({ connectionId: c.connectionId, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId, routing: c.routing, label: c.label, styleId: c.styleId })) })) })), styles: d.styles.map((s) => ({ styleId: s.styleId, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, textColor: s.textColor, fontSize: s.fontSize })), libraryReferences: [], sourceCompatibility: null }, null, 2)}\n`;
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return failure("LIMIT_EXCEEDED", "", "Serialized document exceeds the 10 MiB limit.");
    return success(text);
  } catch {
    return failure("INVALID_SCHEMA", "", "Document could not be serialized.");
  }
}
export function createDocument(input: CreateDocumentInput): Result<ModelState> {
  try {
    input = snapshotUnknown(input) as CreateDocumentInput;
    if (!isObject(input)) return failure("INVALID_SCHEMA", "", "Expected creation input.");
    const inputErrors: Diagnostic[] = [];
    keys(input as Obj, ["documentId", "pageId", "layerId", "title", "now"], "", inputErrors);
    if (inputErrors.length) return { ok: false, errors: inputErrors };
    if (
      !validId(input.documentId) ||
      !validId(input.pageId) ||
      !validId(input.layerId) ||
      !string(input.title, 1, 256) ||
      !validTimestamp(input.now)
    )
      return failure("INVALID_SCHEMA", "", "Creation values are invalid.");
    const d: Mutable<Document> = {
      schemaVersion: 1,
      documentId: input.documentId,
      metadata: { title: input.title, description: "", createdAt: input.now, updatedAt: input.now },
      pages: [
        {
          pageId: input.pageId,
          name: "Page 1",
          layers: [{ layerId: input.layerId, name: "Layer 1", nodes: [], connections: [] }],
        },
      ],
      styles: [],
      libraryReferences: [] as [],
      sourceCompatibility: null,
    };
    const result = validateDocument(d);
    return result.ok ? success({ document: result.value, revision: 0 }) : result;
  } catch {
    return failure("INVALID_SCHEMA", "", "Creation values are invalid.");
  }
}

const failCommand = (
  path: string,
  message = "Command payload is invalid.",
  code: DiagnosticCode = "INVALID_COMMAND",
): Result<never> => failure(code, path, message);
const findPage = (d: Mutable<Document>, id: unknown): Mutable<Page> | undefined =>
  d.pages.find((p) => p.pageId === id);
const findLayer = (p: Mutable<Page> | undefined, id: unknown): Mutable<Layer> | undefined =>
  p?.layers.find((l) => l.layerId === id);
const stringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
function applyOne(
  d: Mutable<Document>,
  command: unknown,
  affected: Set<Id>,
  path: string,
): Result<void> {
  if (!isObject(command) || typeof command.type !== "string") return failCommand(path);
  const type = command.type;
  const schemas: Record<string, string[]> = {
    "document.setMetadata": ["type", "title", "description"],
    "page.add": ["type", "page", "index"],
    "page.remove": ["type", "pageId"],
    "page.rename": ["type", "pageId", "name"],
    "page.reorder": ["type", "pageIds"],
    "layer.add": ["type", "pageId", "layer", "index"],
    "layer.remove": ["type", "pageId", "layerId"],
    "layer.rename": ["type", "pageId", "layerId", "name"],
    "layer.reorder": ["type", "pageId", "layerIds"],
    "node.add": ["type", "pageId", "layerId", "node", "index"],
    "node.update": ["type", "pageId", "layerId", "node"],
    "node.remove": ["type", "pageId", "layerId", "nodeId"],
    "connection.add": ["type", "pageId", "layerId", "connection", "index"],
    "connection.update": ["type", "pageId", "layerId", "connection"],
    "connection.remove": ["type", "pageId", "layerId", "connectionId"],
    "style.put": ["type", "style"],
    "style.remove": ["type", "styleId"],
  };
  const expected = schemas[type];
  if (!expected) return failCommand(`${path}/type`, "Unsupported command.");
  const errors: Diagnostic[] = [];
  keys(command, expected, path, errors, "INVALID_COMMAND");
  if (errors.length) return { ok: false, errors };
  const note = (id: unknown): void => {
    if (typeof id === "string") affected.add(id);
  };
  const page = (): Mutable<Page> | undefined => findPage(d, command.pageId);
  const layer = (): Mutable<Layer> | undefined => findLayer(page(), command.layerId);
  const validIndex = (index: unknown, length: number): index is number =>
    Number.isInteger(index) && (index as number) >= 0 && (index as number) <= length;
  switch (type) {
    case "document.setMetadata":
      if (!string(command.title, 1, 256) || !string(command.description, 0, 4096))
        return failCommand(path, "Metadata values are invalid.", "INVALID_SCHEMA");
      d.metadata.title = command.title as string;
      d.metadata.description = command.description as string;
      note(d.documentId);
      return success(undefined);
    case "page.add": {
      if (!validIndex(command.index, d.pages.length))
        return failCommand(`${path}/index`, "Insertion index is invalid.", "INVALID_SCHEMA");
      const candidate = detachAndNormalize(command.page);
      const test = validateDocument({ ...d, pages: [...d.pages, candidate] });
      if (!test.ok)
        return {
          ok: false,
          errors: test.errors.map((e) => ({ ...e, path: `${path}/page${e.path}` })),
        };
      d.pages.splice(command.index, 0, candidate as unknown as Mutable<Page>);
      collectSubtree(candidate as unknown as Page, affected);
      return success(undefined);
    }
    case "page.remove": {
      const i = d.pages.findIndex((p) => p.pageId === command.pageId);
      if (i < 0) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      if (d.pages.length === 1)
        return failCommand(`${path}/pageId`, "The last page cannot be removed.", "LAST_PAGE");
      const removed = d.pages.splice(i, 1)[0];
      collectSubtree(removed, affected);
      purgeDanglingConnections(d, affected);
      return success(undefined);
    }
    case "page.rename": {
      const p = pageById(d, command.pageId);
      if (!p) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      if (!string(command.name, 1, 256))
        return failCommand(`${path}/name`, "Name is invalid.", "INVALID_SCHEMA");
      p.name = command.name as string;
      note(p.pageId);
      return success(undefined);
    }
    case "page.reorder": {
      if (
        !isPermutation(
          command.pageIds,
          d.pages.map((p) => p.pageId),
        )
      )
        return failCommand(
          `${path}/pageIds`,
          "Page order must be an exact permutation.",
          "INVALID_SCHEMA",
        );
      d.pages = (command.pageIds as string[]).map(
        (id) => d.pages.find((p) => p.pageId === id) as Mutable<Page>,
      );
      for (const id of command.pageIds as string[]) note(id);
      return success(undefined);
    }
    case "layer.add": {
      const p = page();
      if (!p) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      if (!validIndex(command.index, p.layers.length))
        return failCommand(`${path}/index`, "Insertion index is invalid.", "INVALID_SCHEMA");
      const candidate = detachAndNormalize(command.layer);
      const probe = detachAndNormalize(d) as Mutable<Document>;
      (probe.pages.find((x) => x.pageId === p.pageId) as Mutable<Page>).layers.push(
        candidate as unknown as Mutable<Layer>,
      );
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/layer${e.path}` })),
        };
      p.layers.splice(command.index, 0, candidate as unknown as Mutable<Layer>);
      collectSubtree(candidate as unknown as Layer, affected);
      return success(undefined);
    }
    case "layer.remove": {
      const p = page();
      if (!p) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      const i = p.layers.findIndex((l) => l.layerId === command.layerId);
      if (i < 0)
        return failCommand(`${path}/layerId`, "Layer does not exist.", "MISSING_REFERENCE");
      if (p.layers.length === 1)
        return failCommand(`${path}/layerId`, "The last layer cannot be removed.", "LAST_LAYER");
      collectSubtree(p.layers.splice(i, 1)[0], affected);
      purgeDanglingConnections(d, affected);
      return success(undefined);
    }
    case "layer.rename": {
      const p = page();
      if (!p) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      const l = findLayer(p, command.layerId);
      if (!l) return failCommand(`${path}/layerId`, "Layer does not exist.", "MISSING_REFERENCE");
      if (!string(command.name, 1, 256))
        return failCommand(`${path}/name`, "Name is invalid.", "INVALID_SCHEMA");
      l.name = command.name as string;
      note(l.layerId);
      return success(undefined);
    }
    case "layer.reorder": {
      const p = page();
      if (!p) return failCommand(`${path}/pageId`, "Page does not exist.", "MISSING_REFERENCE");
      if (
        !isPermutation(
          command.layerIds,
          p.layers.map((l) => l.layerId),
        )
      )
        return failCommand(
          `${path}/layerIds`,
          "Layer order must be an exact permutation.",
          "INVALID_SCHEMA",
        );
      p.layers = (command.layerIds as string[]).map(
        (id) => p.layers.find((l) => l.layerId === id) as Mutable<Layer>,
      );
      for (const id of command.layerIds as string[]) note(id);
      return success(undefined);
    }
    case "node.add": {
      const p = page(),
        l = layer();
      if (!p || !l) return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      if (!validIndex(command.index, l.nodes.length))
        return failCommand(`${path}/index`, "Insertion index is invalid.", "INVALID_SCHEMA");
      const probe = detachAndNormalize(d) as Mutable<Document>;
      const pl = findLayer(findPage(probe, p.pageId), l.layerId) as Mutable<Layer>;
      pl.nodes.push(detachAndNormalize(command.node) as unknown as Node);
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/node${e.path}` })),
        };
      const n = detachAndNormalize(command.node) as unknown as Node;
      l.nodes.splice(command.index, 0, n);
      note(n.nodeId);
      return success(undefined);
    }
    case "node.update": {
      const p = page(),
        l = layer();
      if (!p || !l) return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      const n = command.node;
      if (!isObject(n) || !validId(n.nodeId))
        return failCommand(`${path}/node`, "Node payload is invalid.");
      const i = l.nodes.findIndex((x) => x.nodeId === n.nodeId);
      if (i < 0)
        return failCommand(
          `${path}/node/nodeId`,
          "Node does not exist in this layer.",
          "MISSING_REFERENCE",
        );
      const probe = detachAndNormalize(d) as Mutable<Document>;
      const target = findLayer(findPage(probe, p.pageId), l.layerId) as Mutable<Layer>;
      target.nodes[i] = detachAndNormalize(n) as unknown as Node;
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/node${e.path}` })),
        };
      l.nodes[i] = detachAndNormalize(n) as unknown as Node;
      note(n.nodeId as string);
      return success(undefined);
    }
    case "node.remove": {
      const p = page(),
        l = layer();
      if (!p || !l) return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      const i = l.nodes.findIndex((n) => n.nodeId === command.nodeId);
      if (i < 0) return failCommand(`${path}/nodeId`, "Node does not exist.", "MISSING_REFERENCE");
      const [removed] = l.nodes.splice(i, 1);
      note(removed.nodeId);
      purgeDanglingConnections(d, affected);
      return success(undefined);
    }
    case "connection.add": {
      const l = layer();
      if (!page() || !l)
        return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      if (!validIndex(command.index, l.connections.length))
        return failCommand(`${path}/index`, "Insertion index is invalid.", "INVALID_SCHEMA");
      const probe = detachAndNormalize(d) as Mutable<Document>;
      const target = findLayer(findPage(probe, command.pageId), command.layerId) as Mutable<Layer>;
      target.connections.push(detachAndNormalize(command.connection) as unknown as Connection);
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/connection${e.path}` })),
        };
      const c = detachAndNormalize(command.connection) as unknown as Connection;
      l.connections.splice(command.index, 0, c);
      note(c.connectionId);
      return success(undefined);
    }
    case "connection.update": {
      const l = layer();
      if (!page() || !l)
        return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      const c = command.connection;
      if (!isObject(c) || !validId(c.connectionId))
        return failCommand(`${path}/connection`, "Connection payload is invalid.");
      const i = l.connections.findIndex((x) => x.connectionId === c.connectionId);
      if (i < 0)
        return failCommand(
          `${path}/connection/connectionId`,
          "Connection does not exist in this layer.",
          "MISSING_REFERENCE",
        );
      const probe = detachAndNormalize(d) as Mutable<Document>;
      const target = findLayer(findPage(probe, command.pageId), command.layerId) as Mutable<Layer>;
      target.connections[i] = detachAndNormalize(c) as unknown as Connection;
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/connection${e.path}` })),
        };
      l.connections[i] = detachAndNormalize(c) as unknown as Connection;
      note(c.connectionId as string);
      return success(undefined);
    }
    case "connection.remove": {
      const l = layer();
      if (!page() || !l)
        return failCommand(path, "Page or layer does not exist.", "MISSING_REFERENCE");
      const i = l.connections.findIndex((c) => c.connectionId === command.connectionId);
      if (i < 0)
        return failCommand(
          `${path}/connectionId`,
          "Connection does not exist.",
          "MISSING_REFERENCE",
        );
      note(l.connections.splice(i, 1)[0].connectionId);
      return success(undefined);
    }
    case "style.put": {
      const style = command.style;
      if (!isObject(style) || !validId(style.styleId))
        return failCommand(`${path}/style`, "Style payload is invalid.");
      const i = d.styles.findIndex((s) => s.styleId === style.styleId);
      const probe = detachAndNormalize(d) as Mutable<Document>;
      if (i < 0) probe.styles.push(detachAndNormalize(style) as unknown as Style);
      else probe.styles[i] = detachAndNormalize(style) as unknown as Style;
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/style${e.path}` })),
        };
      if (i < 0) d.styles.push(detachAndNormalize(style) as unknown as Style);
      else d.styles[i] = detachAndNormalize(style) as unknown as Style;
      note(style.styleId as string);
      return success(undefined);
    }
    case "style.remove": {
      if (!validId(command.styleId))
        return failCommand(`${path}/styleId`, "Style identifier is invalid.");
      const i = d.styles.findIndex((s) => s.styleId === command.styleId);
      if (i < 0)
        return failCommand(`${path}/styleId`, "Style does not exist.", "MISSING_REFERENCE");
      if (usesStyle(d, command.styleId))
        return failCommand(`${path}/styleId`, "Style is referenced by an entity.", "STYLE_IN_USE");
      d.styles.splice(i, 1);
      note(command.styleId);
      return success(undefined);
    }
    default:
      return failCommand(path);
  }
}
function pageById(d: Mutable<Document>, id: unknown): Mutable<Page> | undefined {
  return d.pages.find((p) => p.pageId === id);
}
function isPermutation(proposed: unknown, existing: string[]): proposed is string[] {
  return (
    stringArray(proposed) &&
    proposed.length === existing.length &&
    new Set(proposed).size === proposed.length &&
    existing.every((id) => proposed.includes(id))
  );
}
function collectSubtree(value: Page | Layer, affected: Set<Id>): void {
  if ("pageId" in value) {
    affected.add(value.pageId);
    for (const layer of value.layers) collectSubtree(layer, affected);
  } else {
    affected.add(value.layerId);
    for (const node of value.nodes) affected.add(node.nodeId);
    for (const connection of value.connections) affected.add(connection.connectionId);
  }
}
function purgeDanglingConnections(d: Mutable<Document>, affected: Set<Id>): void {
  const nodes = new Set<string>();
  for (const p of d.pages) for (const l of p.layers) for (const n of l.nodes) nodes.add(n.nodeId);
  for (const p of d.pages)
    for (const l of p.layers)
      l.connections = l.connections.filter((c) => {
        if (nodes.has(c.sourceNodeId) && nodes.has(c.targetNodeId)) return true;
        affected.add(c.connectionId);
        return false;
      });
}
function usesStyle(d: Document, id: unknown): boolean {
  return d.pages.some((p) =>
    p.layers.some(
      (l) => l.nodes.some((n) => n.styleId === id) || l.connections.some((c) => c.styleId === id),
    ),
  );
}
function semanticKey(value: Document): Result<string> {
  return serializeDocument(value);
}
export function executeCommand(
  state: ModelState,
  command: unknown,
  context: CommandContext,
): Result<CommandOutcome> {
  try {
    const suppliedState = state;
    const snapshot = snapshotUnknown({ state, command, context }) as {
      state: ModelState;
      command: unknown;
      context: CommandContext;
    };
    state = snapshot.state;
    command = snapshot.command;
    context = snapshot.context;
    if (
      !isObject(state) ||
      !Number.isSafeInteger(state.revision) ||
      state.revision < 0 ||
      !isObject(context) ||
      !Number.isSafeInteger(context.expectedRevision) ||
      context.expectedRevision < 0 ||
      !validTimestamp(context.now)
    )
      return failCommand("", "State or command context is invalid.", "INVALID_SCHEMA");
    const shapeErrors: Diagnostic[] = [];
    keys(state, ["document", "revision"], "", shapeErrors);
    keys(context, ["expectedRevision", "now"], "/context", shapeErrors);
    if (shapeErrors.length) return { ok: false, errors: shapeErrors };
    if (context.expectedRevision !== state.revision)
      return failCommand("", "Document revision has changed.", "REVISION_CONFLICT");
    const valid = validateDocument(state.document);
    if (!valid.ok) return valid;
    const original = { document: valid.value, revision: state.revision };
    const candidate = detachAndNormalize(valid.value) as Mutable<Document>;
    const affected = new Set<Id>();
    const apply = (cmd: unknown, path: string): Result<void> => {
      if (isObject(cmd) && cmd.type === "batch") {
        const errs: Diagnostic[] = [];
        keys(cmd, ["type", "commands"], path, errs, "INVALID_COMMAND");
        if (errs.length) return { ok: false, errors: errs };
        if (
          !Array.isArray(cmd.commands) ||
          cmd.commands.length < 1 ||
          cmd.commands.length > 1000 ||
          cmd.commands.some((x) => isObject(x) && x.type === "batch")
        )
          return failCommand(`${path}/commands`, "Batch must contain 1–1,000 non-batch commands.");
        for (let i = 0; i < cmd.commands.length; i++) {
          const r = applyOne(candidate, cmd.commands[i], affected, `${path}/commands/${i}`);
          if (!r.ok) return r;
          const checked = validateDocument(candidate);
          if (!checked.ok)
            return {
              ok: false,
              errors: checked.errors.map((e) => ({ ...e, path: `${path}/commands/${i}${e.path}` })),
            };
        }
        return success(undefined);
      }
      return applyOne(candidate, cmd, affected, path);
    };
    const applied = apply(command, "");
    if (!applied.ok) return applied;
    const checked = validateDocument(candidate);
    if (!checked.ok) return checked;
    const candidateKey = semanticKey(checked.value);
    if (!candidateKey.ok) return candidateKey;
    const originalKey = semanticKey(original.document);
    if (!originalKey.ok) return originalKey;
    if (candidateKey.value === originalKey.value)
      return success({ state: suppliedState, changed: false, affectedIds: [] });
    if (state.revision >= Number.MAX_SAFE_INTEGER)
      return failCommand("", "Revision limit exceeded.", "LIMIT_EXCEEDED");
    if (context.now < original.document.metadata.updatedAt)
      return failCommand(
        "/now",
        "Update time precedes the current document time.",
        "INVALID_SCHEMA",
      );
    (checked.value as Mutable<Document>).metadata.updatedAt = context.now;
    const final = serializeDocument(checked.value);
    if (!final.ok) return final;
    const changedIds = semanticAffectedIds(original.document, checked.value);
    return success({
      state: { document: checked.value, revision: state.revision + 1 },
      changed: true,
      affectedIds: changedIds,
    });
  } catch {
    return failure("INVALID_COMMAND", "", "Command could not be applied safely.");
  }
}

function semanticAffectedIds(before: Document, after: Document): Id[] {
  const entities = (document: Document): Map<Id, string> => {
    const serialized = serializeDocument(document);
    if (!serialized.ok) return new Map();
    // The canonical serializer fixes field order, so caller object insertion
    // order cannot appear as a semantic entity change.
    const normalized = JSON.parse(serialized.value) as Document;
    const result = new Map<Id, string>();
    const put = (id: Id, value: unknown, ancestors: readonly Id[]): void => {
      // Ownership is semantic even when an entity's own fields are unchanged.
      // Store IDs only: array positions must not make a reorder affect children.
      result.set(id, JSON.stringify([ancestors, value]));
    };
    put(normalized.documentId, normalized, []);
    for (const page of normalized.pages) {
      const pagePath = [normalized.documentId, page.pageId];
      put(page.pageId, page, [normalized.documentId]);
      for (const layer of page.layers) {
        const layerPath = [...pagePath, layer.layerId];
        put(layer.layerId, layer, pagePath);
        for (const node of layer.nodes) put(node.nodeId, node, layerPath);
        for (const connection of layer.connections)
          put(connection.connectionId, connection, layerPath);
      }
    }
    for (const style of normalized.styles) put(style.styleId, style, [normalized.documentId]);
    return result;
  };
  const oldEntities = entities(before);
  const newEntities = entities(after);
  return [...new Set([...oldEntities.keys(), ...newEntities.keys()])]
    .filter((id) => oldEntities.get(id) !== newEntities.get(id))
    .sort();
}
