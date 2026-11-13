export type Id = string;
export type Timestamp = string;
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
export interface Diagnostic {
  code: DiagnosticCode;
  path: string;
  message: string;
}
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Diagnostic[] };
export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export interface CatalogReference {
  shapeId: string;
  version: string;
}
export interface Node {
  nodeId: Id;
  type: "rectangle" | "text";
  geometry: Geometry;
  text: string;
  styleId: Id | null;
  catalogReference: CatalogReference | null;
}
export interface SourceCellIdMapping {
  sourceId: string;
  elementId: Id;
}
export interface PreservedSourcePage {
  pageId: Id;
  sourcePageId: string;
  cellIdMap: SourceCellIdMapping[];
  fragments: string[];
}
export interface SourceCompatibility {
  format: "drawio";
  version: 1;
  pages: PreservedSourcePage[];
}
export interface Connection {
  connectionId: Id;
  sourceNodeId: Id;
  targetNodeId: Id;
  routing: "straight";
  label: string;
  styleId: Id | null;
}
export interface Style {
  styleId: Id;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  textColor: string;
  fontSize: number;
}
export interface Layer {
  layerId: Id;
  name: string;
  nodes: Node[];
  connections: Connection[];
}
export interface Page {
  pageId: Id;
  name: string;
  layers: Layer[];
}
export interface Document {
  schemaVersion: 2;
  documentId: Id;
  metadata: { title: string; description: string; createdAt: Timestamp; updatedAt: Timestamp };
  pages: Page[];
  styles: Style[];
  libraryReferences: [];
  sourceCompatibility: SourceCompatibility | null;
}
export interface ModelState {
  document: Document;
  revision: number;
}
export interface CreateDocumentInput {
  documentId: Id;
  pageId: Id;
  layerId: Id;
  title: string;
  /** Initial names are document content; callers may supply their localized defaults. */
  pageName?: string;
  layerName?: string;
  now: Timestamp;
}
export interface CommandContext {
  expectedRevision: number;
  now: Timestamp;
}
export interface CommandOutcome {
  state: ModelState;
  changed: boolean;
  affectedIds: Id[];
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const MAX_PRESERVED_FRAGMENTS = 1000;
const MAX_PRESERVED_FRAGMENT_BYTES = 64 * 1024;
const MAX_PRESERVED_TOTAL_BYTES = 1024 * 1024;
const MAX_SOURCE_CELL_ID_MAPPINGS = 100000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COLOR = /^#[0-9a-f]{6}$/;
const CATALOG_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hasForbiddenXmlControlCharacters = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
type Obj = Record<string, unknown>;
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
function isDenseDataArray(v: unknown): v is unknown[] {
  try {
    if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) return false;
    if (Reflect.ownKeys(v).some((key) => typeof key === "symbol")) return false;
    const descriptors = Object.getOwnPropertyDescriptors(v);
    const descriptorKeys = Object.keys(descriptors);
    const length = descriptors["length"] as PropertyDescriptor | undefined;
    if (
      !length ||
      !("value" in length) ||
      length.value !== v.length ||
      descriptorKeys.length !== v.length + 1
    )
      return false;
    for (let index = 0; index < v.length; index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return false;
    }
    return descriptorKeys.every((key) => key === "length" || /^(0|[1-9]\d*)$/.test(key));
  } catch {
    return false;
  }
}
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
const hasExactFields = (o: Obj, expected: string[]): boolean => {
  const actual = Object.keys(o);
  return actual.length === expected.length && expected.every((key) => own(o, key));
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
  ["type", 1],
  ["geometry", 2],
  ["x", 0],
  ["y", 1],
  ["width", 2],
  ["height", 3],
  ["rotation", 4],
  ["text", 3],
  ["styleId", 4],
  ["catalogReference", 5],
  ["shapeId", 0],
  ["version", 1],
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
  ["format", 0],
  ["sourcePageId", 1],
  ["cellIdMap", 2],
  ["elementId", 0],
  ["fragments", 3],
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
        const leftIndex = /^\d+$/.test(left) ? Number(left) : FIELD_ORDER.get(left);
        const rightIndex = /^\d+$/.test(right) ? Number(right) : FIELD_ORDER.get(right);
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
  if (value.schemaVersion !== 2 && own(value, "schemaVersion"))
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
  if (!isDenseDataArray(value.pages) || value.pages.length < 1 || value.pages.length > 100)
    push(errors, "LIMIT_EXCEEDED", "/pages", "Document must contain 1–100 pages.");
  if (!isDenseDataArray(value.styles) || value.styles.length > 10000)
    push(errors, "LIMIT_EXCEEDED", "/styles", "Style limit exceeded.");
  if (!isDenseDataArray(value.libraryReferences) || value.libraryReferences.length !== 0)
    push(
      errors,
      "INVALID_SCHEMA",
      "/libraryReferences",
      "Library references are reserved in version 2.",
    );
  const source = value.sourceCompatibility;
  if (
    source !== null &&
    (!isObject(source) ||
      !hasExactFields(source, ["format", "version", "pages"]) ||
      source.format !== "drawio" ||
      source.version !== 1 ||
      !isDenseDataArray(source.pages) ||
      source.pages.length < 1 ||
      source.pages.length > 100)
  )
    push(
      errors,
      "INVALID_SCHEMA",
      "/sourceCompatibility",
      "Invalid or over-limit compatibility data.",
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
  addId(value.documentId, "/documentId");
  const pageIds = new Set<string>();
  let layerCount = 0;
  let elementCount = 0;
  const nodeLocations = new Map<string, { page: number; layer: number }>();
  if (isDenseDataArray(value.pages))
    value.pages.forEach((p, pi) => {
      const pp = `/pages/${pi}`;
      if (!isObject(p)) {
        push(errors, "INVALID_SCHEMA", pp, "Expected page object.");
        return;
      }
      keys(p, ["pageId", "name", "layers"], pp, errors);
      addId(p.pageId, `${pp}/pageId`);
      if (validId(p.pageId)) pageIds.add(p.pageId);
      if (!string(p.name, 1, 256))
        push(errors, "INVALID_SCHEMA", `${pp}/name`, "Name must contain 1–256 code points.");
      if (!isDenseDataArray(p.layers) || p.layers.length < 1)
        push(errors, "LAST_LAYER", `${pp}/layers`, "A page must contain at least one layer.");
      if (isDenseDataArray(p.layers))
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
            if (!isDenseDataArray(l[field]))
              push(errors, "INVALID_SCHEMA", `${lp}/${field}`, "Expected an array.");
          if (isDenseDataArray(l.nodes))
            l.nodes.forEach((n, ni) => {
              const np = `${lp}/nodes/${ni}`;
              elementCount++;
              if (!isObject(n)) {
                push(errors, "INVALID_SCHEMA", np, "Expected node object.");
                return;
              }
              keys(
                n,
                ["nodeId", "type", "geometry", "text", "styleId", "catalogReference"],
                np,
                errors,
              );
              addId(n.nodeId, `${np}/nodeId`);
              if (validId(n.nodeId)) nodeLocations.set(n.nodeId, { page: pi, layer: li });
              if (n.type !== "rectangle" && n.type !== "text")
                push(errors, "INVALID_SCHEMA", `${np}/type`, "Unsupported node type.");
              if (!string(n.text, 0, 100000))
                push(errors, "INVALID_SCHEMA", `${np}/text`, "Text exceeds its limit.");
              if (n.styleId !== null && !validId(n.styleId))
                push(errors, "INVALID_SCHEMA", `${np}/styleId`, "Expected a UUID or null.");
              if (n.catalogReference !== null) {
                const reference = n.catalogReference;
                if (
                  !isObject(reference) ||
                  !hasExactFields(reference, ["shapeId", "version"]) ||
                  !string(reference.shapeId, 1, 128) ||
                  !CATALOG_ID.test(String(reference.shapeId)) ||
                  !string(reference.version, 1, 64) ||
                  n.type !== "rectangle"
                )
                  push(
                    errors,
                    "INVALID_SCHEMA",
                    `${np}/catalogReference`,
                    "Expected a supported shape identifier and version or null.",
                  );
              }
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
          if (isDenseDataArray(l.connections))
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
  if (isObject(source) && isDenseDataArray(source.pages)) {
    let preservedBytes = 0;
    let preservedCount = 0;
    let mappedCellCount = 0;
    const sourcePageIds = new Set<string>();
    source.pages.forEach((rawPage, pageIndex) => {
      const pagePath = `/sourceCompatibility/pages/${pageIndex}`;
      if (!isObject(rawPage)) {
        push(errors, "INVALID_SCHEMA", pagePath, "Expected a preserved source page.");
        return;
      }
      keys(rawPage, ["pageId", "sourcePageId", "cellIdMap", "fragments"], pagePath, errors);
      if (!validId(rawPage.pageId) || !pageIds.has(rawPage.pageId))
        push(errors, "MISSING_REFERENCE", `${pagePath}/pageId`, "Source page does not exist.");
      if (
        typeof rawPage.sourcePageId !== "string" ||
        !string(rawPage.sourcePageId, 1, 256) ||
        hasForbiddenXmlControlCharacters(rawPage.sourcePageId) ||
        sourcePageIds.has(rawPage.sourcePageId)
      )
        push(
          errors,
          "INVALID_SCHEMA",
          `${pagePath}/sourcePageId`,
          "Source page identifier is invalid or duplicated.",
        );
      else sourcePageIds.add(rawPage.sourcePageId as string);
      if (!isDenseDataArray(rawPage.cellIdMap)) {
        push(errors, "INVALID_SCHEMA", `${pagePath}/cellIdMap`, "Expected a source cell ID map.");
      } else {
        const sourceIds = new Set<string>();
        const elementIds = new Set<string>();
        rawPage.cellIdMap.forEach((rawMapping, mappingIndex) => {
          const mapPath = `${pagePath}/cellIdMap/${mappingIndex}`;
          if (!isObject(rawMapping)) {
            push(errors, "INVALID_SCHEMA", mapPath, "Expected a source cell mapping.");
            return;
          }
          keys(rawMapping, ["sourceId", "elementId"], mapPath, errors);
          if (
            typeof rawMapping.sourceId !== "string" ||
            !string(rawMapping.sourceId, 1, 256) ||
            hasForbiddenXmlControlCharacters(rawMapping.sourceId) ||
            sourceIds.has(rawMapping.sourceId)
          )
            push(
              errors,
              "INVALID_SCHEMA",
              `${mapPath}/sourceId`,
              "Source cell identifier is invalid or duplicated.",
            );
          else sourceIds.add(rawMapping.sourceId as string);
          if (!validId(rawMapping.elementId) || elementIds.has(rawMapping.elementId))
            push(
              errors,
              "INVALID_SCHEMA",
              `${mapPath}/elementId`,
              "Mapped document identifier is invalid or duplicated.",
            );
          else elementIds.add(rawMapping.elementId as string);
          mappedCellCount++;
        });
      }
      if (!isDenseDataArray(rawPage.fragments)) {
        push(
          errors,
          "INVALID_SCHEMA",
          `${pagePath}/fragments`,
          "Expected preserved source fragments.",
        );
      } else {
        rawPage.fragments.forEach((fragment, fragmentIndex) => {
          const path = `${pagePath}/fragments/${fragmentIndex}`;
          if (typeof fragment !== "string") {
            push(errors, "INVALID_SCHEMA", path, "Expected XML text.");
            return;
          }
          preservedCount++;
          const bytes = new TextEncoder().encode(fragment);
          preservedBytes += bytes.length;
          if (
            bytes.length === 0 ||
            bytes.length > MAX_PRESERVED_FRAGMENT_BYTES ||
            hasForbiddenXmlControlCharacters(fragment)
          )
            push(
              errors,
              "LIMIT_EXCEEDED",
              path,
              "Preserved fragment is empty, unsafe, or too large.",
            );
        });
      }
    });
    if (preservedCount > MAX_PRESERVED_FRAGMENTS)
      push(
        errors,
        "LIMIT_EXCEEDED",
        "/sourceCompatibility/pages",
        "Preserved fragment count exceeds 1,000.",
      );
    if (mappedCellCount > MAX_SOURCE_CELL_ID_MAPPINGS)
      push(
        errors,
        "LIMIT_EXCEEDED",
        "/sourceCompatibility/pages",
        "Source cell ID map exceeds 100,000 entries.",
      );
    if (preservedBytes > MAX_PRESERVED_TOTAL_BYTES)
      push(
        errors,
        "LIMIT_EXCEEDED",
        "/sourceCompatibility/pages",
        "Preserved source exceeds the 1 MiB limit.",
      );
  }
  if (layerCount > 1000) push(errors, "LIMIT_EXCEEDED", "/pages", "Layer limit exceeded.");
  if (elementCount > 100000) push(errors, "LIMIT_EXCEEDED", "/pages", "Element limit exceeded.");
  const stylesById = new Set<string>();
  if (isDenseDataArray(value.styles))
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
  if (isDenseDataArray(value.pages))
    value.pages.forEach((p, pi) => {
      if (isObject(p) && isDenseDataArray(p.layers))
        p.layers.forEach((l, li) => {
          if (!isObject(l)) return;
          if (isDenseDataArray(l.nodes))
            l.nodes.forEach((n, ni) => {
              if (isObject(n))
                checkStyle(n.styleId, `/pages/${pi}/layers/${li}/nodes/${ni}/styleId`);
            });
          if (isDenseDataArray(l.connections))
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
  if (Array.isArray(value)) {
    if (!isDenseDataArray(value)) throw new TypeError("Invalid array data.");
    return value.map(detachAndNormalize) as T;
  }
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
export function validateDocument(value: unknown): Result<Document> {
  try {
    return validate(value);
  } catch {
    return failure("INVALID_SCHEMA", "", "Document validation failed.");
  }
}

// Strict JSON parser: validates syntax and rejects duplicate object keys before any object is constructed.
function parseJsonStrict(source: string): unknown {
  let i = 0;
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
      i++;
      ws();
      const out: Obj = Object.create(null) as Obj;
      const seen = new Set<string>();
      if (source[i] === "}") {
        i++;
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
        if (sep === "}") return out;
        if (sep !== ",") throw new Error();
      }
    }
    if (c === "[") {
      i++;
      ws();
      const out: unknown[] = [];
      if (source[i] === "]") {
        i++;
        return out;
      }
      while (true) {
        out.push(value());
        ws();
        const sep = source[i++];
        if (sep === "]") return out;
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
export function parseDocument(
  source: string,
): Result<{ document: Document; sourceVersion: 0 | 1 | 2; migrated: boolean }> {
  try {
    if (typeof source !== "string") return failure("INVALID_JSON", "", "Expected UTF-8 JSON text.");
    if (new TextEncoder().encode(source).length > MAX_BYTES)
      return failure("LIMIT_EXCEEDED", "", "Document exceeds the 10 MiB limit.");
    const raw = parseJsonStrict(source);
    if (isObject(raw) && raw.schemaVersion === 0) return migrateV0(raw);
    if (isObject(raw) && raw.schemaVersion === 1) return migrateV1(raw);
    if (isObject(raw) && own(raw, "schemaVersion") && raw.schemaVersion !== 2)
      return failure("UNSUPPORTED_VERSION", "/schemaVersion", "Unsupported document version.");
    const checked = validateDocument(raw);
    return checked.ok
      ? success({ document: checked.value, sourceVersion: 2, migrated: false })
      : checked;
  } catch {
    return failure("INVALID_JSON", "", "Input is not valid JSON or contains duplicate keys.");
  }
}
function hasLegacyCatalogReference(pages: unknown): boolean {
  return (
    isDenseDataArray(pages) &&
    pages.some(
      (page) =>
        isObject(page) &&
        isDenseDataArray(page.layers) &&
        page.layers.some(
          (layer) =>
            isObject(layer) &&
            isDenseDataArray(layer.nodes) &&
            layer.nodes.some((node) => isObject(node) && own(node, "catalogReference")),
        ),
    )
  );
}
function addNullCatalogReferences(pages: unknown): unknown {
  if (!isDenseDataArray(pages)) return pages;
  return pages.map((page) => {
    if (!isObject(page) || !isDenseDataArray(page.layers)) return page;
    const copyPage = Object.assign(Object.create(null), page) as Obj;
    copyPage.layers = page.layers.map((layer) => {
      if (!isObject(layer) || !isDenseDataArray(layer.nodes)) return layer;
      const copyLayer = Object.assign(Object.create(null), layer) as Obj;
      copyLayer.nodes = layer.nodes.map((node) => {
        if (!isObject(node)) return node;
        const copyNode = Object.assign(Object.create(null), node) as Obj;
        copyNode.catalogReference = null;
        return copyNode;
      });
      return copyLayer;
    });
    return copyPage;
  });
}
function migrateV1(
  raw: Obj,
): Result<{ document: Document; sourceVersion: 0 | 1 | 2; migrated: boolean }> {
  if (hasLegacyCatalogReference(raw.pages))
    return failure("INVALID_SCHEMA", "/pages", "Schema v1 cannot contain catalog references.");
  if (raw.sourceCompatibility !== null)
    return failure(
      "INVALID_SCHEMA",
      "/sourceCompatibility",
      "Schema v1 cannot contain compatibility data.",
    );
  const migrated = Object.assign(Object.create(null), raw, {
    schemaVersion: 2,
    pages: addNullCatalogReferences(raw.pages),
  }) as Obj;
  const result = validateDocument(migrated);
  return result.ok ? success({ document: result.value, sourceVersion: 1, migrated: true }) : result;
}
function migrateV0(
  raw: Obj,
): Result<{ document: Document; sourceVersion: 0 | 1 | 2; migrated: boolean }> {
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
  if (hasLegacyCatalogReference(raw.pages))
    push(errors, "INVALID_SCHEMA", "/pages", "Schema v0 cannot contain catalog references.");
  if (raw.sourceCompatibility !== null)
    push(
      errors,
      "INVALID_SCHEMA",
      "/sourceCompatibility",
      "Schema v0 cannot contain compatibility data.",
    );
  if (!isDenseDataArray(raw.libraryReferences) || raw.libraryReferences.length !== 0)
    push(
      errors,
      "INVALID_SCHEMA",
      "/libraryReferences",
      "Schema v0 cannot contain library references.",
    );
  if (!isObject(raw.metadata))
    push(errors, "INVALID_SCHEMA", "/metadata", "Expected metadata object.");
  else keys(raw.metadata, ["title", "description", "createdAt"], "/metadata", errors);
  if (errors.length) return { ok: false, errors: sortDiagnostics(errors) };

  const metadata = raw.metadata as Obj;
  const migrated = Object.assign(Object.create(null), raw, {
    schemaVersion: 2,
    documentId: raw.documentId,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      createdAt: metadata.createdAt,
      updatedAt: metadata.createdAt,
    },
    pages: addNullCatalogReferences(raw.pages),
  }) as Obj;
  const result = validateDocument(migrated);
  return result.ok ? success({ document: result.value, sourceVersion: 0, migrated: true }) : result;
}
export function serializeDocument(value: unknown): Result<string> {
  const valid = validateDocument(value);
  if (!valid.ok) return valid;
  try {
    const d = valid.value;
    const text = `${JSON.stringify(
      {
        schemaVersion: d.schemaVersion,
        documentId: d.documentId,
        metadata: {
          title: d.metadata.title,
          description: d.metadata.description,
          createdAt: d.metadata.createdAt,
          updatedAt: d.metadata.updatedAt,
        },
        pages: d.pages.map((page) => ({
          pageId: page.pageId,
          name: page.name,
          layers: page.layers.map((layer) => ({
            layerId: layer.layerId,
            name: layer.name,
            nodes: layer.nodes.map((node) => ({
              nodeId: node.nodeId,
              type: node.type,
              geometry: {
                x: node.geometry.x,
                y: node.geometry.y,
                width: node.geometry.width,
                height: node.geometry.height,
                rotation: node.geometry.rotation,
              },
              text: node.text,
              styleId: node.styleId,
              catalogReference:
                node.catalogReference === null
                  ? null
                  : {
                      shapeId: node.catalogReference.shapeId,
                      version: node.catalogReference.version,
                    },
            })),
            connections: layer.connections.map((connection) => ({
              connectionId: connection.connectionId,
              sourceNodeId: connection.sourceNodeId,
              targetNodeId: connection.targetNodeId,
              routing: connection.routing,
              label: connection.label,
              styleId: connection.styleId,
            })),
          })),
        })),
        styles: d.styles.map((style) => ({
          styleId: style.styleId,
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          textColor: style.textColor,
          fontSize: style.fontSize,
        })),
        libraryReferences: [],
        sourceCompatibility:
          d.sourceCompatibility === null
            ? null
            : {
                format: "drawio",
                version: 1,
                pages: d.sourceCompatibility.pages.map((sourcePage) => ({
                  pageId: sourcePage.pageId,
                  sourcePageId: sourcePage.sourcePageId,
                  cellIdMap: sourcePage.cellIdMap.map((mapping) => ({
                    sourceId: mapping.sourceId,
                    elementId: mapping.elementId,
                  })),
                  fragments: [...sourcePage.fragments],
                })),
              },
      },
      null,
      2,
    )}\n`;
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return failure("LIMIT_EXCEEDED", "", "Serialized document exceeds the 10 MiB limit.");
    return success(text);
  } catch {
    return failure("INVALID_SCHEMA", "", "Document could not be serialized.");
  }
}
export function createDocument(input: CreateDocumentInput): Result<ModelState> {
  try {
    if (!isObject(input)) return failure("INVALID_SCHEMA", "", "Expected creation input.");
    const inputErrors: Diagnostic[] = [];
    keys(
      input as Obj,
      [
        "documentId",
        "pageId",
        "layerId",
        "title",
        "now",
        ...["pageName", "layerName"].filter((key) => own(input as Obj, key)),
      ],
      "",
      inputErrors,
    );
    if (inputErrors.length) return { ok: false, errors: inputErrors };
    if (
      !validId(input.documentId) ||
      !validId(input.pageId) ||
      !validId(input.layerId) ||
      !string(input.title, 1, 256) ||
      (input.pageName !== undefined && !string(input.pageName, 1, 256)) ||
      (input.layerName !== undefined && !string(input.layerName, 1, 256)) ||
      !validTimestamp(input.now)
    )
      return failure("INVALID_SCHEMA", "", "Creation values are invalid.");
    const d = {
      schemaVersion: 2,
      documentId: input.documentId,
      metadata: { title: input.title, description: "", createdAt: input.now, updatedAt: input.now },
      pages: [
        {
          pageId: input.pageId,
          name: input.pageName ?? "Page 1",
          layers: [
            {
              layerId: input.layerId,
              name: input.layerName ?? "Layer 1",
              nodes: [],
              connections: [],
            },
          ],
        },
      ],
      styles: [],
      libraryReferences: [],
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
const findPage = (d: Document, id: unknown): Page | undefined =>
  d.pages.find((p) => p.pageId === id);
const findLayer = (p: Page | undefined, id: unknown): Layer | undefined =>
  p?.layers.find((l) => l.layerId === id);
const stringArray = (v: unknown): v is string[] =>
  isDenseDataArray(v) && v.every((x) => typeof x === "string");
function applyOne(d: Document, command: unknown, affected: Set<Id>, path: string): Result<void> {
  if (!isObject(command) || typeof command.type !== "string") return failCommand(path);
  const type = command.type;
  const schemas: Record<string, string[]> = {
    "document.setMetadata": ["type", "title", "description"],
    "document.setSourceCompatibility": ["type", "sourceCompatibility"],
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
  const page = (): Page | undefined => findPage(d, command.pageId);
  const layer = (): Layer | undefined => findLayer(page(), command.layerId);
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
    case "document.setSourceCompatibility": {
      const checked = validateDocument({ ...d, sourceCompatibility: command.sourceCompatibility });
      if (!checked.ok) return checked;
      d.sourceCompatibility = checked.value.sourceCompatibility;
      note(d.documentId);
      return success(undefined);
    }
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
      d.pages.splice(command.index, 0, candidate as unknown as Page);
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
      if (d.sourceCompatibility !== null) {
        const pages = d.sourceCompatibility.pages.filter(
          (sourcePage) => sourcePage.pageId !== removed.pageId,
        );
        d.sourceCompatibility = pages.length > 0 ? { ...d.sourceCompatibility, pages } : null;
      }
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
        (id) => d.pages.find((p) => p.pageId === id) as unknown as Page,
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
      const probe = detachAndNormalize(d);
      (probe.pages.find((x) => x.pageId === p.pageId) as unknown as Page).layers.push(
        candidate as unknown as Layer,
      );
      const checked = validateDocument(probe);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((e) => ({ ...e, path: `${path}/layer${e.path}` })),
        };
      p.layers.splice(command.index, 0, candidate as unknown as Layer);
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
        (id) => p.layers.find((l) => l.layerId === id) as unknown as Layer,
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
      const probe = detachAndNormalize(d);
      const pl = findLayer(findPage(probe, p.pageId), l.layerId) as unknown as Layer;
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
      const probe = detachAndNormalize(d);
      const target = findLayer(findPage(probe, p.pageId), l.layerId) as unknown as Layer;
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
      const probe = detachAndNormalize(d);
      const target = findLayer(
        findPage(probe, command.pageId),
        command.layerId,
      ) as unknown as Layer;
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
      const probe = detachAndNormalize(d);
      const target = findLayer(
        findPage(probe, command.pageId),
        command.layerId,
      ) as unknown as Layer;
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
      const probe = detachAndNormalize(d);
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
function pageById(d: Document, id: unknown): Page | undefined {
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
function purgeDanglingConnections(d: Document, affected: Set<Id>): void {
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
    const candidate = detachAndNormalize(valid.value);
    const affected = new Set<Id>();
    const apply = (cmd: unknown, path: string): Result<void> => {
      if (isObject(cmd) && cmd.type === "batch") {
        const errs: Diagnostic[] = [];
        keys(cmd, ["type", "commands"], path, errs, "INVALID_COMMAND");
        if (errs.length) return { ok: false, errors: errs };
        if (
          !isDenseDataArray(cmd.commands) ||
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
      return success({ state, changed: false, affectedIds: [] });
    if (state.revision >= Number.MAX_SAFE_INTEGER)
      return failCommand("", "Revision limit exceeded.", "LIMIT_EXCEEDED");
    if (context.now < original.document.metadata.updatedAt)
      return failCommand(
        "/now",
        "Update time precedes the current document time.",
        "INVALID_SCHEMA",
      );
    checked.value.metadata.updatedAt = context.now;
    const final = serializeDocument(checked.value);
    if (!final.ok) return final;
    return success({
      state: { document: checked.value, revision: state.revision + 1 },
      changed: true,
      affectedIds: [...affected].sort(),
    });
  } catch {
    return failure("INVALID_COMMAND", "", "Command could not be applied safely.");
  }
}
