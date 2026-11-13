// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0
// Modified for PeerCanvas: isolated in-memory native compatibility fixture.

import { useEffect, useRef, useState } from "react";
import { getRelaySockets as getMqttRelaySockets } from "@trystero-p2p/mqtt";
import {
  getRelaySockets as getWebSocketRelaySockets,
  joinRoom as joinWebSocketRelay,
  selfId as webSocketRelaySelfId,
} from "@trystero-p2p/ws-relay";
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
import { createTrysteroPeerTransport } from "../collaboration/trystero-peer-transport";
import type { RoomFactory } from "../collaboration/trystero-peer-transport";
import { PeerDocumentSession } from "../collaboration/peer-document-session";
import type { PeerNetworkDiagnostic, PeerTransportError } from "../collaboration/types";
import {
  installNativeIceDiagnostics,
  readNativeIceDiagnostics,
  type NativeIceDiagnostic,
} from "./ice-diagnostics";
import { serializeDocument, type ModelState } from "../document";
import { createSample } from "../editor/sample";
import type {
  NativePeerApi,
  NativePeerConnectionOptions,
  NativePeerDebug,
  NativePeerSnapshot,
} from "./NativeSmokePeer";

type PeerSmokeSummary = {
  status: string;
  revision: number | null;
  peerCount: number;
  readyPeerCount: number;
  document: string | null;
  error: string | null;
};

type PeerSmokeReport = {
  initial: {
    host: PeerSmokeSummary;
    peer: NativePeerSnapshot;
    sameDocument: boolean;
    normalizedMessages: { host: number; peer: number };
  };
  afterEdit: {
    reply: unknown;
    host: PeerSmokeSummary;
    peer: NativePeerSnapshot;
    sameDocument: boolean;
    hostLinks: PeerLinkSummary[];
    peerLinks: PeerLinkSummary[];
  };
  afterReconnect: { host: PeerSmokeSummary; peer: NativePeerSnapshot; sameDocument: boolean };
  afterHostLoss: { peer: NativePeerSnapshot; retainedDocument: boolean };
};

type PeerSmokeInitial = PeerSmokeReport["initial"];
type PeerLinkSummary = Omit<PeerNetworkDiagnostic, "peerId">;

