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
      /** Owning layer; only nodes of the active layer can be dragged. Not a renderer prop. */
      layerId: string;
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
      /** Endpoints, so a drag preview can redraw affected connections. Not renderer props. */
      sourceNodeId: string;
      targetNodeId: string;
      props: { points: number[]; stroke: string; fill: string; strokeWidth: number };
    };

type Rect = { x: number; y: number; width: number; height: number };

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

/** Straight connection between two node boxes, clipped to each box edge. */
export function connectionPoints(source: Rect, target: Rect): number[] {
  const start = edgePoint(source, {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  });
  const end = edgePoint(target, {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  });
  return [start.x, start.y, end.x, end.y];
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

  // Endpoint geometry is collected across the whole page first (cross-layer connections allowed).
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

  // Contract stacking: layers back to front; within a layer, connections then nodes, each in
  // array order.
  for (const layer of page.layers) {
    const dimmed = activeLayerId !== null && layer.layerId !== activeLayerId;
    for (const connection of layer.connections) {
      const source = geometry.get(connection.sourceNodeId);
      const target = geometry.get(connection.targetNodeId);
      if (!source || !target) continue;
      // Connections honour an explicit style; a null style (or a null stroke, which would make
      // the link invisible) uses the declared default stroke.
      const connectionStyle = styleFor(doc, connection.styleId);
      const connectionStroke = connectionStyle?.stroke ?? defaultAppearance.stroke;
      elements.push({
        kind: "arrow",
        id: `pc-connection-${connection.connectionId}`,
        sourceNodeId: connection.sourceNodeId,
        targetNodeId: connection.targetNodeId,
        props: {
          points: connectionPoints(source, target),
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
        layerId: layer.layerId,
        props: {
          x,
          y,
          width,
          height,
          rotation: rotation ?? 0,
          // Text nodes never render fill/stroke, styled or not. Otherwise a null style or null
          // fill/stroke takes the contract defaults (white fill, black stroke, width 1); explicit
          // values are honoured and never recoloured by the editor theme.
          fill: isText ? "transparent" : (style?.fill ?? defaultAppearance.fill),
          stroke: isText ? "transparent" : (style?.stroke ?? defaultAppearance.stroke),
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
 * World-space area the viewport scrolls over: from the page origin (or further up/left when
 * content has negative coordinates) to the far content edge. A UI-only concept.
 */
export function worldExtent(bounds: Projection["bounds"]) {
  if (!bounds) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(bounds.x, 0),
    minY: Math.min(bounds.y, 0),
    maxX: Math.max(bounds.x + bounds.width, 0),
    maxY: Math.max(bounds.y + bounds.height, 0),
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
  const extent = worldExtent(bounds);
  const spanX = Math.max(extent.maxX - extent.minX, 1);
  const spanY = Math.max(extent.maxY - extent.minY, 1);
  const next = Math.min(width / spanX, height / spanY);
  return Number.isFinite(next) && next > 0 ? Math.min(maxZoom, Math.max(0.25, next)) : null;
}

/**
 * Scrollable size (CSS px) of the scaled world extent plus padding on every side. It depends only
 * on content and zoom, never on the measured viewport, so scrollbars appearing cannot feed back
 * into it. Rounded (not ceiled) so an exact fit does not overflow by a fractional pixel.
 */
export function scrollExtent(bounds: Projection["bounds"], zoom: number, padding: number) {
  const extent = worldExtent(bounds);
  return {
    width: Math.round((extent.maxX - extent.minX) * zoom + padding * 2),
    height: Math.round((extent.maxY - extent.minY) * zoom + padding * 2),
  };
}

/** Stage translation for a scroll offset: world point `extent.min` sits at `padding - scroll`. */
export function stageOffset(
  bounds: Projection["bounds"],
  zoom: number,
  padding: number,
  scroll: { left: number; top: number },
) {
  const extent = worldExtent(bounds);
  return {
    x: padding - extent.minX * zoom - scroll.left,
    y: padding - extent.minY * zoom - scroll.top,
  };
}

/**
 * Scroll offset that keeps the world point under the viewport centre fixed across a zoom change.
 * The browser clamps the result to the real scroll range.
 */
export function anchoredScroll(
  bounds: Projection["bounds"],
  padding: number,
  from: { zoom: number; left: number; top: number },
  toZoom: number,
  viewport: { width: number; height: number },
) {
  const extent = worldExtent(bounds);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const worldX = (cx + from.left - padding) / from.zoom + extent.minX;
  const worldY = (cy + from.top - padding) / from.zoom + extent.minY;
  return {
    left: Math.max(0, padding + (worldX - extent.minX) * toZoom - cx),
    top: Math.max(0, padding + (worldY - extent.minY) * toZoom - cy),
  };
}

/**
 * Minimal scroll change that brings a world rectangle (plus a margin) into the viewport, or null
 * when it is already fully visible. A rectangle larger than the viewport aligns its start edge.
 */
export function revealScroll(
  bounds: Projection["bounds"],
  zoom: number,
  padding: number,
  rect: { x: number; y: number; width: number; height: number },
  scroll: { left: number; top: number },
  viewport: { width: number; height: number },
  margin = 16,
): { left: number; top: number } | null {
  const extent = worldExtent(bounds);
  const axis = (start: number, size: number, min: number, current: number, view: number) => {
    const a = padding + (start - min) * zoom - margin;
    const b = padding + (start + size - min) * zoom + margin;
    if (a < current) return Math.max(0, a);
    if (b > current + view) return Math.max(0, b - view > a ? a : b - view);
    return current;
  };
  const left = axis(rect.x, rect.width, extent.minX, scroll.left, viewport.width);
  const top = axis(rect.y, rect.height, extent.minY, scroll.top, viewport.height);
  return left === scroll.left && top === scroll.top ? null : { left, top };
}

/** Pointer travel (CSS px) before a press on a node becomes a drag; below it, a click. */
export const DRAG_THRESHOLD = 3;

export function exceedsDragThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD) {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Inverse stage transform: a point in stage-container CSS pixels to world coordinates, given the
 * stage translation and uniform scale. UI-only; the renderer never supplies semantic positions.
 */
export function toWorld(
  local: { x: number; y: number },
  stage: { x: number; y: number; scale: number },
) {
  return { x: (local.x - stage.x) / stage.scale, y: (local.y - stage.y) / stage.scale };
}

/**
 * Candidate node position for a drag: the exact canonical origin plus the exact world-space
 * pointer travel. No snapping or rounding is applied (none is approved), so a fractional origin
 * is preserved and zero travel returns the origin itself. The adapter previews and commits this
 * same value, so the preview and the committed command agree exactly.
 */
export function dragPosition(
  origin: { x: number; y: number },
  startWorld: { x: number; y: number },
  currentWorld: { x: number; y: number },
) {
  // x + 0 === x for every finite x, so zero travel yields the exact origin.
  return {
    x: origin.x + (currentWorld.x - startWorld.x),
    y: origin.y + (currentWorld.y - startWorld.y),
  };
}

/**
 * Connection points for a transient drag preview: every connection touching `nodeId`, recomputed
 * as if that node were at `position`. Uses the same geometry as the canonical projection, so an
 * accepted move redraws identically.
 */
export function previewConnections(
  projection: Projection,
  nodeId: string,
  position: { x: number; y: number },
): Array<{ id: string; points: number[] }> {
  const boxes = new Map<string, Rect>();
  for (const element of projection.elements)
    if (element.kind === "rectangle") {
      const { x, y, width, height } = element.props;
      boxes.set(
        element.nodeId,
        element.nodeId === nodeId ? { ...position, width, height } : { x, y, width, height },
      );
    }
  const result: Array<{ id: string; points: number[] }> = [];
  for (const element of projection.elements) {
    if (element.kind !== "arrow") continue;
    if (element.sourceNodeId !== nodeId && element.targetNodeId !== nodeId) continue;
    const source = boxes.get(element.sourceNodeId);
    const target = boxes.get(element.targetNodeId);
    if (source && target) result.push({ id: element.id, points: connectionPoints(source, target) });
  }
  return result;
}
