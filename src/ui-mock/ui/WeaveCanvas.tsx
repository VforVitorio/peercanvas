// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0
// Modified for PeerCanvas: the Weave setup (in-memory WeaveStoreStandalone, Konva base
// renderer, stage/layer/group/rectangle/arrow nodes, initial-state injection) is derived
// from src/native-smoke/NativeSmokeCanvas.tsx, itself adapted from Weave.js examples.
// This adapter renders a disposable, read-only projection of the canonical demo
// document. It reports selection only; it never owns or writes semantic data.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Weave,
  WeaveArrowNode,
  WeaveGroupNode,
  WeaveLayerNode,
  WeaveRectangleNode,
  WeaveStageNode,
  WeaveStageResizePlugin,
  WeaveStateManipulation,
  defaultInitialState,
} from "@inditextech/weave-sdk";
import { WeaveKonvaBaseRenderer } from "@inditextech/weave-renderer-konva-base";
import { WeaveStoreStandalone } from "@inditextech/weave-store-standalone/client";
import type { WeaveStateElement } from "@inditextech/weave-types";
import {
  buildProjection,
  fitZoom,
  SELECTION_OVERLAY_ID,
  type ProjectedElement,
} from "./projection";
import { canvasChrome } from "./tokens";
import type { CanonicalDocument } from "./types";

export type CanvasStatus =
  { state: "starting" } | { state: "ready" } | { state: "error"; message: string };

interface Props {
  document: CanonicalDocument | null;
  pageId: string | null;
  layerId: string | null;
  selection: string | null;
  zoom: number;
  fitRequest: number;
  onSelect: (nodeId: string | null) => void;
  onZoomChange: (zoom: number) => void;
  onStatusChange?: (status: CanvasStatus) => void;
}

const PADDING = 48;

function toWeave(element: ProjectedElement): WeaveStateElement {
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
  return { ...base, props: { ...base.props, id: element.id, ...element.props } };
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
  onSelect,
  onZoomChange,
  onStatusChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Weave | null>(null);
  const [status, setStatus] = useState<CanvasStatus>({ state: "starting" });
  const [attempt, setAttempt] = useState(0);
  const projection = useMemo(() => buildProjection(doc, pageId, layerId), [doc, pageId, layerId]);
  // Pages already auto-fitted in this workspace; later zoom changes are the user's.
  const fittedPages = useRef(new Set<string>());

  // Latest values for callbacks that must not recreate the renderer.
  const latest = useRef({ onSelect, onZoomChange, onStatusChange, zoom, selection, projection });
  latest.current = { onSelect, onZoomChange, onStatusChange, zoom, selection, projection };

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
    let disposed = false;
    report({ state: "starting" });
    const chrome = canvasChrome();
    const ids = new Set(projection.nodeIds);
    const selected = latest.current.selection;
    const initialGeometry = selected && ids.has(selected) ? geometryOfProjection(selected) : null;

    function geometryOfProjection(nodeId: string) {
      const found = projection.elements.find((e) => e.kind === "rectangle" && e.id === nodeId);
      return found && found.kind === "rectangle" ? found.props : null;
    }

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
                ...projection.elements.map(toWeave),
                overlayState(initialGeometry, chrome.selection),
              ];
              root.set("props", WeaveStateManipulation.mapValueToYjs(stage.props));
            });
          },
        },
        {
          getUser: () => ({
            id: "demo-viewer",
            name: "Demo projection",
            email: "projection@peercanvas.invalid",
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
            new WeaveRectangleNode({ config: { label: { engine: "native" } } }),
            new WeaveArrowNode(),
          ],
          plugins: [new WeaveStageResizePlugin()],
          actions: [],
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

    let ready = false;
    const markReady = () => {
      if (disposed || ready) return;
      ready = true;
      const stage = instance.getStage();
      stage.on("click.peercanvas tap.peercanvas", onPointer as never);
      applyView();
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
      instanceRef.current = null;
      instance.removeEventListener("onRender", markReady);
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
  }, [projection, attempt]);

  // Selection overlay: renderer-only highlight derived from the transient UI selection.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || status.state !== "ready") return;
    const geometry = geometryOf(selection);
    try {
      instance.updateNode(overlayState(geometry, canvasChrome().selection));
    } catch {
      // Overlay is cosmetic; the outline panel remains the accessible selection source.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, status.state, projection]);

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
