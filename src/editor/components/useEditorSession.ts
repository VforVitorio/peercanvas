import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  executeCommand,
  type Connection,
  type Geometry,
  type ModelState,
  type Node,
} from "../../document";
import { createDocumentHistory } from "../../document/history";
import { useI18n } from "../../i18n";
import { shapeNodeType } from "../../shapes/catalog";
import { bundledShapeManifest, type ApprovedShapeManifestEntry } from "../../shapes/manifest";
import { createSample } from "../sample";
import { useLocalDocuments } from "../useLocalDocuments";
import { localizeShape } from "./catalogText";
import { diagnostics, text, type EditorMessage, type MessageParam } from "./messages";

/** A node's display name: its own text, otherwise a localized type label resolved at render. */
export function nodeName(node: Pick<Node, "text" | "type">): MessageParam {
  return (
    node.text ||
    text(node.type === "text" ? "editor.inspector.type.text" : "editor.defaults.rectangle")
  );
}

export type ConnectionDraft = { source: string; target: string; label: string };

/**
 * Owns the single canonical model, its undo history, the view selection that is reconciled
 * against it, and the local-document lifecycle. Every mutation goes through executeCommand;
 * presentation components receive data and callbacks only.
 */
export function useEditorSession() {
  const { t } = useI18n();
  const tRef = useRef(t);
  useLayoutEffect(() => {
    tRef.current = t;
  }, [t]);
  const [model, setModel] = useState(createSample);
  // Canvas commits need an immediate acceptance result, including between React renders.
  const modelRef = useRef(model);
  const [history] = useState(createDocumentHistory);
  const [pageId, setPageId] = useState(model.document.pages[0].pageId);
  const [layerId, setLayerId] = useState(model.document.pages[0].layers[0].layerId);
  const viewRef = useRef({ pageId, layerId });
  useLayoutEffect(() => {
    viewRef.current = { pageId, layerId };
  }, [pageId, layerId]);
  const [connectionSelection, setConnectionSelection] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [feedback, setFeedback] = useState<EditorMessage>(() => text("editor.feedback.start"));
  const [error, setError] = useState<EditorMessage | null>(null);
  const [renamingDocument, setRenamingDocument] = useState(false);

  const page =
    model.document.pages.find((value) => value.pageId === pageId) ?? model.document.pages[0];
  const layer = page.layers.find((value) => value.layerId === layerId) ?? page.layers[0];
  const owner = page.layers.find((value) => value.nodes.some((node) => node.nodeId === selection));
  const selected = owner?.nodes.find((node) => node.nodeId === selection);
  const connectionOwner = page.layers.find((value) =>
    value.connections.some((connection) => connection.connectionId === connectionSelection),
  );
  const selectedConnection = connectionOwner?.connections.find(
    (value) => value.connectionId === connectionSelection,
  );
  const pageNodes = page.layers.flatMap((value) => value.nodes);

  function publish(next: ModelState) {
    modelRef.current = next;
    setModel(next);
    const nextPage =
      next.document.pages.find((value) => value.pageId === viewRef.current.pageId) ??
      next.document.pages[0];
    const nextLayer =
      nextPage.layers.find((value) => value.layerId === viewRef.current.layerId) ??
      nextPage.layers[0];
    setPageId(nextPage.pageId);
    setLayerId(nextLayer.layerId);
    setSelection((id) =>
      nextPage.layers.some((value) => value.nodes.some((node) => node.nodeId === id)) ? id : null,
    );
    setConnectionSelection((id) =>
      nextPage.layers.some((value) =>
        value.connections.some((connection) => connection.connectionId === id),
      )
        ? id
        : null,
    );
  }

  function replaceDocument(next: ModelState) {
    const firstPage = next.document.pages[0];
    const firstLayer = firstPage.layers[0];
    viewRef.current = { pageId: firstPage.pageId, layerId: firstLayer.layerId };
    modelRef.current = next;
    setModel(next);
    setPageId(firstPage.pageId);
    setLayerId(firstLayer.layerId);
    setSelection(null);
    setConnectionSelection(null);
    setZoom(1);
    setFitRequest((value) => value + 1);
    setRenamingDocument(false);
  }

  const documents = useLocalDocuments({
    getModel: () => modelRef.current,
    replaceModel: replaceDocument,
    clearHistory: history.clear,
    reportError: setError,
    reportFeedback: setFeedback,
    defaultTitle: () => tRef.current("documents.untitledTitle"),
    defaultPageName: () => tRef.current("editor.defaults.page", { number: 1 }),
    defaultLayerName: () => tRef.current("editor.defaults.layer", { number: 1 }),
  });
  const editingLocked = documents.isEditingLocked();

  function run(command: unknown, message: EditorMessage): boolean {
    if (documents.isEditingLocked()) return false;
    const current = modelRef.current;
    const result = executeCommand(current, command, {
      expectedRevision: current.revision,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(diagnostics(result.errors));
      return false;
    }
    if (result.value.changed) {
      history.record(current, command);
      documents.markDirty();
    }
    publish(result.value.state);
    setError(null);
    setFeedback(message);
    return true;
  }

  function select(nodeId: string | null) {
    const currentPage = modelRef.current.document.pages.find(
      (value) => value.pageId === viewRef.current.pageId,
    );
    const currentOwner = currentPage?.layers.find((value) =>
      value.nodes.some((candidate) => candidate.nodeId === nodeId),
    );
    const node = currentOwner?.nodes.find((candidate) => candidate.nodeId === nodeId);
    setSelection(node?.nodeId ?? null);
    setConnectionSelection(null);
    if (currentOwner) setLayerId(currentOwner.layerId);
    setError(null);
    setFeedback(
      node
        ? text("editor.feedback.selected", { name: nodeName(node) })
        : text("editor.feedback.cleared"),
    );
  }

  function selectConnection(connectionId: string | null) {
    setSelection(null);
    setConnectionSelection(connectionId);
    setError(null);
  }

  function commitGeometry(nodeId: string, geometry: Geometry): boolean {
    const currentPage = modelRef.current.document.pages.find(
      (value) => value.pageId === viewRef.current.pageId,
    );
    const currentOwner = currentPage?.layers.find((value) =>
      value.nodes.some((candidate) => candidate.nodeId === nodeId),
    );
    const node = currentOwner?.nodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node || !currentPage || !currentOwner) {
      setError(text("editor.errors.elementGone"));
      return false;
    }
    return run(
      {
        type: "node.update",
        pageId: currentPage.pageId,
        layerId: currentOwner.layerId,
        node: { ...node, geometry },
      },
      text("editor.feedback.updated", { name: nodeName(node) }),
    );
  }

  function changePage(id: string) {
    const next = modelRef.current.document.pages.find((value) => value.pageId === id);
    if (!next) return;
    setPageId(id);
    setLayerId(next.layers[0].layerId);
    setSelection(null);
    setConnectionSelection(null);
    setError(null);
  }

  function changeLayer(id: string) {
    setLayerId(id);
    setSelection(null);
    setConnectionSelection(null);
    setError(null);
  }

  function addPage() {
    const pages = modelRef.current.document.pages;
    const id = crypto.randomUUID();
    const firstLayer = crypto.randomUUID();
    if (
      run(
        {
          type: "page.add",
          index: pages.length,
          page: {
            pageId: id,
            // New default names follow the interface language at creation time only.
            name: tRef.current("editor.defaults.page", { number: pages.length + 1 }),
            layers: [
              {
                layerId: firstLayer,
                name: tRef.current("editor.defaults.layer", { number: 1 }),
                nodes: [],
                connections: [],
              },
            ],
          },
        },
        text("editor.feedback.pageAdded"),
      )
    ) {
      setPageId(id);
      setLayerId(firstLayer);
      setSelection(null);
      setConnectionSelection(null);
    }
  }

  function addLayer() {
    const id = crypto.randomUUID();
    if (
      run(
        {
          type: "layer.add",
          pageId: page.pageId,
          index: page.layers.length,
          layer: {
            layerId: id,
            name: tRef.current("editor.defaults.layer", { number: page.layers.length + 1 }),
            nodes: [],
            connections: [],
          },
        },
        text("editor.feedback.layerAdded"),
      )
    )
      changeLayer(id);
  }

  function renamePage(name: string) {
    return run(
      { type: "page.rename", pageId: page.pageId, name },
      text("editor.feedback.pageRenamed"),
    );
  }

  function renameLayer(name: string) {
    return run(
      { type: "layer.rename", pageId: page.pageId, layerId: layer.layerId, name },
      text("editor.feedback.layerRenamed"),
    );
  }

  function historyAction(direction: "undo" | "redo") {
    if (documents.isEditingLocked()) return;
    const current = modelRef.current;
    const result = history[direction](current, {
      expectedRevision: current.revision,
      now: new Date().toISOString(),
    });
    if (!result) return;
    if (!result.ok) {
      setError(diagnostics(result.errors));
      return;
    }
    if (result.value.changed) documents.markDirty();
    publish(result.value.state);
    setError(null);
    setFeedback(text(direction === "undo" ? "editor.feedback.undone" : "editor.feedback.redone"));
  }

  /**
   * Document-level shortcuts. Text entry keeps its native undo and editing keys. Inside dialogs and
   * menus the shortcuts never run (even from a focused button); their browser defaults are
   * suppressed so the WebView cannot, for example, save the page instead.
   */
  function onShortcutKey(event: KeyboardEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const reserved = ["z", "y", "n", "o", "s"].includes(key);
    if (target?.closest("dialog, [role='dialog'], [role='alertdialog'], [role='menu']")) {
      if (reserved) event.preventDefault();
      return;
    }
    if (documents.isEditingLocked() && reserved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (key === "z" || key === "y") {
      event.preventDefault();
      event.stopPropagation();
      historyAction(key === "y" || event.shiftKey ? "redo" : "undo");
    } else if (key === "n" && !event.shiftKey) {
      event.preventDefault();
      documents.newDocument();
    } else if (key === "o" && !event.shiftKey) {
      event.preventDefault();
      documents.openDocument();
    } else if (key === "s") {
      event.preventDefault();
      if (event.shiftKey) void documents.saveAs();
      else void documents.saveDocument();
    }
  }

  function renameDocument(title: string): boolean {
    const renamed = run(
      {
        type: "document.setMetadata",
        title,
        description: modelRef.current.document.metadata.description,
      },
      text("editor.feedback.documentRenamed"),
    );
    if (renamed) setRenamingDocument(false);
    return renamed;
  }

  function submitConnection(draft: ConnectionDraft): boolean {
    const connection: Connection = {
      connectionId: selectedConnection?.connectionId ?? crypto.randomUUID(),
      sourceNodeId: draft.source,
      targetNodeId: draft.target,
      routing: "straight",
      label: draft.label,
      styleId: selectedConnection?.styleId ?? null,
    };
    const command = selectedConnection
      ? {
          type: "connection.update",
          pageId: page.pageId,
          layerId: connectionOwner!.layerId,
          connection,
        }
      : {
          type: "connection.add",
          pageId: page.pageId,
          layerId: layer.layerId,
          connection,
          index: layer.connections.length,
        };
    if (
      run(
        command,
        text(
          selectedConnection
            ? "editor.feedback.connectorUpdated"
            : "editor.feedback.connectorAdded",
        ),
      )
    ) {
      setSelection(null);
      setConnectionSelection(connection.connectionId);
      return true;
    }
    return false;
  }

  function addShape(shape: ApprovedShapeManifestEntry) {
    const nodeType = shapeNodeType(shape);
    if (
      nodeType === null ||
      !bundledShapeManifest.entries.some(
        (entry) => entry.id === shape.id && entry.version === shape.version,
      )
    )
      return;
    const nodes = layer.nodes;
    let cell = 0;
    let x = 80;
    let y = 100;
    while (
      nodes.some(
        ({ geometry }) =>
          x < geometry.x + geometry.width &&
          x + 180 > geometry.x &&
          y < geometry.y + geometry.height &&
          y + 90 > geometry.y,
      )
    ) {
      cell += 1;
      x = 80 + (cell % 3) * 240;
      y = 100 + Math.floor(cell / 3) * 150;
    }
    // The new element's text is its catalog name in the interface language at creation time.
    const name = localizeShape(shape, tRef.current).name;
    const node: Node = {
      nodeId: crypto.randomUUID(),
      type: nodeType,
      text: name,
      geometry: { x, y, width: 180, height: 90, rotation: 0 },
      styleId: null,
      catalogReference: { shapeId: shape.id, version: shape.version },
    };
    if (
      run(
        {
          type: "node.add",
          pageId: page.pageId,
          layerId: layer.layerId,
          node,
          index: nodes.length,
        },
        text("editor.feedback.shapeAdded", { name }),
      )
    ) {
      setSelection(node.nodeId);
      setConnectionSelection(null);
      setFitRequest((value) => value + 1);
    }
  }

  function updateSelectedText(value: string): boolean {
    if (!selected || !owner) return false;
    return run(
      {
        type: "node.update",
        pageId: page.pageId,
        layerId: owner.layerId,
        node: { ...selected, text: value },
      },
      text("editor.feedback.textUpdated"),
    );
  }

  /** Removes the selected connector or node. Returns true when the document changed. */
  function removeSelected(): boolean {
    if (selectedConnection && connectionOwner) {
      if (
        run(
          {
            type: "connection.remove",
            pageId: page.pageId,
            layerId: connectionOwner.layerId,
            connectionId: selectedConnection.connectionId,
          },
          text("editor.feedback.connectorDeleted"),
        )
      ) {
        setConnectionSelection(null);
        return true;
      }
      return false;
    }
    if (!selected || !owner) return false;
    if (
      run(
        {
          type: "node.remove",
          pageId: page.pageId,
          layerId: owner.layerId,
          nodeId: selected.nodeId,
        },
        text("editor.feedback.deleted", { name: nodeName(selected) }),
      )
    ) {
      setSelection(null);
      return true;
    }
    return false;
  }

  return {
    model,
    page,
    layer,
    pageNodes,
    selection,
    selected,
    selectedStyle: model.document.styles.find((value) => value.styleId === selected?.styleId),
    connectionSelection,
    selectedConnection,
    connectorStyle: model.document.styles.find(
      (value) => value.styleId === selectedConnection?.styleId,
    ),
    zoom,
    setZoom,
    fitRequest,
    requestFit: () => setFitRequest((value) => value + 1),
    feedback,
    error,
    renamingDocument,
    setRenamingDocument,
    documents,
    editingLocked,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    select,
    selectConnection,
    commitGeometry,
    changePage,
    changeLayer,
    addPage,
    addLayer,
    renamePage,
    renameLayer,
    historyAction,
    onShortcutKey,
    renameDocument,
    submitConnection,
    addShape,
    updateSelectedText,
    removeSelected,
  };
}

export type EditorSession = ReturnType<typeof useEditorSession>;
