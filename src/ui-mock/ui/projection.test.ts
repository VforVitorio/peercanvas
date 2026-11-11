import { describe, expect, it } from "vitest";
import { createDemoService } from "../services/demo-service";
import {
  anchoredScroll,
  buildProjection,
  connectionPoints,
  dragPosition,
  exceedsDragThreshold,
  fitZoom,
  previewConnections,
  revealScroll,
  scrollExtent,
  stageOffset,
  toWorld,
  worldExtent,
  type ProjectedElement,
} from "./projection";
import { canvasPaper, contrast, defaultAppearance, themeCss } from "./tokens";
import type { CanonicalDocument } from "./types";

// The shared document contract: a null style is white fill, black stroke/text, stroke width 1,
// font size 16; text nodes have no rendered fill/stroke.
const TEXT_CONTRAST = 4.5;

async function diagramWithUnstyledNodes() {
  const service = createDemoService();
  await service.open("diagram");
  service.addShape("rectangle");
  service.addShape("text");
  const document = service.getSnapshot().document as CanonicalDocument;
  service.dispose();
  return document;
}

const rectangles = (elements: ProjectedElement[]) =>
  elements.flatMap((element) => (element.kind === "rectangle" ? [element] : []));
const arrows = (elements: ProjectedElement[]) =>
  elements.flatMap((element) => (element.kind === "arrow" ? [element] : []));

