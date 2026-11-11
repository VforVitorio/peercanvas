// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0
// Modified for PeerCanvas: Weave is a disposable projection of the canonical document.
// Only completed gestures can request a validated model command from the caller.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Weave,
  WeaveArrowNode,
  WeaveGroupNode,
  WeaveLayerNode,
  WeaveNodesSelectionPlugin,
  WeaveRectangleNode,
  WeaveSelectionToolAction,
  WeaveStageNode,
  WeaveStageResizePlugin,
  WeaveStateManipulation,
  defaultInitialState,
} from "@inditextech/weave-sdk";
import { WeaveKonvaBaseRenderer } from "@inditextech/weave-renderer-konva-base";
import { WeaveStoreStandalone } from "@inditextech/weave-store-standalone/client";
import type { WeaveStateElement } from "@inditextech/weave-types";
import type Konva from "konva";
import type { Document, Geometry } from "../document";
import {
  buildProjection,
  fitZoom,
  SELECTION_OVERLAY_ID,
  type ProjectedElement,
} from "./projection";

export type CanvasStatus =
  { state: "starting" } | { state: "ready" } | { state: "error"; message: string };

interface Props {
  document: Document | null;
  pageId: string | null;
  layerId: string | null;
  selection: string | null;
  zoom: number;
  fitRequest: number;
  onCommitGeometry?: (nodeId: string, geometry: Geometry) => boolean;
  onSelect: (nodeId: string | null) => void;
  onZoomChange: (zoom: number) => void;
  onStatusChange?: (status: CanvasStatus) => void;
}

const PADDING = 48;
const SELECTION_COLOR = "#005CBA";
const NODE_TRANSFORM: Konva.TransformerConfig = {
  rotateEnabled: false,
  flipEnabled: false,
  resizeEnabled: true,
  keepRatio: false,
  enabledAnchors: [
    "top-left",
    "top-center",
    "top-right",
    "middle-right",
    "middle-left",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ],
};

function toWeave(element: ProjectedElement, editable: boolean): WeaveStateElement {
  if (element.kind === "arrow") {
    const base = WeaveArrowNode.defaultState(element.id);
    return {
      ...base,
      props: {
        ...base.props,
        id: element.id,
        x: 0,
        y: 0,
        ...element.props,
        pointerLength: 10,
        pointerWidth: 10,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        listening: false,
      },
    };
  }
  const base = WeaveRectangleNode.defaultState(element.id);
  return {
    ...base,
    props: { ...base.props, id: element.id, ...element.props, draggable: editable },
  };
}

function overlayState(
  geometry: { x: number; y: number; width: number; height: number } | null,
  color: string,
): WeaveStateElement {
  const base = WeaveRectangleNode.defaultState(SELECTION_OVERLAY_ID);
  return {
    ...base,
    props: {
      ...base.props,
      id: SELECTION_OVERLAY_ID,
      x: (geometry?.x ?? 0) - 6,
      y: (geometry?.y ?? 0) - 6,
      width: (geometry?.width ?? 1) + 12,
      height: (geometry?.height ?? 1) + 12,
      fill: "transparent",
      stroke: color,
      strokeWidth: 2,
      dash: [6, 4],
      visible: Boolean(geometry),
      listening: false,
      labelText: "",
    },
  };
}

