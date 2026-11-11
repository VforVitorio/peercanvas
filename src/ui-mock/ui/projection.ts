import { defaultAppearance } from "./tokens";
import { currentPage, styleFor, type CanonicalDocument } from "./types";

/**
 * Pure, disposable renderer projection derived from an accepted canonical snapshot.
 * It carries no semantic authority: the WeaveCanvas adapter rebuilds it from the
 * service snapshot and never writes renderer state back.
 */
export type ProjectedElement =
  | {
      kind: "rectangle";
      id: string;
      nodeId: string;
      props: {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        fill: string;
        stroke: string;
        strokeWidth: number;
        labelText: string;
        labelFill: string;
        labelFontSize: number;
        opacity: number;
      };
    }
  | {
      kind: "arrow";
      id: string;
      props: { points: number[]; stroke: string; fill: string; strokeWidth: number };
    };

export interface Projection {
  elements: ProjectedElement[];
  nodeIds: string[];
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export const SELECTION_OVERLAY_ID = "pc-selection-overlay";

function edgePoint(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number },
) {
  const cx = from.x + from.width / 2;
  const cy = from.y + from.height / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx === 0 ? Infinity : from.width / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : from.height / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

export function buildProjection(
  doc: CanonicalDocument | null,
  pageId: string | null,
  activeLayerId: string | null,
): Projection {
  const page = currentPage(doc, pageId);
  if (!doc || !page) return { elements: [], nodeIds: [], bounds: null };
  const elements: ProjectedElement[] = [];
  const nodeIds: string[] = [];
  const geometry = new Map<string, { x: number; y: number; width: number; height: number }>();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  // Endpoint geometry is gathered across the whole page first so a connection may reference a
  // node on any layer of the same page.
  for (const layer of page.layers) {
    for (const node of layer.nodes) {
      const { x, y, width, height } = node.geometry;
      geometry.set(node.nodeId, { x, y, width, height });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
      nodeIds.push(node.nodeId);
    }
  }

  // Layers are emitted back to front; within a layer, connections precede its nodes, and the
  // declared array order is preserved.
  for (const layer of page.layers) {
    const dimmed = activeLayerId !== null && layer.layerId !== activeLayerId;
    for (const connection of layer.connections) {
      const source = geometry.get(connection.sourceNodeId);
      const target = geometry.get(connection.targetNodeId);
      if (!source || !target) continue;
      const start = edgePoint(source, {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      });
      const end = edgePoint(target, {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2,
      });
      // Connections honour an explicit style; a null style (or a null stroke, which would make
      // the link invisible) uses the declared default stroke.
      const connectionStyle = styleFor(doc, connection.styleId);
      const connectionStroke = connectionStyle?.stroke ?? defaultAppearance.stroke;
      elements.push({
        kind: "arrow",
        id: `pc-connection-${connection.connectionId}`,
        props: {
          points: [start.x, start.y, end.x, end.y],
          stroke: connectionStroke,
          fill: connectionStroke,
          strokeWidth: connectionStyle?.strokeWidth ?? defaultAppearance.strokeWidth,
        },
      });
    }
    for (const node of layer.nodes) {
      const style = styleFor(doc, node.styleId);
      const { x, y, width, height, rotation } = node.geometry;
      const isText = node.type === "text";
      elements.push({
        kind: "rectangle",
        id: node.nodeId,
        nodeId: node.nodeId,
        props: {
          x,
          y,
          width,
          height,
          rotation: rotation ?? 0,
          // A null style takes the contract's declared defaults (white fill, black stroke/text,
          // width 1, size 16; text nodes have no fill/stroke). An explicit style is honoured as
          // written and never recoloured by the editor theme: the paper is white in both themes.
          fill: style
            ? (style.fill ?? "transparent")
            : isText
              ? "transparent"
              : defaultAppearance.fill,
          stroke: isText
            ? "transparent"
            : style
              ? (style.stroke ?? "transparent")
              : defaultAppearance.stroke,
          strokeWidth: isText ? 0 : (style?.strokeWidth ?? defaultAppearance.strokeWidth),
          labelText: node.text ?? "",
          labelFill: style?.textColor ?? defaultAppearance.textColor,
          labelFontSize: style?.fontSize ?? defaultAppearance.fontSize,
          opacity: dimmed ? 0.45 : 1,
        },
      });
    }
  }

  return {
    elements,
    nodeIds,
    bounds: nodeIds.length ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null,
  };
}

/**
 * Scale that fits all content, measured from the page origin like the stage placement, into a
 * viewport. Returns null when there is nothing meaningful to fit. A UI-only transform.
 */
export function fitZoom(
  bounds: Projection["bounds"],
  viewport: { width: number; height: number },
  padding: number,
  maxZoom = 4,
): number | null {
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) return null;
  const width = Math.max(1, viewport.width - padding * 2);
  const height = Math.max(1, viewport.height - padding * 2);
  const right = Math.max(bounds.x + bounds.width, 1);
  const bottom = Math.max(bounds.y + bounds.height, 1);
  const next = Math.min(width / right, height / bottom);
  return Number.isFinite(next) && next > 0 ? Math.min(maxZoom, Math.max(0.25, next)) : null;
}
