// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0
// Modified for PeerCanvas: the Weave setup (in-memory WeaveStoreStandalone, Konva base
// renderer, stage/layer/group/rectangle/arrow nodes, initial-state injection) is derived
// from src/native-smoke/NativeSmokeCanvas.tsx, itself adapted from Weave.js examples.
// This adapter renders a disposable projection of the canonical demo document. It reports
// selection and submits node moves through `onMoveNode`; it never owns or writes semantic data.
//
// Viewport: a native scroll container whose only sized child is an extent spacer computed from
// content bounds × zoom (never from measurements, so scrollbars cannot feed back into it). A
// React-owned wrapper is `position: sticky` at the scrollport size; the SDK receives a separate
// inner container (which it restyles), so the SDK can never override the sticky positioning. The
// Konva stage stays viewport-sized at any zoom and is translated by the scroll offset. The adapter
// owns its ResizeObserver instead of the SDK resize plugin, whose observer cannot be disconnected.
// Scroll/pan is transient UI state: it issues no command and never touches the document.
//
// Dragging: an editor's press on a node of the active layer becomes a drag after 3 CSS px of
// travel (viewers get no preview). Positions are the exact canonical origin plus the exact
// inverse-stage world travel, unrounded. The preview moves rendered Konva nodes only (never the
// Weave store). Release submits exactly one `onMoveNode` request; rejection, net-zero travel and
// every cancellation (including focus leaving the canvas region) restore the canonical rendering.
// An accepted move arrives back as a new canonical snapshot and replaces the renderer.
//
// Lifecycle: renderer start/destroy run through one serialized queue (see `lifecycle`), so a
// pending start can never outlive its disposal and a replacement never starts during teardown.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Weave,
  WeaveArrowNode,
  WeaveGroupNode,
  WeaveLayerNode,
  WeaveRectangleNode,
  WeaveStageNode,
  WeaveStateManipulation,
  defaultInitialState,
} from "@inditextech/weave-sdk";
import { WeaveKonvaBaseRenderer } from "@inditextech/weave-renderer-konva-base";
import { WeaveStoreStandalone } from "@inditextech/weave-store-standalone/client";
import type { WeaveStateElement } from "@inditextech/weave-types";
import {
  anchoredScroll,
  buildProjection,
  dragPosition,
  exceedsDragThreshold,
  fitZoom,
  previewConnections,
  revealScroll,
  scrollExtent,
  SELECTION_OVERLAY_ID,
  stageOffset,
  toWorld,
  type ProjectedElement,
  type Projection,
} from "./projection";
import { canvasChrome } from "./tokens";
import type { CanonicalDocument } from "./types";

export type CanvasStatus =
  { state: "starting" } | { state: "ready" } | { state: "error"; message: string };

/** Agreed move request; the service validates identity, context, role and revision. */
export interface MoveNodeInput {
  documentId: string;
  pageId: string;
  layerId: string;
  nodeId: string;
  x: number;
  y: number;
  expectedRevision: number;
}

interface Props {
  document: CanonicalDocument | null;
  pageId: string | null;
  layerId: string | null;
  selection: string | null;
  revision: number;
  role: "editor" | "viewer";
  zoom: number;
  fitRequest: number;
  onSelect: (nodeId: string | null) => void;
  onZoomChange: (zoom: number) => void;
  /** Called once per completed drag; returns whether the canonical command was accepted. */
  onMoveNode: (input: MoveNodeInput) => boolean;
  onStatusChange?: (status: CanvasStatus) => void;
}

export type PanDirection = "left" | "right" | "up" | "down";

/** Transient viewport controls for keyboard panning; never a document mutation. */
export interface CanvasViewportHandle {
  /** Scrolls the viewport. Returns false when already at that edge (nothing moved). */
  pan: (direction: PanDirection, large?: boolean) => boolean;
}

const PADDING = 48;
const PAN_STEP = 64;
const OVERLAY_INSET = 6;

