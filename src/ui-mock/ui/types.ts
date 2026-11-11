import type { DemoState } from "../services/demo-service";

/** Types derived from the agreed service port; the UI defines no document schema of its own. */
export type CanonicalDocument = NonNullable<DemoState["document"]>;
export type DocPage = CanonicalDocument["pages"][number];
export type DocLayer = DocPage["layers"][number];
export type DocNode = DocLayer["nodes"][number];
export type DocConnection = DocLayer["connections"][number];
export type DocStyle = CanonicalDocument["styles"][number];
export type Operation = NonNullable<DemoState["operation"]>;
export type Proposal = NonNullable<DemoState["proposal"]>;
export type Participant = DemoState["participants"][number];

export type ThemeName = "light" | "dark";
export type RightPanel = "inspector" | "assistant" | "collab" | "history";
export type LeftPanel = "shapes" | "outline" | "pages" | "layers";

export type DialogState =
  | { kind: "help" }
  | { kind: "shortcuts" }
  | { kind: "preferences" }
  | { kind: "attribution" }
  | { kind: "import" }
  | { kind: "export" }
  | { kind: "rename" }
  | { kind: "recovery"; id: string }
  | { kind: "decision"; action: PendingReplacement };

export type PendingReplacement =
  | { type: "open"; fixture: DemoState["fixture"]; label: string }
  | { type: "new" }
  | { type: "close" }
  | { type: "recover"; id: string; label: string };

export interface Preferences {
  theme: ThemeName;
  reduceMotion: boolean;
  showGrid: boolean;
  nudgeStep: number;
}

export const initialPreferences: Preferences = {
  theme: "light",
  reduceMotion: false,
  showGrid: true,
  nudgeStep: 8,
};

/** Locate the page currently shown, falling back to the first page. */
export function currentPage(doc: CanonicalDocument | null, pageId: string | null): DocPage | null {
  if (!doc) return null;
  return doc.pages.find((page) => page.pageId === pageId) ?? doc.pages[0] ?? null;
}

export function findNode(
  doc: CanonicalDocument | null,
  nodeId: string | null,
): { node: DocNode; layer: DocLayer; page: DocPage } | null {
  if (!doc || !nodeId) return null;
  for (const page of doc.pages)
    for (const layer of page.layers)
      for (const node of layer.nodes) if (node.nodeId === nodeId) return { node, layer, page };
  return null;
}

export function styleFor(doc: CanonicalDocument, styleId: string | null | undefined) {
  return doc.styles.find((style) => style.styleId === styleId) ?? null;
}

export function nodeLabel(node: DocNode): string {
  const kind = node.type === "text" ? "Text" : "Rectangle";
  const text = node.text?.trim();
  return text ? `${kind} “${text}”` : `${kind} (no label)`;
}
