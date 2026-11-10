// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0
// Modified for PeerCanvas: isolated in-memory native compatibility fixture.

import { useEffect, useRef, useState } from "react";
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

declare global {
  interface Window {
    __PEERCANVAS_NATIVE_SMOKE__?: { snapshot: () => unknown };
  }
}

const nodeIds = ["fixture-a", "fixture-b"] as const;

function rectangle(id: string, x: number, fill: string): WeaveStateElement {
  const node = WeaveRectangleNode.defaultState(id);
  return {
    ...node,
    props: {
      ...node.props,
      x,
      y: 140,
      width: 160,
      height: 120,
      fill,
      stroke: "#172033",
      strokeWidth: 2,
    },
  };
}

export default function NativeSmokeCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Starting native fixture…");

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let ready = false;
    let failure: string | null = null;
    const errors: string[] = [];
    const pointerEvents: Array<Pick<PointerEvent, "type" | "button" | "buttons">> = [];
    const selection = new WeaveNodesSelectionPlugin();
    const store = new WeaveStoreStandalone(
      {
        roomData: undefined,
        initialState: (doc) => {
          doc.transact(() => {
            defaultInitialState(doc);
            const root = doc.getMap("weave");
            const stage = root.toJSON() as WeaveStateElement;
            if (
              stage.key !== "stage" ||
              stage.type !== "stage" ||
              !Array.isArray(stage.props.children)
            ) {
              throw new Error("Unexpected Weave initial stage shape");
            }
            const mainLayer = (stage.props.children as WeaveStateElement[]).find(
              (layer) => layer.key === "mainLayer",
            );
            if (!mainLayer) throw new Error("Weave initial state has no main layer");
            mainLayer.props.children = [
              {
                key: "fixture-connector",
                type: "arrow",
                props: {
                  id: "fixture-connector",
                  nodeType: "arrow",
                  x: 0,
                  y: 0,
                  points: [310, 200, 490, 200],
                  stroke: "#172033",
                  fill: "#172033",
                  strokeWidth: 6,
                  pointerLength: 14,
                  pointerWidth: 14,
                  rotation: 0,
                  scaleX: 1,
                  scaleY: 1,
                },
              },
              rectangle(nodeIds[0], 140, "#2563eb"),
              rectangle(nodeIds[1], 500, "#10b981"),
            ];
            root.set("props", WeaveStateManipulation.mapValueToYjs(stage.props));
          });
        },
      },
      {
        getUser: () => ({
          id: "native-fixture",
          name: "Local fixture",
          email: "fixture@peercanvas.invalid",
        }),
      },
    );
    const instance = new Weave(
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
        plugins: [selection, new WeaveStageResizePlugin()],
        actions: [new WeaveSelectionToolAction()],
        fonts: [],
        logger: { level: "error" },
      },
      {
        container: element,
        width: element.clientWidth,
        height: element.clientHeight,
      },
    );

    const fail = (error: unknown) => {
      failure = error instanceof Error ? error.message : String(error);
      errors.push(failure);
      setStatus(`Fixture failed: ${failure}`);
    };
    const onError = (event: ErrorEvent) => fail(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => fail(event.reason);
    const onPointer = ({ type, button, buttons }: PointerEvent) => {
      if (pointerEvents.length < 50) pointerEvents.push({ type, button, buttons });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointermove", onPointer, true);
    window.addEventListener("pointerup", onPointer, true);

    instance.addEventListener("onRender", () => {
      if (!ready && selection.isInitialized() && instance.getStage().findOne(`#${nodeIds[0]}`)) {
        instance.triggerAction("selectionTool");
        element.tabIndex = 0;
        ready = true;
        setStatus("Native fixture ready. Changes remain in memory.");
      }
    });

    window.__PEERCANVAS_NATIVE_SMOKE__ = {
      snapshot: () => {
        if (!ready)
          return {
            ready,
            error: failure,
            errors,
            inputIsolation: window.__PEERCANVAS_NATIVE_INPUT_ISOLATION__,
            initialization: {
              status: instance.getStatus(),
              selectionInitialized: selection.isInitialized(),
              canvasCount: element.querySelectorAll("canvas").length,
              modelPresent: store.getDocument().getMap("weave").size > 0,
              visibility: document.visibilityState,
              focused: document.hasFocus(),
            },
          };
        const bounds = element.getBoundingClientRect();
        const nodes = Object.fromEntries(
          nodeIds.map((id) => {
            const props = instance.getNode(id).node?.props;
            return [
              id,
              props
                ? {
                    x: props.x,
                    y: props.y,
                    width: props.width,
                    height: props.height,
                    rotation: props.rotation,
                  }
                : null,
            ];
          }),
        );
        const pixelAt = (x: number, y: number) =>
          Array.from(element.querySelectorAll("canvas")).map((canvas) => {
            const rect = canvas.getBoundingClientRect();
            const px = Math.floor(((bounds.left + x - rect.left) * canvas.width) / rect.width);
            const py = Math.floor(((bounds.top + y - rect.top) * canvas.height) / rect.height);
            const context = canvas.getContext("2d");
            return context && px >= 0 && py >= 0 && px < canvas.width && py < canvas.height
              ? Array.from(context.getImageData(px, py, 1, 1).data)
              : [];
          });
        const first = nodes[nodeIds[0]];
        const rendered = instance.getStage().findOne(`#${nodeIds[0]}`);
        const nodeBounds = rendered?.getClientRect();
        const anchor = selection.getTransformer().findOne(".bottom-right");
        const anchorPosition = anchor?.getAbsolutePosition();
        return {
          ready,
          error: failure,
          errors,
          pointerEvents,
          inputIsolation: window.__PEERCANVAS_NATIVE_INPUT_ISOLATION__,
          devicePixelRatio: window.devicePixelRatio,
          selection: selection.getSelectedNodes().map((node) => node.id()),
          nodes,
          connector: instance.getNode("fixture-connector").node?.props.points,
          targets: {
            node: nodeBounds
              ? {
                  x: bounds.left + nodeBounds.x + nodeBounds.width / 2,
                  y: bounds.top + nodeBounds.y + nodeBounds.height / 2,
                }
              : null,
            resize: anchorPosition
              ? { x: bounds.left + anchorPosition.x, y: bounds.top + anchorPosition.y }
              : null,
          },
          pixels: {
            node: first ? pixelAt(first.x + first.width / 2, first.y + first.height / 2) : [],
            connector: pixelAt(450, 200),
          },
          resources: performance.getEntriesByType("resource").map((entry) => entry.name),
        };
      },
    };

    void instance.start().catch(fail);
    return () => {
      delete window.__PEERCANVAS_NATIVE_SMOKE__;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("pointerup", onPointer, true);
      void instance.destroy();
    };
  }, []);

  return (
    <main>
      <header>
        <h1>Native canvas compatibility probe</h1>
        <p id="fixture-help">
          Automated WebDriver fixture: two nodes and one connector. Physical pointer input is
          isolated; changes remain in memory.
        </p>
        <p role="status">{status}</p>
      </header>
      <div
        id="weave"
        ref={container}
        role="region"
        aria-label="Native compatibility canvas"
        aria-describedby="fixture-help"
        tabIndex={0}
      />
    </main>
  );
}