type Point = { x: number; y: number };
type KonvaLike = { id: () => string; getParent: () => unknown };
type PreviewNode = KonvaLike & {
  position: (value: Point) => unknown;
  points: (value: number[]) => unknown;
};
/** The small part of the Konva stage API this adapter uses (structural, no Konva import). */
interface StageLike {
  on: (names: string, handler: never) => unknown;
  off: (names: string) => unknown;
  scale: (value: Point) => unknown;
  position: (value?: Point) => Point;
  scaleX: () => number;
  width: (value: number) => unknown;
  height: (value: number) => unknown;
  batchDraw: () => unknown;
  getIntersection: (point: Point) => KonvaLike | null;
  findOne: (selector: (node: KonvaLike) => boolean) => PreviewNode | undefined;
}

const stageOf = (instance: Weave | null | undefined): StageLike | null =>
  (instance?.getStage?.() as unknown as StageLike | undefined) ?? null;

/**
 * Renderer lifecycle queue shared by every adapter instance (the SDK state it protects is
 * process-global). The pinned SDK's destroy() resets globalThis.Konva and the Yjs import marker,
 * and a destroy() that runs before start() reaches initStage/store.connect cannot release the
 * stage and connection that start() creates afterwards. So each start() waits for every earlier
 * teardown, each teardown waits for its own start() to settle, and the two never overlap.
 */
let lifecycle: Promise<unknown> = Promise.resolve();
function enqueueLifecycle<T>(step: () => T | Promise<T>): Promise<T> {
  const next = lifecycle.then(step);
  lifecycle = next.catch(() => undefined);
  return next;
}

/** Transient pointer gesture; never document state. */
interface Gesture {
  pointerId: number;
  captureTarget: HTMLElement;
  /** Focus region of the gesture; focus moving anywhere outside it cancels the drag. */
  focusScope: HTMLElement;
  instance: Weave;
  projection: Projection;
  nodeId: string;
  origin: Point;
  startClient: Point;
  startWorld: Point;
  /** Stage container origin and transform at press; any scroll/zoom/resize cancels the drag. */
  frame: { left: number; top: number; x: number; y: number; scale: number };
  context: {
    documentId: string;
    pageId: string;
    layerId: string;
    revision: number;
    role: Props["role"];
    zoom: number;
  };
  dragging: boolean;
  captured: boolean;
  preview: Point | null;
}