describe("declared default appearance", () => {
  it("matches the shared document contract values", () => {
    expect(defaultAppearance).toEqual({
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      textColor: "#000000",
      fontSize: 16,
    });
  });

  it("renders null-style shapes and text nodes with the declared defaults", async () => {
    const document = await diagramWithUnstyledNodes();
    const nodes = document.pages[0].layers.flatMap((layer) => layer.nodes);
    const unstyledShape = nodes.find((node) => node.type === "rectangle" && node.styleId === null);
    const unstyledText = nodes.find((node) => node.type === "text" && node.styleId === null);
    expect(unstyledShape).toBeTruthy();
    expect(unstyledText).toBeTruthy();

    const { elements } = buildProjection(document, document.pages[0].pageId, null);
    const shape = rectangles(elements).find((e) => e.nodeId === unstyledShape!.nodeId)!;
    const text = rectangles(elements).find((e) => e.nodeId === unstyledText!.nodeId)!;

    expect(shape.props).toMatchObject({
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      labelFill: "#000000",
      labelFontSize: 16,
    });
    // Text nodes: no rendered fill/stroke, black default text.
    expect(text.props).toMatchObject({
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
      labelFill: "#000000",
      labelFontSize: 16,
    });
  });

  it("keeps the declared defaults legible on the paper in both editor themes", () => {
    expect(contrast(defaultAppearance.textColor, canvasPaper.paper)).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
    expect(contrast(defaultAppearance.stroke, canvasPaper.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(canvasPaper.textMuted, canvasPaper.paper)).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
    expect(contrast(canvasPaper.focus, canvasPaper.paper)).toBeGreaterThanOrEqual(3);
    // The same white paper variables are emitted under both theme selectors.
    const css = themeCss();
    const [light, dark] = css.split("\n");
    for (const block of [light, dark]) {
      expect(block).toContain(`--pc-paper-paper: ${canvasPaper.paper}`);
      expect(block).toContain(`--pc-paper-focus: ${canvasPaper.focus}`);
    }
  });

  it("derives identical projections regardless of editor theme and never edits the document", async () => {
    const document = await diagramWithUnstyledNodes();
    const before = JSON.stringify(document);
    // The projection takes no theme input: build twice around a theme switch.
    const first = buildProjection(document, document.pages[0].pageId, null);
    const second = buildProjection(document, document.pages[0].pageId, null);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe("explicit styles", () => {
  it("are preserved unchanged for nodes", async () => {
    const document = await diagramWithUnstyledNodes();
    const { elements } = buildProjection(document, document.pages[0].pageId, null);
    const web = rectangles(elements).find((e) => e.props.labelText === "Web client")!;
    const webNode = document.pages[0].layers
      .flatMap((layer) => layer.nodes)
      .find((node) => node.text === "Web client")!;
    const style = document.styles.find((s) => s.styleId === webNode.styleId);
    expect(style).toBeTruthy();
    expect(style).toMatchObject({ fill: "#e8efff", stroke: "#3155b7", strokeWidth: 2 });
    expect(web.props).toMatchObject({
      fill: style!.fill,
      stroke: style!.stroke,
      strokeWidth: style!.strokeWidth,
      labelFill: style!.textColor,
      labelFontSize: style!.fontSize,
    });
  });

  it("treat a null fill or stroke as the contract defaults, not transparent", async () => {
    const document = await diagramWithUnstyledNodes();
    const styled = {
      ...document,
      styles: document.styles.map((style) => ({ ...style, fill: null, stroke: null })),
    } as CanonicalDocument;
    const { elements } = buildProjection(styled, styled.pages[0].pageId, null);
    const web = rectangles(elements).find((e) => e.props.labelText === "Web client")!;
    expect(web.props.fill).toBe("#ffffff");
    expect(web.props.stroke).toBe("#000000");
  });

  it("never render fill or stroke for styled text nodes, with or without null colours", async () => {
    const document = await diagramWithUnstyledNodes();
    const textNode = document.pages[0].layers
      .flatMap((layer) => layer.nodes)
      .find((node) => node.type === "text")!;
    const styleId = "00000000-0000-4000-8000-0000000000bb";
    for (const colours of [
      { fill: "#ff0000", stroke: "#00ff00" },
      { fill: null, stroke: null },
    ]) {
      const styled = {
        ...document,
        styles: [
          ...document.styles,
          { styleId, ...colours, strokeWidth: 4, textColor: "#112233", fontSize: 20 },
        ],
        pages: document.pages.map((page) => ({
          ...page,
          layers: page.layers.map((layer) => ({
            ...layer,
            nodes: layer.nodes.map((node) =>
              node.nodeId === textNode.nodeId ? { ...node, styleId } : node,
            ),
          })),
        })),
      } as CanonicalDocument;
      // The projection has no theme input, so both editor themes share this result.
      for (const theme of ["light", "dark"]) {
        const { elements } = buildProjection(styled, styled.pages[0].pageId, null);
        const text = rectangles(elements).find((e) => e.nodeId === textNode.nodeId)!;
        expect(text.props, theme).toMatchObject({
          fill: "transparent",
          stroke: "transparent",
          strokeWidth: 0,
          labelFill: "#112233",
          labelFontSize: 20,
        });
      }
    }
  });
});

describe("stacking order", () => {
  const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const node = (id: string, x: number) => ({
    nodeId: id,
    type: "rectangle",
    geometry: { x, y: 0, width: 10, height: 10, rotation: 0 },
    text: "",
    styleId: null,
  });
  const link = (id: string, source: string, target: string) => ({
    connectionId: id,
    sourceNodeId: source,
    targetNodeId: target,
    routing: "straight",
    label: "",
    styleId: null,
  });

  it("emits layers back to front, each layer's connections then nodes in array order", () => {
    const document = {
      styles: [],
      pages: [
        {
          pageId: uid(1),
          layers: [
            {
              layerId: uid(2),
              nodes: [node("a1", 0), node("a2", 100)],
              // Multiple connections in one layer keep their array order.
              connections: [link("c1", "a1", "a2"), link("c1b", "a2", "a1")],
            },
            {
              layerId: uid(3),
              nodes: [node("b1", 200)],
              // Cross-layer connection to a node in the earlier layer.
              connections: [link("c2", "a1", "b1")],
            },
          ],
        },
      ],
    } as unknown as CanonicalDocument;
    const { elements, nodeIds } = buildProjection(document, uid(1), null);
    expect(
      elements.map((e) => (e.kind === "arrow" ? e.id.replace("pc-connection-", "") : e.id)),
    ).toEqual(["c1", "c1b", "a1", "a2", "c2", "b1"]);
    expect(nodeIds).toEqual(["a1", "a2", "b1"]);
  });

  it("resolves a connection to a node on a later layer", () => {
    const document = {
      styles: [],
      pages: [
        {
          pageId: uid(1),
          layers: [
            { layerId: uid(2), nodes: [node("a1", 0)], connections: [link("c1", "a1", "b1")] },
            { layerId: uid(3), nodes: [node("b1", 200)], connections: [] },
          ],
        },
      ],
    } as unknown as CanonicalDocument;
    const { elements } = buildProjection(document, uid(1), null);
    expect(elements.map((e) => e.id)).toEqual(["pc-connection-c1", "a1", "b1"]);
  });
});

describe("connection styles", () => {
  it("use the declared default stroke when the connection has no style", async () => {
    const document = await diagramWithUnstyledNodes();
    const { elements } = buildProjection(document, document.pages[0].pageId, null);
    const links = arrows(elements);
    expect(links.length).toBe(3);
    for (const link of links)
      expect(link.props).toMatchObject({ stroke: "#000000", fill: "#000000", strokeWidth: 1 });
  });

  it("honour an explicit connection style stroke and width", async () => {
    const document = await diagramWithUnstyledNodes();
    const styleId = "00000000-0000-4000-8000-0000000000aa";
    const styled = {
      ...document,
      styles: [
        ...document.styles,
        {
          styleId,
          fill: null,
          stroke: "#c0392b",
          strokeWidth: 5,
          textColor: "#000000",
          fontSize: 16,
        },
      ],
      pages: document.pages.map((page) => ({
        ...page,
        layers: page.layers.map((layer) => ({
          ...layer,
          connections: layer.connections.map((connection, index) =>
            index === 0 ? { ...connection, styleId } : connection,
          ),
        })),
      })),
    } as CanonicalDocument;
    const { elements } = buildProjection(styled, styled.pages[0].pageId, null);
    const links = arrows(elements);
    const explicit = links.filter((link) => link.props.stroke === "#c0392b");
    expect(explicit).toHaveLength(1);
    expect(explicit[0].props).toMatchObject({ fill: "#c0392b", strokeWidth: 5 });
    expect(links.filter((link) => link.props.stroke === "#000000")).toHaveLength(2);
  });
});

describe("fitZoom", () => {
  const bounds = { x: 100, y: 80, width: 760, height: 270 };

  it("fits the rightmost content edge inside the viewport with padding", () => {
    const zoom = fitZoom(bounds, { width: 800, height: 800 }, 48)!;
    expect(zoom).toBeLessThan(1);
    expect((bounds.x + bounds.width) * zoom).toBeLessThanOrEqual(800 - 48 * 2 + 0.001);
  });

  it("can be capped so small content is not magnified", () => {
    expect(fitZoom({ x: 0, y: 0, width: 10, height: 10 }, { width: 800, height: 800 }, 48, 1)).toBe(
      1,
    );
  });

  it("returns null without bounds or a laid-out viewport", () => {
    expect(fitZoom(null, { width: 800, height: 800 }, 48)).toBeNull();
    expect(fitZoom(bounds, { width: 0, height: 0 }, 48)).toBeNull();
  });

  it("includes negative coordinates so a fit never needs scrolling", () => {
    const negative = { x: -300, y: -100, width: 600, height: 200 };
    const zoom = fitZoom(negative, { width: 800, height: 600 }, 48)!;
    const extent = scrollExtent(negative, zoom, 48);
    expect(extent.width).toBeLessThanOrEqual(800);
    expect(extent.height).toBeLessThanOrEqual(600);
  });
});

describe("viewport scrolling geometry", () => {
  const bounds = { x: 100, y: 80, width: 760, height: 270 };
  const P = 48;

  it("sizes the scroll extent from content and zoom only, including the page origin", () => {
    expect(worldExtent(bounds)).toEqual({ minX: 0, minY: 0, maxX: 860, maxY: 350 });
    expect(scrollExtent(bounds, 1, P)).toEqual({ width: 956, height: 446 });
    expect(scrollExtent(bounds, 2, P)).toEqual({ width: 1816, height: 796 });
    expect(scrollExtent(null, 1, P)).toEqual({ width: 96, height: 96 });
    // Negative geometry extends the extent up/left of the origin.
    const negative = { x: -200, y: -50, width: 300, height: 100 };
    expect(worldExtent(negative)).toEqual({ minX: -200, minY: -50, maxX: 100, maxY: 50 });
    expect(scrollExtent(negative, 1, P)).toEqual({ width: 396, height: 196 });
  });

  it("does not overflow by a rounding pixel at an exact fit", () => {
    const zoom = fitZoom(bounds, { width: 700, height: 600 }, P)!;
    expect(scrollExtent(bounds, zoom, P).width).toBeLessThanOrEqual(700);
  });

  it("translates the stage by the scroll offset so every content edge is reachable", () => {
    const view = { width: 700, height: 400 };
    for (const zoom of [0.5, 1, 1.25, 2, 4]) {
      const extent = scrollExtent(bounds, zoom, P);
      const max = { left: Math.max(0, extent.width - view.width), top: 0 };
      const atEnd = stageOffset(bounds, zoom, P, max);
      // Rightmost content edge in viewport coordinates when fully scrolled.
      const right = atEnd.x + (bounds.x + bounds.width) * zoom;
      expect(right).toBeLessThanOrEqual(view.width - P + 1);
      const atStart = stageOffset(bounds, zoom, P, { left: 0, top: 0 });
      expect(atStart.x + bounds.x * zoom).toBeGreaterThanOrEqual(P);
    }
    const negative = { x: -200, y: -50, width: 300, height: 100 };
    const start = stageOffset(negative, 2, P, { left: 0, top: 0 });
    expect(start.x + negative.x * 2).toBe(P);
    expect(start.y + negative.y * 2).toBe(P);
  });

  it("keeps the world point at the viewport centre fixed across a zoom change", () => {
    const view = { width: 700, height: 400 };
    const from = { zoom: 1, left: 120, top: 30 };
    const to = anchoredScroll(bounds, P, from, 2, view);
    const centreBefore = (view.width / 2 + from.left - P) / from.zoom;
    const centreAfter = (view.width / 2 + to.left - P) / 2;
    expect(centreAfter).toBeCloseTo(centreBefore, 6);
    expect(anchoredScroll(bounds, P, { zoom: 2, left: 0, top: 0 }, 0.5, view)).toEqual({
      left: 0,
      top: 0,
    });
  });

  it("reveals an off-screen element with the minimal scroll, and leaves visible ones alone", () => {
    const view = { width: 700, height: 400 };
    const node = { x: 680, y: 220, width: 180, height: 60 };
    expect(revealScroll(bounds, 1, P, node, { left: 0, top: 0 }, view)).toEqual({
      left: 48 + 860 + 16 - 700,
      top: 0,
    });
    expect(revealScroll(bounds, 1, P, node, { left: 300, top: 0 }, view)).toBeNull();
    // Scrolled past it: align its start edge.
    expect(
      revealScroll(
        bounds,
        1,
        P,
        { x: 100, y: 80, width: 100, height: 40 },
        { left: 400, top: 0 },
        view,
      ),
    ).toEqual({
      left: 48 + 100 - 16,
      top: 0,
    });
  });
});

describe("drag geometry", () => {
  const P = 48;

  it("uses a 3 CSS-pixel threshold", () => {
    expect(exceedsDragThreshold(2, 2)).toBe(false); // 2.83 px
    expect(exceedsDragThreshold(3, 0)).toBe(true);
    expect(exceedsDragThreshold(0, -3)).toBe(true);
    expect(exceedsDragThreshold(0, 0)).toBe(false);
  });

  it("inverts the stage transform at 25%, 100% and 200%, with scroll and negative extents", () => {
    const bounds = { x: -200, y: -50, width: 600, height: 300 };
    for (const zoom of [0.25, 1, 2]) {
      for (const scroll of [
        { left: 0, top: 0 },
        { left: 37, top: 11 },
      ]) {
        const offset = stageOffset(bounds, zoom, P, scroll);
        const stage = { ...offset, scale: zoom };
        // A world point rendered at local = offset + world × zoom maps back exactly.
        for (const world of [
          { x: -200, y: -50 },
          { x: 0, y: 0 },
          { x: 123, y: 77 },
        ]) {
          const local = { x: offset.x + world.x * zoom, y: offset.y + world.y * zoom };
          const back = toWorld(local, stage);
          expect(back.x).toBeCloseTo(world.x, 9);
          expect(back.y).toBeCloseTo(world.y, 9);
        }
      }
    }
  });

  it("moves by exact world travel into negative space, without rounding", () => {
    const origin = { x: 20, y: 10 };
    const stage = { x: 48, y: 48, scale: 0.25 };
    const start = toWorld({ x: 100, y: 100 }, stage);
    // 25 CSS px left at 25% is 100 world units.
    expect(dragPosition(origin, start, toWorld({ x: 75, y: 90 }, stage))).toEqual({
      x: -80,
      y: -30,
    });
    const at200 = { x: 48, y: 48, scale: 2 };
    const s2 = toWorld({ x: 100, y: 100 }, at200);
    // 3 CSS px at 200% is exactly 1.5 world units: no snapping to whole units.
    expect(dragPosition(origin, s2, toWorld({ x: 103, y: 97 }, at200))).toEqual({
      x: 21.5,
      y: 8.5,
    });
  });

  it("preserves an exact fractional origin for net-zero travel at fractional scales", () => {
    const origin = { x: 100.4, y: -37.65 };
    for (const scale of [0.25, 0.7, 1 / 3, 1, 1.1, 2]) {
      const stage = { x: 48.3, y: -12.7, scale };
      const pointer = { x: 251, y: 199 };
      const start = toWorld(pointer, stage);
      // Out and back to the exact pointer origin: the canonical origin, bit for bit.
      const away = dragPosition(origin, start, toWorld({ x: 290, y: 160 }, stage));
      expect(away).not.toEqual(origin);
      const back = dragPosition(origin, start, toWorld(pointer, stage));
      expect(back).toEqual(origin);
      expect(Object.is(back.x, origin.x) && Object.is(back.y, origin.y)).toBe(true);
    }
  });

  it("maps CSS travel through the inverse scale at fractional zoom", () => {
    const origin = { x: 100.4, y: 50.25 };
    const stage = { x: 48, y: 48, scale: 0.7 };
    const start = toWorld({ x: 300, y: 300 }, stage);
    // 21 CSS px right / 14 up at 70% is 30 / -20 world units (to floating-point precision).
    const moved = dragPosition(origin, start, toWorld({ x: 321, y: 286 }, stage));
    expect(moved.x).toBeCloseTo(130.4, 9);
    expect(moved.y).toBeCloseTo(30.25, 9);
    expect(Number.isInteger(moved.x)).toBe(false);
  });

  it("previews only the connections touching the dragged node, with canonical geometry", async () => {
    const document = await diagramWithUnstyledNodes();
    const projection = buildProjection(document, document.pages[0].pageId, null);
    const links = arrows(projection.elements);
    const node = rectangles(projection.elements).find((r) =>
      links.some((l) => l.sourceNodeId === r.nodeId || l.targetNodeId === r.nodeId),
    )!;
    const touching = links.filter(
      (l) => l.sourceNodeId === node.nodeId || l.targetNodeId === node.nodeId,
    );
    // At the canonical position the preview equals the projection.
    const same = previewConnections(projection, node.nodeId, node.props);
    expect(same.map((l) => l.id)).toEqual(touching.map((l) => l.id));
    for (const link of same)
      expect(link.points).toEqual(touching.find((l) => l.id === link.id)!.props.points);

    // After a move it equals the projection of the moved document.
    const moved = { x: node.props.x - 300, y: node.props.y - 200 };
    const preview = previewConnections(projection, node.nodeId, moved);
    const movedDocument = {
      ...document,
      pages: document.pages.map((page) => ({
        ...page,
        layers: page.layers.map((layer) => ({
          ...layer,
          nodes: layer.nodes.map((n) =>
            n.nodeId === node.nodeId ? { ...n, geometry: { ...n.geometry, ...moved } } : n,
          ),
        })),
      })),
    } as CanonicalDocument;
    const rebuilt = arrows(buildProjection(movedDocument, document.pages[0].pageId, null).elements);
    for (const link of preview)
      expect(link.points).toEqual(rebuilt.find((l) => l.id === link.id)!.props.points);
    expect(preview.some((l, i) => l.points.join() !== same[i].points.join())).toBe(true);
  });

  it("clips connection endpoints to box edges", () => {
    expect(
      connectionPoints(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 100, y: 0, width: 10, height: 10 },
      ),
    ).toEqual([10, 5, 100, 5]);
  });

  it("records the owning layer and connection endpoints outside renderer props", async () => {
    const document = await diagramWithUnstyledNodes();
    const projection = buildProjection(document, document.pages[0].pageId, null);
    for (const rect of rectangles(projection.elements)) {
      expect(rect.layerId).toBeTruthy();
      expect(rect.props).not.toHaveProperty("layerId");
    }
    for (const link of arrows(projection.elements)) {
      expect(link.sourceNodeId).toBeTruthy();
      expect(link.props).not.toHaveProperty("sourceNodeId");
    }
  });
});