export default function WeaveCanvas({
  document: doc,
  pageId,
  layerId,
  selection,
  zoom,
  fitRequest,
  onCommitGeometry,
  onSelect,
  onZoomChange,
  onStatusChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Weave | null>(null);
  const selectionPluginRef = useRef<WeaveNodesSelectionPlugin | null>(null);
  const [status, setStatus] = useState<CanvasStatus>({ state: "starting" });
  const [attempt, setAttempt] = useState(0);
  const projection = useMemo(() => buildProjection(doc, pageId, layerId), [doc, pageId, layerId]);
  const editable = onCommitGeometry !== undefined;
  // Pages already auto-fitted in this workspace; later zoom changes are the user's.
  const fittedPages = useRef(new Set<string>());

  // Latest values for callbacks that must not recreate the renderer.
  const latest = useRef({
    onSelect,
    onZoomChange,
    onStatusChange,
    onCommitGeometry,
    zoom,
    selection,
    projection,
  });
  latest.current = {
    onSelect,
    onZoomChange,
    onStatusChange,
    onCommitGeometry,
    zoom,
    selection,
    projection,
  };

  const geometryOf = (nodeId: string | null) => {
    const found = projection.elements.find(
      (element) => element.kind === "rectangle" && element.id === nodeId,
    );
    return found && found.kind === "rectangle" ? found.props : null;
  };

  const report = (next: CanvasStatus) => {
    setStatus(next);
    latest.current.onStatusChange?.(next);
  };

  // Recreate the renderer projection whenever the accepted snapshot, page, or layer focus
  // changes. Renderer state is discarded with the instance. The theme is deliberately not an
  // input: the paper and the document's semantic appearance do not change with editor chrome.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const focusBeforeStart = document.activeElement;
    const externalFocus =
      focusBeforeStart instanceof HTMLElement &&
      focusBeforeStart !== document.body &&
      !element.contains(focusBeforeStart)
        ? focusBeforeStart
        : null;
    let disposed = false;
    report({ state: "starting" });
    const ids = new Set(projection.nodeIds);
    const selected = latest.current.selection;
    const initialGeometry = selected && ids.has(selected) ? geometryOfProjection(selected) : null;

    function geometryOfProjection(nodeId: string) {
      const found = projection.elements.find((e) => e.kind === "rectangle" && e.id === nodeId);
      return found && found.kind === "rectangle" ? found.props : null;
    }

    const selectionPlugin = editable
      ? new WeaveNodesSelectionPlugin({
          config: { selection: NODE_TRANSFORM },
        })
      : null;
    let instance: Weave;
    try {
      const store = new WeaveStoreStandalone(
        {
          roomData: undefined,
          initialState: (ydoc) => {
            ydoc.transact(() => {
              defaultInitialState(ydoc);
              const root = ydoc.getMap("weave");
              const stage = root.toJSON() as WeaveStateElement;
              if (!Array.isArray(stage.props?.children))
                throw new Error("Unexpected Weave initial stage shape");
              const mainLayer = (stage.props.children as WeaveStateElement[]).find(
                (layer) => layer.key === "mainLayer",
              );
              if (!mainLayer) throw new Error("Weave initial state has no main layer");
              mainLayer.props.children = [
                ...projection.elements.map((element) => toWeave(element, editable)),
                ...(editable ? [] : [overlayState(initialGeometry, SELECTION_COLOR)]),
              ];
              root.set("props", WeaveStateManipulation.mapValueToYjs(stage.props));
            });
          },
        },
        {
          getUser: () => ({
            id: "local-editor",
            name: "Local editor",
            email: "local@peercanvas.invalid",
          }),
        },
      );
      instance = new Weave(
        {
          store,
          renderer: new WeaveKonvaBaseRenderer(),
          nodes: [
            new WeaveStageNode(),
            new WeaveLayerNode(),
            new WeaveGroupNode(),
            new WeaveRectangleNode({
              config: {
                label: { engine: "native" },
                transform: NODE_TRANSFORM,
              },
            }),
            new WeaveArrowNode(),
          ],
          plugins: [...(selectionPlugin ? [selectionPlugin] : []), new WeaveStageResizePlugin()],
          actions: editable ? [new WeaveSelectionToolAction()] : [],
          fonts: [],
          logger: { level: "error" },
        },
        {
          container: element,
          width: Math.max(1, element.clientWidth),
          height: Math.max(1, element.clientHeight),
        },
      );
    } catch (error) {
      report({ state: "error", message: error instanceof Error ? error.message : String(error) });
      return;
    }

    const applyView = () => {
      if (disposed) return;
      const stage = instance.getStage?.();
      if (!stage) return;
      const z = latest.current.zoom;
      const bounds = latest.current.projection.bounds;
      stage.scale({ x: z, y: z });
      stage.position({
        x: PADDING - (bounds ? Math.min(bounds.x, 0) : 0) * z,
        y: PADDING - (bounds ? Math.min(bounds.y, 0) : 0) * z,
      });
      stage.batchDraw();
    };

    const onPointer = (event: { target: { id: () => string; getParent: () => unknown } }) => {
      if (disposed) return;
      let node: { id: () => string; getParent: () => unknown } | null = event.target;
      const stage = instance.getStage();
      while (node && (node as unknown) !== stage) {
        const id = node.id();
        if (ids.has(id)) {
          latest.current.onSelect(id);
          return;
        }
        node = node.getParent() as typeof node;
      }
      latest.current.onSelect(null);
    };

    let gestureNode: string | null = null;
    let completingGesture = false;
    let pointerPressed = false;
    const boundNodes: Konva.Node[] = [];
    const discardProjection = () => {
      if (disposed) return;
      disposed = true;
      gestureNode = null;
      setAttempt((value) => value + 1);
    };
    const cancelGesture = () => {
      pointerPressed = false;
      if (gestureNode !== null) discardProjection();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelGesture();
    };
    const onNodesChange = () => {
      if (disposed || !selectionPlugin) return;
      instance.getStage().container().tabIndex = 0;
      const nodes = selectionPlugin.getSelectedNodes().filter((node) => ids.has(node.id()));
      const node = nodes.at(-1);
      if (nodes.length > 1) selectionPlugin.setSelectedNodes(node ? [node] : []);
      if ((node?.id() ?? null) !== latest.current.selection)
        latest.current.onSelect(node?.id() ?? null);
    };

    const beginGesture = (id: string | undefined) => {
      if (!disposed && !completingGesture && id && ids.has(id)) gestureNode = id;
    };
    const finishGesture = (id: string) => {
      if (disposed || completingGesture || gestureNode !== id) return;
      completingGesture = true;
      // Transformer and node end handlers both run; wait for Weave's store updates once.
      queueMicrotask(() => {
        if (disposed || gestureNode !== id) return;
        gestureNode = null;
        try {
          const node = instance.getStage().findOne(`#${id}`);
          const original = geometryOfProjection(id);
          if (!node || !original) return;
          const geometry: Geometry = {
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
          };
          const valid =
            Object.values(geometry).every(Number.isFinite) &&
            Math.abs(geometry.x) <= 1_000_000 &&
            Math.abs(geometry.y) <= 1_000_000 &&
            geometry.width > 0 &&
            geometry.width <= 1_000_000 &&
            geometry.height > 0 &&
            geometry.height <= 1_000_000 &&
            geometry.rotation === original.rotation;
          if (
            valid &&
            Object.keys(geometry).some(
              (key) => geometry[key as keyof Geometry] !== original[key as keyof Geometry],
            )
          )
            latest.current.onCommitGeometry?.(id, geometry);
        } catch {
          // A rejected command must leave no renderer-only geometry behind.
        } finally {
          // Accepted gestures are also redrawn only from the caller's canonical snapshot.
          discardProjection();
        }
      });
    };
    const resetRendererTapHistory = () => {
      // Label editing is command-backed; disable Weave's internal double-tap label editor.
      selectionPlugin?.getGesture().reset();
    };
    const onPointerDown = () => {
      pointerPressed = true;
      resetRendererTapHistory();
    };
    const onPointerUp = () => {
      pointerPressed = false;
    };
    const preventAltMouseClone = (event: MouseEvent) => {
      if (!pointerPressed || !event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    let ready = false;
    const markReady = () => {
      if (disposed || ready) return;
      if (selectionPlugin && !selectionPlugin.isInitialized()) return;
      ready = true;
      const stage = instance.getStage();
      if (selectionPlugin) {
        stage.container().tabIndex = 0;
        instance.triggerAction("selectionTool");
        instance.addEventListener("onNodesChange", onNodesChange);
        selectionPluginRef.current = selectionPlugin;
        for (const id of ids) {
          const node = stage.findOne(`#${id}`);
          if (!node) continue;
          node.on("dragstart.peercanvas transformstart.peercanvas", () => beginGesture(id));
          node.on("dragend.peercanvas transformend.peercanvas", () => finishGesture(id));
          boundNodes.push(node);
        }
        const transformer = selectionPlugin.getTransformer();
        transformer.on("dragstart.peercanvas transformstart.peercanvas", () => {
          beginGesture(selectionPlugin.getSelectedNodes().at(-1)?.id());
        });
        transformer.on("dragend.peercanvas transformend.peercanvas", () => {
          if (gestureNode !== null) finishGesture(gestureNode);
        });
        boundNodes.push(transformer);
        element.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("pointerup", onPointerUp, true);
        window.addEventListener("pointercancel", cancelGesture, true);
        window.addEventListener("lostpointercapture", cancelGesture, true);
        window.addEventListener("mousemove", preventAltMouseClone, true);
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("blur", cancelGesture);
      } else {
        stage.on("click.peercanvas tap.peercanvas", onPointer as never);
      }
      applyView();
      if (
        externalFocus?.isConnected &&
        (document.activeElement === stage.container() || element.contains(document.activeElement))
      )
        externalFocus.focus({ preventScroll: true });
      report({ state: "ready" });
    };
    instance.addEventListener("onRender", markReady);
    instanceRef.current = instance;
    instance
      .start()
      .then(markReady)
      .catch((error: unknown) => {
        if (!disposed)
          report({
            state: "error",
            message: error instanceof Error ? error.message : String(error),
          });
      });

    return () => {
      disposed = true;
      gestureNode = null;
      instanceRef.current = null;
      selectionPluginRef.current = null;
      instance.removeEventListener("onRender", markReady);
      instance.removeEventListener("onNodesChange", onNodesChange);
      element.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", cancelGesture, true);
      window.removeEventListener("lostpointercapture", cancelGesture, true);
      window.removeEventListener("mousemove", preventAltMouseClone, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", cancelGesture);
      for (const node of boundNodes) node.off(".peercanvas");
      try {
        instance.getStage?.()?.off("click.peercanvas tap.peercanvas");
      } catch {
        // Stage may not exist if start() never completed.
      }
      void Promise.resolve()
        .then(() => instance.destroy())
        .catch(() => undefined);
    };
    // `latest` carries callbacks/zoom/selection; recreation is keyed by projection inputs.
  }, [projection, attempt, editable]);

  // Selection overlay: renderer-only highlight derived from the transient UI selection.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || status.state !== "ready") return;
    const geometry = geometryOf(selection);
    try {
      const plugin = selectionPluginRef.current;
      if (editable && plugin) {
        const node = geometry && selection ? instance.getStage().findOne(`#${selection}`) : null;
        plugin.setSelectedNodes(node ? [node] : []);
      } else if (!editable) {
        instance.updateNode(overlayState(geometry, SELECTION_COLOR));
      }
    } catch {
      // Overlay is cosmetic; the outline panel remains the accessible selection source.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, status.state, projection, editable]);

  // Zoom: a UI-only transform on the renderer stage.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || status.state !== "ready") return;
    // A replacement instance has no stage until it renders; `status` may still read "ready"
    // from the discarded instance in this same commit. markReady applies the view later.
    const stage = instance.getStage?.();
    if (!stage) return;
    const bounds = projection.bounds;
    stage.scale({ x: zoom, y: zoom });
    stage.position({
      x: PADDING - (bounds ? Math.min(bounds.x, 0) : 0) * zoom,
      y: PADDING - (bounds ? Math.min(bounds.y, 0) : 0) * zoom,
    });
    stage.batchDraw();
  }, [zoom, status.state, projection]);

  // Fit to content on request.
  useEffect(() => {
    if (fitRequest === 0) return;
    const element = container.current;
    const bounds = projection.bounds;
    if (!element || !bounds) {
      latest.current.onZoomChange(1);
      return;
    }
    const next = fitZoom(
      bounds,
      { width: element.clientWidth, height: element.clientHeight },
      PADDING,
    );
    latest.current.onZoomChange(next ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  // First activation of a page: fit the complete content once (never magnifying beyond 100%).
  // Purely a transient viewport change; it issues no command and leaves the document clean.
  const pageKey = doc ? `${doc.documentId}:${pageId ?? ""}` : null;
  useEffect(() => {
    const element = container.current;
    if (!pageKey || !element || fittedPages.current.has(pageKey)) return;
    if (element.clientWidth <= 0 || element.clientHeight <= 0) return; // not laid out yet
    fittedPages.current.add(pageKey);
    const next = fitZoom(
      projection.bounds,
      { width: element.clientWidth, height: element.clientHeight },
      PADDING,
      1,
    );
    if (next !== null) latest.current.onZoomChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  return (
    <div className="pc-canvas-host">
      <div ref={container} className="pc-weave" data-testid="weave-container" />
      {status.state === "starting" && (
        <div className="pc-canvas-state" role="status">
          <span className="pc-spinner" aria-hidden="true" /> Starting Weave canvas…
        </div>
      )}
      {status.state === "error" && (
        <div className="pc-canvas-state pc-canvas-error" role="alert">
          <p>
            <strong>Canvas renderer failed:</strong> {status.message}
          </p>
          <p>The document is unaffected. The Outline panel and inspector remain usable.</p>
          <button type="button" className="pc-btn" onClick={() => setAttempt((n) => n + 1)}>
            Retry canvas
          </button>
        </div>
      )}
    </div>
  );
}