function toWeave(element: ProjectedElement): WeaveStateElement {
  if (element.kind === "arrow") {
    const base = WeaveArrowNode.defaultState(element.id);
    // WeaveArrowNode has no defaultState of its own: it inherits type/nodeType "unknown",
    // which the renderer silently skips. Declare the arrow type explicitly.
    return {
      ...base,
      type: "arrow",
      props: {
        ...base.props,
        id: element.id,
        nodeType: "arrow",
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
      x: (geometry?.x ?? 0) - OVERLAY_INSET,
      y: (geometry?.y ?? 0) - OVERLAY_INSET,
      width: (geometry?.width ?? 1) + OVERLAY_INSET * 2,
      height: (geometry?.height ?? 1) + OVERLAY_INSET * 2,
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

/**
 * The keyboard focus region that owns the canvas: the nearest tab-stop ancestor of the adapter
 * (the labelled canvas region in the workspace). Null when the adapter is not inside one.
 */
const focusScopeOf = (hostElement: HTMLElement | null) =>
  hostElement?.parentElement?.closest<HTMLElement>('[tabindex]:not([tabindex="-1"])') ?? null;

const findById = (stage: StageLike, id: string) => stage.findOne((node) => node.id() === id);

/**
 * Moves rendered nodes only: the dragged node, touching connections and, when it outlines this
 * node, the selection overlay. Never writes the Weave store.
 */
function paintPreview(stage: StageLike, gesture: Gesture, position: Point, outlined: boolean) {
  findById(stage, gesture.nodeId)?.position(position);
  if (outlined)
    findById(stage, SELECTION_OVERLAY_ID)?.position({
      x: position.x - OVERLAY_INSET,
      y: position.y - OVERLAY_INSET,
    });
  for (const link of previewConnections(gesture.projection, gesture.nodeId, position))
    findById(stage, link.id)?.points(link.points);
  stage.batchDraw();
}

const WeaveCanvas = forwardRef<CanvasViewportHandle, Props>(function WeaveCanvas(
  {
    document: doc,
    pageId,
    layerId,
    selection,
    revision,
    role,
    zoom,
    fitRequest,
    onSelect,
    onZoomChange,
    onMoveNode,
    onStatusChange,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Sticky, React-owned viewport frame. The SDK never receives or restyles it.
  const frame = useRef<HTMLDivElement>(null);
  // SDK-owned container: Weave sets inline styles (position: relative) on it.
  const container = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Weave | null>(null);
  // The instance whose first render completed; only it accepts pointer gestures.
  const readyRef = useRef<Weave | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [status, setStatus] = useState<CanvasStatus>({ state: "starting" });
  const [attempt, setAttempt] = useState(0);
  const projection = useMemo(() => buildProjection(doc, pageId, layerId), [doc, pageId, layerId]);
  const extent = scrollExtent(projection.bounds, zoom, PADDING);
  // Pages already auto-fitted in this workspace; later zoom changes are the user's.
  const fittedPages = useRef(new Set<string>());
  // Last viewport actually applied: the zoom anchor must use the pre-change scroll, because the
  // browser may already have clamped scrollLeft/Top when a smaller extent was committed.
  const view = useRef({ zoom, left: 0, top: 0 });

  // Latest values for callbacks that must not recreate the renderer.
  const latest = useRef({
    onSelect,
    onZoomChange,
    onMoveNode,
    onStatusChange,
    zoom,
    selection,
    projection,
    doc,
    pageId,
    layerId,
    revision,
    role,
  });
  latest.current = {
    onSelect,
    onZoomChange,
    onMoveNode,
    onStatusChange,
    zoom,
    selection,
    projection,
    doc,
    pageId,
    layerId,
    revision,
    role,
  };

  /** Places the stage for the current zoom and scroll. No React state; safe on every scroll. */
  const applyView = useCallback(() => {
    const element = scroller.current;
    const left = element?.scrollLeft ?? 0;
    const top = element?.scrollTop ?? 0;
    view.current = { zoom: latest.current.zoom, left, top };
    // A replacement instance has no stage until it renders; markReady applies the view later.
    const stage = stageOf(instanceRef.current);
    if (!stage) return;
    const z = latest.current.zoom;
    stage.scale({ x: z, y: z });
    stage.position(stageOffset(latest.current.projection.bounds, z, PADDING, { left, top }));
    stage.batchDraw();
  }, []);

  /** Sizes the stage to the sticky frame (the SDK container's parent), then re-places it. */
  const sizeStage = useCallback(() => {
    const stage = stageOf(instanceRef.current);
    const element = frame.current;
    if (stage && element) {
      stage.width(Math.max(1, element.clientWidth));
      stage.height(Math.max(1, element.clientHeight));
    }
    applyView();
  }, [applyView]);

  /**
   * Ends the gesture exactly once. The gesture is detached before pointer capture is released,
   * so the resulting lostpointercapture cannot cancel or commit again.
   */
  const detachGesture = useCallback((): Gesture | null => {
    const gesture = gestureRef.current;
    if (!gesture) return null;
    gestureRef.current = null;
    // The element captured at drag start: on unmount the React ref is already detached.
    const element = gesture.captureTarget;
    if (gesture.captured && element.hasPointerCapture?.(gesture.pointerId)) {
      try {
        element.releasePointerCapture(gesture.pointerId);
      } catch {
        // Capture already gone (pointer removed); nothing to release.
      }
    }
    return gesture;
  }, []);

  /** Restores the canonical rendering of a discarded preview on its own renderer instance. */
  const restorePreview = useCallback((gesture: Gesture) => {
    if (!gesture.dragging || !gesture.preview) return;
    if (instanceRef.current !== gesture.instance) return; // replaced: rendered from canon anyway
    const stage = stageOf(gesture.instance);
    const outlined = latest.current.selection === gesture.nodeId;
    if (stage) paintPreview(stage, gesture, gesture.origin, outlined);
  }, []);

  /** Discards any in-progress gesture without issuing a command. Safe to call at any time. */
  const cancelGesture = useCallback(() => {
    const gesture = detachGesture();
    if (gesture) restorePreview(gesture);
  }, [detachGesture, restorePreview]);

  const scrollTo = useCallback(
    (target: { left: number; top: number }) => {
      const element = scroller.current;
      if (!element) return;
      element.scrollLeft = target.left;
      element.scrollTop = target.top;
      applyView();
    },
    [applyView],
  );

  useImperativeHandle(
    ref,
    () => ({
      pan(direction, large = false) {
        const element = scroller.current;
        if (!element) return false;
        const horizontal = direction === "left" || direction === "right";
        const sign = direction === "left" || direction === "up" ? -1 : 1;
        const page = horizontal ? element.clientWidth : element.clientHeight;
        const step = large ? Math.max(PAN_STEP, Math.round(page * 0.8)) : PAN_STEP;
        const before = { left: element.scrollLeft, top: element.scrollTop };
        scrollTo({
          left: before.left + (horizontal ? sign * step : 0),
          top: before.top + (horizontal ? 0 : sign * step),
        });
        const moved = element.scrollLeft !== before.left || element.scrollTop !== before.top;
        if (moved) cancelGesture();
        return moved;
      },
    }),
    [scrollTo, cancelGesture],
  );

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

    let store: WeaveStoreStandalone | null = null;
    let instance: Weave;
    try {
      store = new WeaveStoreStandalone(
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
          // No WeaveStageResizePlugin: its ResizeObserver is never disconnected. The adapter
          // observes the sticky frame itself (see the resize effect below).
          plugins: [],
          actions: [],
          fonts: [],
          logger: { level: "error" },
        },
        {
          container: element,
          width: Math.max(1, frame.current?.clientWidth ?? element.clientWidth),
          height: Math.max(1, frame.current?.clientHeight ?? element.clientHeight),
        },
      );
    } catch (error) {
      // Partial initialization: the store was never connected, but release it defensively.
      void enqueueLifecycle(() => store?.disconnect?.()).catch(() => undefined);
      report({ state: "error", message: error instanceof Error ? error.message : String(error) });
      return;
    }

    const onPointer = (event: { target: KonvaLike }) => {
      if (disposed) return;
      let node: KonvaLike | null = event.target;
      const stage = instance.getStage();
      while (node && (node as unknown) !== stage) {
        const id = node.id();
        if (ids.has(id)) {
          latest.current.onSelect(id);
          return;
        }
        node = node.getParent() as KonvaLike | null;
      }
      latest.current.onSelect(null);
    };

    let ready = false;
    const markReady = () => {
      if (disposed || ready) return;
      ready = true;
      const stage = stageOf(instance);
      stage?.on("click.peercanvas tap.peercanvas", onPointer as never);
      readyRef.current = instance;
      sizeStage();
      report({ state: "ready" });
    };
    instance.addEventListener("onRender", markReady);
    instanceRef.current = instance;

    // Whether start() was invoked; only then does the SDK own a stage/connection to destroy.
    let started = false;
    let released = false;
    /** Releases this instance exactly once, after its own start() settles (see lifecycle). */
    const release = () => {
      if (released) return;
      released = true;
      instance.removeEventListener("onRender", markReady);
      try {
        stageOf(instance)?.off("click.peercanvas tap.peercanvas");
      } catch {
        // Stage may not exist if start() never completed.
      }
      void enqueueLifecycle(() =>
        // Never started: no stage or connection exists; release the unconnected store only.
        started ? instance.destroy() : store?.disconnect?.(),
      ).catch(() => undefined);
    };

    enqueueLifecycle(() => {
      if (disposed) return; // unmounted/replaced before its turn: never start it
      started = true;
      return instance.start();
    })
      // markReady ignores a start that settles after disposal: no listeners, no ready state.
      .then(markReady)
      .catch((error: unknown) => {
        if (disposed) return;
        // A failed start still owns a store, listeners and possibly a stage: release them now
        // rather than waiting for retry or unmount.
        disposed = true;
        if (instanceRef.current === instance) instanceRef.current = null;
        if (readyRef.current === instance) readyRef.current = null;
        release();
        report({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      if (gestureRef.current?.instance === instance) cancelGesture();
      if (readyRef.current === instance) readyRef.current = null;
      if (instanceRef.current === instance) instanceRef.current = null;
      if (disposed) return; // already released after a failed start
      disposed = true;
      release();
    };
    // `latest` carries callbacks/zoom/selection; recreation is keyed by projection inputs.
    // `sizeStage` and `cancelGesture` are stable (they read refs), so they never recreate it.
  }, [projection, attempt, sizeStage, cancelGesture]);

  // Owned size observation of the sticky frame: resizes the stage and cancels a drag whose
  // stage geometry is no longer valid. Disconnected on unmount; never duplicated per renderer.
  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let last = { width: element.clientWidth, height: element.clientHeight };
    const observer = new ResizeObserver(() => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      if (next.width === last.width && next.height === last.height) return;
      last = next;
      cancelGesture();
      sizeStage();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [sizeStage, cancelGesture]);

  // Pointer dragging. Listeners are registered once and are no-ops without a gesture.
  useEffect(() => {
    const element = frame.current;
    const sdkContainer = container.current;
    if (!element || !sdkContainer) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary || gestureRef.current) return;
      const instance = instanceRef.current;
      const stage = stageOf(instance);
      if (!instance || !stage || readyRef.current !== instance) return;
      const current = latest.current;
      if (!current.doc || !current.pageId || !current.layerId) return;
      // Viewers get no movement preview at all (the service also rejects their moves); a plain
      // click still selects through the renderer's own handler.
      if (current.role !== "editor") return;
      const rect = sdkContainer.getBoundingClientRect();
      const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      // Walk from the hit shape up to its projected node group.
      const ids = new Set(current.projection.nodeIds);
      let node: KonvaLike | null = stage.getIntersection(local);
      while (node && (node as unknown) !== stage && !ids.has(node.id()))
        node = node.getParent() as KonvaLike | null;
      if (!node || (node as unknown) === stage) return;
      const nodeId = node.id();
      const target = current.projection.elements.find(
        (candidate) => candidate.kind === "rectangle" && candidate.nodeId === nodeId,
      );
      // Nodes on other (dimmed) layers are click-to-select only; selecting activates their layer.
      if (!target || target.kind !== "rectangle" || target.layerId !== current.layerId) return;
      const position = stage.position();
      const transform = { x: position.x, y: position.y, scale: stage.scaleX() || 1 };
      // Establish canvas focus before the gesture exists, so focus leaving the canvas region
      // later (Tab, a click on another control, a programmatic focus) is detectable. Focus that
      // is already inside the region (e.g. the viewport) is kept; keyboard access is unchanged.
      const focusScope = focusScopeOf(host.current) ?? scroller.current ?? element;
      if (!focusScope.contains(document.activeElement)) focusScope.focus({ preventScroll: true });
      gestureRef.current = {
        pointerId: event.pointerId,
        captureTarget: element,
        focusScope,
        instance,
        projection: current.projection,
        nodeId,
        origin: { x: target.props.x, y: target.props.y },
        startClient: { x: event.clientX, y: event.clientY },
        startWorld: toWorld(local, transform),
        frame: { left: rect.left, top: rect.top, ...transform },
        context: {
          documentId: current.doc.documentId,
          pageId: current.pageId,
          layerId: current.layerId,
          revision: current.revision,
          role: current.role,
          zoom: current.zoom,
        },
        dragging: false,
        captured: false,
        preview: null,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const stage = stageOf(gesture.instance);
      if (!stage || instanceRef.current !== gesture.instance) return cancelGesture();
      if (!gesture.dragging) {
        const dx = event.clientX - gesture.startClient.x;
        const dy = event.clientY - gesture.startClient.y;
        if (!exceedsDragThreshold(dx, dy)) return;
        gesture.dragging = true;
        // Capture only once it is a drag, so a plain click keeps the renderer's own selection.
        try {
          gesture.captureTarget.setPointerCapture?.(event.pointerId);
          gesture.captured = gesture.captureTarget.hasPointerCapture?.(event.pointerId) ?? false;
        } catch {
          gesture.captured = false;
        }
        // Keep the inspector coherent: the dragged node becomes the selection (same layer).
        if (latest.current.selection !== gesture.nodeId) latest.current.onSelect(gesture.nodeId);
        // onSelect may synchronously invalidate the gesture (e.g. a context change).
        if (gestureRef.current !== gesture) return;
      }
      event.preventDefault();
      const world = toWorld(
        { x: event.clientX - gesture.frame.left, y: event.clientY - gesture.frame.top },
        gesture.frame,
      );
      const next = dragPosition(gesture.origin, gesture.startWorld, world);
      if (gesture.preview && gesture.preview.x === next.x && gesture.preview.y === next.y) return;
      gesture.preview = next;
      // Until the new selection commits, the overlay effect places the outline (at the preview).
      paintPreview(stage, gesture, next, latest.current.selection === gesture.nodeId);
    };

    const onPointerUp = (event: PointerEvent) => {
      const current = gestureRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const gesture = detachGesture();
      if (!gesture || !gesture.dragging) return; // a click: the renderer handler selects
      const position = gesture.preview;
      const { context } = gesture;
      const now = latest.current;
      const stillCurrent =
        instanceRef.current === gesture.instance &&
        now.doc?.documentId === context.documentId &&
        now.pageId === context.pageId &&
        now.layerId === context.layerId &&
        now.revision === context.revision &&
        now.role === context.role &&
        now.zoom === context.zoom;
      if (
        !position ||
        !stillCurrent ||
        (position.x === gesture.origin.x && position.y === gesture.origin.y)
      ) {
        restorePreview(gesture); // net-zero or stale: no command, no revision, no history
        return;
      }
      const accepted = now.onMoveNode({
        documentId: context.documentId,
        pageId: context.pageId,
        layerId: context.layerId,
        nodeId: gesture.nodeId,
        x: position.x,
        y: position.y,
        expectedRevision: context.revision,
      });
      // Accepted: the new canonical snapshot replaces the renderer. Rejected: show canon again.
      if (!accepted) restorePreview(gesture);
    };

    const onLostCapture = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (gesture && gesture.captured && event.pointerId === gesture.pointerId) cancelGesture();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (gestureRef.current?.pointerId === event.pointerId) cancelGesture();
    };

    // Capture phase on window: runs before the canvas region's Escape (clear selection), so
    // cancelling a drag keeps the selection.
    const onKeyDown = (event: KeyboardEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.key !== "Escape") return;
      if (gesture.dragging) {
        event.preventDefault();
        event.stopPropagation();
      }
      cancelGesture();
    };

    const onBlur = () => cancelGesture();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancelGesture();
    };
    // Focus transfer within the document (Tab, another control, programmatic focus): window blur
    // never fires for these. Focus arriving outside the gesture's region cancels synchronously.
    const onFocusIn = (event: FocusEvent) => {
      const gesture = gestureRef.current;
      if (gesture && !gesture.focusScope.contains(event.target as Node | null)) cancelGesture();
    };
    // Focus dropped to no element (focused control removed or blurred): focusin never fires, so
    // check where focus settled once the transition completes. Moves within the region are kept;
    // a whole-window blur leaves activeElement in place and is handled by onBlur.
    const onFocusOut = (event: FocusEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || !gesture.focusScope.contains(event.target as Node | null)) return;
      const next = event.relatedTarget as Node | null;
      if (next && gesture.focusScope.contains(next)) return;
      queueMicrotask(() => {
        if (gestureRef.current === gesture && !gesture.focusScope.contains(document.activeElement))
          cancelGesture();
      });
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("lostpointercapture", onLostCapture);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      cancelGesture();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("lostpointercapture", onLostCapture);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [cancelGesture, detachGesture, restorePreview]);

  // Any change of document, page, layer, revision, role or zoom invalidates a gesture.
  const documentId = doc?.documentId ?? null;
  useEffect(() => {
    cancelGesture();
  }, [documentId, pageId, layerId, revision, role, zoom, cancelGesture]);

  // Selection overlay: renderer-only highlight derived from the transient UI selection. During a
  // drag of the selected node it follows the preview rather than snapping back to canon.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || status.state !== "ready") return;
    const canonical = geometryOf(selection);
    const gesture = gestureRef.current;
    const geometry =
      canonical && gesture?.dragging && gesture.preview && gesture.nodeId === selection
        ? { ...canonical, ...gesture.preview }
        : canonical;
    try {
      instance.updateNode(overlayState(geometry, canvasChrome().selection));
    } catch {
      // Overlay is cosmetic; the outline panel remains the accessible selection source.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, status.state, projection]);

  // Zoom: a UI-only transform on the renderer stage. A layout effect, so the extent spacer is
  // already committed at the new size and the anchored scroll is clamped to the real range before
  // paint. The world point at the viewport centre stays put across zoom steps.
  useLayoutEffect(() => {
    const element = scroller.current;
    const previous = view.current;
    if (element && previous.zoom !== zoom && previous.zoom > 0) {
      scrollTo(
        anchoredScroll(projection.bounds, PADDING, previous, zoom, {
          width: element.clientWidth,
          height: element.clientHeight,
        }),
      );
    } else {
      applyView();
    }
  }, [zoom, status.state, projection, applyView, scrollTo]);

  // The full canvas area, unaffected by whether scrollbars are currently shown.
  const viewportSize = () => ({
    width: host.current?.clientWidth ?? 0,
    height: host.current?.clientHeight ?? 0,
  });

  // Fit to content on request.
  useEffect(() => {
    if (fitRequest === 0) return;
    const bounds = projection.bounds;
    if (!host.current || !bounds) {
      latest.current.onZoomChange(1);
      return;
    }
    const next = fitZoom(bounds, viewportSize(), PADDING);
    latest.current.onZoomChange(next ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  // Page activation starts at the top-left of the page. The first activation also fits the
  // complete content once (never magnifying beyond 100%). Purely a transient viewport change;
  // it issues no command and leaves the document clean.
  const pageKey = doc ? `${doc.documentId}:${pageId ?? ""}` : null;
  useLayoutEffect(() => {
    if (!pageKey) return;
    scrollTo({ left: 0, top: 0 });
    const size = viewportSize();
    if (fittedPages.current.has(pageKey)) return;
    if (size.width <= 0 || size.height <= 0) return; // not laid out yet
    fittedPages.current.add(pageKey);
    const next = fitZoom(projection.bounds, size, PADDING, 1);
    if (next !== null) latest.current.onZoomChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  // Keep a newly selected (or keyboard-moved) element in view. Keyed by the selected element's
  // geometry, not the scroll, so a manual pan away from the selection is never undone. Skipped
  // while that element is being dragged: it is under the pointer, and scrolling would cancel.
  const selectedGeometry = geometryOf(selection);
  const revealKey = selectedGeometry
    ? `${selection}:${selectedGeometry.x}:${selectedGeometry.y}:${selectedGeometry.width}:${selectedGeometry.height}`
    : null;
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !selectedGeometry) return;
    if (gestureRef.current?.nodeId === selection) return;
    const target = revealScroll(
      projection.bounds,
      zoom,
      PADDING,
      selectedGeometry,
      { left: element.scrollLeft, top: element.scrollTop },
      { width: element.clientWidth, height: element.clientHeight },
    );
    if (target) scrollTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  const onScroll = () => {
    const element = scroller.current;
    // A real scroll invalidates the drag's stage transform; a no-op scroll event does not.
    if (
      element &&
      (element.scrollLeft !== view.current.left || element.scrollTop !== view.current.top)
    )
      cancelGesture();
    applyView();
  };

  return (
    <div ref={host} className="pc-canvas-host">
      <div
        ref={scroller}
        className="pc-canvas-scroll"
        data-testid="canvas-viewport"
        // Not a separate tab stop: the labelled canvas region owns focus and Alt+arrow panning.
        tabIndex={-1}
        onScroll={onScroll}
      >
        <div
          className="pc-canvas-extent"
          data-testid="canvas-extent"
          aria-hidden="true"
          style={{ width: extent.width, height: extent.height }}
        />
        <div ref={frame} className="pc-weave" data-testid="weave-frame">
          <div
            ref={container}
            data-testid="weave-container"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
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
});

export default WeaveCanvas;