declare global {
  interface Window {
    __PEERCANVAS_NATIVE_SMOKE__?: {
      snapshot: () => unknown;
      startPeerTest: (relayUrl: string, rtcConfig?: RTCConfiguration) => Promise<PeerSmokeInitial>;
      submitPeerEdit: () => Promise<PeerSmokeReport["afterEdit"]>;
      reconnectPeer: () => Promise<PeerSmokeReport["afterReconnect"]>;
      stopHost: () => Promise<PeerSmokeReport["afterHostLoss"]>;
      closePeerTest: () => Promise<void>;
    };
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

class NativePeerSmokeHarness {
  private hostTransport: Awaited<ReturnType<typeof createTrysteroPeerTransport>> | null = null;
  private hostTransportErrors: PeerTransportError[] = [];
  private hostSession: PeerDocumentSession | null = null;
  private peerFrame: HTMLIFrameElement | null = null;
  private peerApi: NativePeerApi | null = null;
  private peerOptions: NativePeerConnectionOptions | null = null;

  async start(relayUrl: string, rtcConfig?: RTCConfiguration): Promise<PeerSmokeInitial> {
    await this.close();
    try {
      installNativeIceDiagnostics();
      const roomId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      this.peerOptions = { roomId, password, relayUrl, hostPeerId: "", rtcConfig };
      const localRelayOptions =
        relayUrl === "public"
          ? {}
          : {
              peerId: webSocketRelaySelfId,
              relayUrls: [relayUrl],
              joinRoom: joinWebSocketRelay as unknown as RoomFactory,
            };
      this.hostTransport = await createTrysteroPeerTransport({
        roomId,
        password,
        ...localRelayOptions,
        ...(rtcConfig ? { rtcConfig } : {}),
      });
      this.hostTransportErrors = [];
      this.hostTransport.onError((error) => this.hostTransportErrors.push(error));
      this.peerOptions.hostPeerId = this.hostTransport.peerId;
      this.hostSession = new PeerDocumentSession({
        role: "host",
        initialState: createSample(),
        transport: this.hostTransport,
      });
      await this.hostSession.start();
      this.peerApi = await this.createPeerFrame();
      const peer = await this.peerApi.connect(this.peerOptions);
      const host = this.hostSummary();
      const peerDebug = await this.peerApi.debug();
      return {
        host,
        peer,
        sameDocument: host.document === peer.document,
        normalizedMessages: {
          host: countNormalizedMessages(readNativeIceDiagnostics()),
          peer: countNormalizedMessages(peerDebug.ice),
        },
      };
    } catch (error) {
      const hostSnapshot = this.hostSession?.getSnapshot();
      const peerDebug = await this.peerApi?.debug().catch(() => null);
      const diagnostics = {
        hostStatus: hostSnapshot?.status ?? null,
        hostError: hostSnapshot?.error ?? null,
        hostTransportPeerCount: this.hostTransport?.getPeerIds().length ?? 0,
        hostErrors: [...this.hostTransportErrors],
        hostIce: readNativeIceDiagnostics(),
        hostNetwork: summarizeLinks((await this.hostTransport?.getNetworkDiagnostics()) ?? []),
        hostSignalingSockets: Object.values(
          (this.peerOptions?.relayUrl === "public"
            ? getMqttRelaySockets()
            : getWebSocketRelaySockets()) as Record<string, WebSocket>,
        ).map((socket) => ({ readyState: socket.readyState, protocol: socket.protocol })),
        peer: peerDebug as NativePeerDebug | null,
      };
      await this.close();
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; smoke diagnostics: ${JSON.stringify(diagnostics)}`,
      );
    }
  }

  async submitPeerEdit(): Promise<PeerSmokeReport["afterEdit"]> {
    if (!this.hostSession || !this.peerApi) throw new Error("Peer smoke session is not running.");
    const state = this.hostSession.getSnapshot().model;
    const node = state?.document.pages[0].layers[0].nodes[0];
    const page = state?.document.pages[0];
    const layer = page?.layers[0];
    if (!state || !page || !layer || !node) throw new Error("Peer smoke fixture is incomplete.");
    const reply = await this.peerApi.submit({
      type: "node.update",
      pageId: page.pageId,
      layerId: layer.layerId,
      node: { ...node, geometry: { ...node.geometry, x: node.geometry.x + 24 } },
    });
    await this.waitFor(() => {
      const host = this.hostSummary();
      const peer = this.peerApi?.snapshot();
      return host.revision === peer?.revision && host.document === peer?.document;
    }, "host and peer document convergence");
    const host = this.hostSummary();
    const peer = this.peerApi.snapshot();
    return {
      reply,
      host,
      peer,
      sameDocument: host.document === peer.document,
      hostLinks: summarizeLinks((await this.hostTransport?.getNetworkDiagnostics()) ?? []),
      peerLinks: summarizeLinks(await this.peerApi.diagnostics()),
    };
  }

  async reconnectPeer(): Promise<PeerSmokeReport["afterReconnect"]> {
    if (!this.hostSession || !this.peerApi || !this.peerOptions)
      throw new Error("Peer smoke session is not running.");
    await this.peerApi.close();
    await this.waitFor(
      () => this.hostSession?.getSnapshot().readyPeerCount === 0,
      "peer disconnect cleanup",
    );
    const peer = await this.peerApi.connect(this.peerOptions);
    const host = this.hostSummary();
    return { host, peer, sameDocument: host.document === peer.document };
  }

  async stopHost(): Promise<PeerSmokeReport["afterHostLoss"]> {
    if (!this.hostSession || !this.peerApi) throw new Error("Peer smoke session is not running.");
    const savedHostSnapshot = this.documentJson(this.hostSession.getSnapshot().model);
    await this.hostSession.close();
    await this.waitFor(() => this.peerApi?.snapshot().status === "disconnected", "host-loss state");
    const peer = this.peerApi.snapshot();
    return { peer, retainedDocument: peer.document === savedHostSnapshot };
  }

  async close(): Promise<void> {
    await this.peerApi?.close().catch(() => {});
    await this.hostSession?.close().catch(() => {});
    this.peerFrame?.remove();
    this.peerApi = null;
    this.peerFrame = null;
    this.hostSession = null;
    this.hostTransport = null;
    this.peerOptions = null;
  }

  private hostSummary(): PeerSmokeSummary {
    const snapshot = this.hostSession?.getSnapshot();
    return {
      status: snapshot?.status ?? "closed",
      revision: snapshot?.model?.revision ?? null,
      peerCount: snapshot?.peerCount ?? 0,
      readyPeerCount: snapshot?.readyPeerCount ?? 0,
      document: this.documentJson(snapshot?.model ?? null),
      error: snapshot?.error ?? null,
    };
  }

  private documentJson(state: ModelState | null | undefined): string | null {
    if (!state) return null;
    const serialized = serializeDocument(state.document);
    return serialized.ok ? serialized.value : null;
  }

  private async createPeerFrame(): Promise<NativePeerApi> {
    const frame = document.createElement("iframe");
    frame.title = "Native smoke peer iframe context";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;width:1px;height:1px;left:-2px;top:-2px;opacity:0;border:0;";
    const url = new URL(window.location.href);
    url.search = "native-smoke-peer=1";
    url.hash = "";
    frame.src = url.toString();
    this.peerFrame = frame;
    document.body.append(frame);
    await this.waitFor(
      () => frame.contentWindow?.__PEERCANVAS_NATIVE_PEER__ ?? null,
      "peer iframe context",
    );
    const api = frame.contentWindow?.__PEERCANVAS_NATIVE_PEER__;
    if (!api) throw new Error("Native smoke peer context did not initialize.");
    return api;
  }

  private async waitFor<T>(
    check: () => T | null | undefined | false,
    description: string,
  ): Promise<T> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const value = check();
      if (value) return value as T;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }
}

function summarizeLinks(diagnostics: PeerNetworkDiagnostic[]): PeerLinkSummary[] {
  return diagnostics.map(
    ({
      direct,
      hops,
      connectionState,
      iceConnectionState,
      localCandidateType,
      remoteCandidateType,
    }) => ({
      direct,
      hops,
      connectionState,
      iceConnectionState,
      localCandidateType,
      remoteCandidateType,
    }),
  );
}

function countNormalizedMessages(diagnostics: NativeIceDiagnostic[]): number {
  return diagnostics.reduce(
    (total, connection) =>
      total +
      connection.dataChannels.reduce((count, channel) => count + channel.normalizedMessageCount, 0),
    0,
  );
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
    const peerHarness = new NativePeerSmokeHarness();
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
      startPeerTest: (relayUrl, rtcConfig) => peerHarness.start(relayUrl, rtcConfig),
      submitPeerEdit: () => peerHarness.submitPeerEdit(),
      reconnectPeer: () => peerHarness.reconnectPeer(),
      stopHost: () => peerHarness.stopHost(),
      closePeerTest: () => peerHarness.close(),
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
      void peerHarness.close();
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
