import rectanglePreview from "./assets/rectangle.svg?raw";
import type { Node } from "../document";
import type { ApprovedShapeManifestEntry } from "./manifest";
import { sanitizeSvg } from "./svg";

const previews = new Map([["assets/rectangle.svg", rectanglePreview]]);
const nodeTypes: Record<string, Node["type"]> = { "basic-rectangle": "rectangle" };
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export function shapeNodeType(entry: ApprovedShapeManifestEntry): Node["type"] | null {
  return Object.prototype.hasOwnProperty.call(nodeTypes, entry.id) ? nodeTypes[entry.id] : null;
}

export function searchShapes(
  entries: ApprovedShapeManifestEntry[],
  query: string,
): ApprovedShapeManifestEntry[] {
  const term = query.trim().toLowerCase();
  return entries
    .filter(
      (entry) =>
        term === "" ||
        [entry.displayName, entry.category, ...entry.keywords].some((value) =>
          value.toLowerCase().includes(term),
        ),
    )
    .sort(
      (left, right) =>
        compare(left.displayName.toLowerCase(), right.displayName.toLowerCase()) ||
        compare(left.id, right.id),
    );
}

export function shapePreviewDataUri(entry: ApprovedShapeManifestEntry): string | null {
  if (entry.previewPath === null) return null;
  const source = previews.get(entry.previewPath);
  if (!source) return null;
  const sanitized = sanitizeSvg(source);
  return sanitized === null
    ? null
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
}
