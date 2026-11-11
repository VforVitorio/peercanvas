import { describe, expect, it } from "vitest";
import { createDemoService } from "../services/demo-service";
import { buildProjection, fitZoom, type ProjectedElement } from "./projection";
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

  it("treat a null fill or stroke as none, not as a theme default", async () => {
    const document = await diagramWithUnstyledNodes();
    const styled = {
      ...document,
      styles: document.styles.map((style) => ({ ...style, fill: null, stroke: null })),
    } as CanonicalDocument;
    const { elements } = buildProjection(styled, styled.pages[0].pageId, null);
    const web = rectangles(elements).find((e) => e.props.labelText === "Web client")!;
    expect(web.props.fill).toBe("transparent");
    expect(web.props.stroke).toBe("transparent");
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

describe("layer and connection order", () => {
  const sid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
  const mkNode = (n: number, x: number, y: number) => ({
    nodeId: sid(n),
    type: "rectangle",
    geometry: { x, y, width: 100, height: 50, rotation: 0 },
    text: `n${n}`,
    styleId: null,
  });
  const mkConn = (n: number, source: number, target: number) => ({
    connectionId: sid(n),
    sourceNodeId: sid(source),
    targetNodeId: sid(target),
    styleId: null,
  });
  // Back layer: nodes 1,2 and connections 101,102 (1->2, 2->1).
  // Front layer: node 3 and connections 103 (3->1, cross-layer), 104 (3->2, cross-layer).
  const fixture = () =>
    ({
      documentId: sid(900),
      styles: [],
      pages: [
        {
          pageId: sid(901),
          layers: [
            {
              layerId: sid(902),
              nodes: [mkNode(1, 0, 0), mkNode(2, 300, 0)],
              connections: [mkConn(101, 1, 2), mkConn(102, 2, 1)],
            },
            {
              layerId: sid(903),
              nodes: [mkNode(3, 150, 200)],
              connections: [mkConn(103, 3, 1), mkConn(104, 3, 2)],
            },
          ],
        },
      ],
    }) as unknown as CanonicalDocument;
  const ids = (elements: ProjectedElement[]) => elements.map((element) => element.id);

  it("emits layers back to front, each layer's connections before its nodes, in declared order", () => {
    const document = fixture();
    const { elements, nodeIds } = buildProjection(document, sid(901), null);
    expect(ids(elements)).toEqual([
      `pc-connection-${sid(101)}`,
      `pc-connection-${sid(102)}`,
      sid(1),
      sid(2),
      `pc-connection-${sid(103)}`,
      `pc-connection-${sid(104)}`,
      sid(3),
    ]);
    expect(nodeIds).toEqual([sid(1), sid(2), sid(3)]);
  });

  it("keeps front-layer connectors above back-layer nodes", () => {
    const { elements } = buildProjection(fixture(), sid(901), null);
    const order = ids(elements);
    expect(order.indexOf(`pc-connection-${sid(103)}`)).toBeGreaterThan(order.indexOf(sid(2)));
  });

  it("resolves cross-layer endpoints on the same page", () => {
    const { elements } = buildProjection(fixture(), sid(901), null);
    const cross = arrows(elements).find((e) => e.id === `pc-connection-${sid(103)}`)!;
    // Node 3 centre (200,225) towards node 1 centre (50,25): leaves node 3's top-left edge.
    expect(cross.props.points).toHaveLength(4);
    expect(cross.props.points.every(Number.isFinite)).toBe(true);
    expect(cross.props.points[3]).toBeLessThan(cross.props.points[1]);
  });

  it("skips connections whose endpoint is missing from the page", () => {
    const document = fixture();
    document.pages[0].layers[1].connections.push(mkConn(105, 3, 999) as never);
    const { elements } = buildProjection(document, sid(901), null);
    expect(arrows(elements)).toHaveLength(4);
  });

  it("does not mutate the document and keeps geometry and bounds unchanged", () => {
    const document = fixture();
    const before = JSON.stringify(document);
    const { elements, bounds } = buildProjection(document, sid(901), sid(903));
    expect(JSON.stringify(document)).toBe(before);
    expect(bounds).toEqual({ x: 0, y: 0, width: 400, height: 250 });
    const node3 = rectangles(elements).find((e) => e.nodeId === sid(3))!;
    expect(node3.props).toMatchObject({ x: 150, y: 200, width: 100, height: 50, opacity: 1 });
    const node1 = rectangles(elements).find((e) => e.nodeId === sid(1))!;
    expect(node1.props).toMatchObject({ x: 0, y: 0, opacity: 0.45 });
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
});
