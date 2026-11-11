import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import symbol from "../docs/branding/assets/peercanvas-symbol-color.png";
import WeaveCanvas from "./canvas/WeaveCanvas";
import { defaultAppearance } from "./canvas/projection";
import {
  executeCommand,
  type Geometry,
  type Node,
  type ModelState,
  type Connection,
} from "./document";
import { createSample } from "./editor/sample";
import { createDocumentHistory } from "./document/history";
import "./App.css";

const geometryFields = ["x", "y", "width", "height"] as const;
const directions = [
  { label: "Move left", x: -10, y: 0 },
  { label: "Move up", x: 0, y: -10 },
  { label: "Move down", x: 0, y: 10 },
  { label: "Move right", x: 10, y: 0 },
];

export default function App() {
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
  const [feedback, setFeedback] = useState("Select an element to start editing.");
  const [error, setError] = useState("");
  const outlineHeading = useRef<HTMLHeadingElement>(null);
  const geometryForm = useRef<HTMLFormElement>(null);
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
  const selectedStyle = model.document.styles.find((value) => value.styleId === selected?.styleId);
  const connectorStyle = model.document.styles.find(
    (value) => value.styleId === selectedConnection?.styleId,
  );
  const connectionForm = useRef<HTMLFormElement>(null);
  const textForm = useRef<HTMLFormElement>(null);
  const pageNameForm = useRef<HTMLFormElement>(null);
  const layerNameForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    pageNameForm.current?.reset();
  }, [page.pageId, page.name]);
  useEffect(() => {
    layerNameForm.current?.reset();
  }, [layer.layerId, layer.name]);

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

  useEffect(() => {
    textForm.current?.reset();
  }, [selected?.nodeId, selected?.text]);
  useEffect(() => {
    connectionForm.current?.reset();
  }, [selectedConnection]);

  useEffect(() => {
    geometryForm.current?.reset();
  }, [
    selected?.nodeId,
    selected?.geometry.x,
    selected?.geometry.y,
    selected?.geometry.width,
    selected?.geometry.height,
  ]);

  function run(command: unknown, message: string): boolean {
    const current = modelRef.current;
    const result = executeCommand(current, command, {
      expectedRevision: current.revision,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(result.errors.map((diagnostic) => diagnostic.message).join(" "));
      return false;
    }
    if (result.value.changed) history.record(current, command);
    publish(result.value.state);
    setError("");
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
    setError("");
    setFeedback(node ? `${node.text || "Rectangle"} selected.` : "Selection cleared.");
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
      setError("That element is no longer in the document. Canvas state was restored.");
      return false;
    }
    return run(
      {
        type: "node.update",
        pageId: currentPage.pageId,
        layerId: currentOwner.layerId,
        node: { ...node, geometry },
      },
      `${node.text || "Rectangle"} updated.`,
    );
  }

  function changePage(id: string) {
    const next = modelRef.current.document.pages.find((value) => value.pageId === id);
    if (!next) return;
    setPageId(id);
    setLayerId(next.layers[0].layerId);
    setSelection(null);
    setConnectionSelection(null);
    setError("");
  }
  function changeLayer(id: string) {
    setLayerId(id);
    setSelection(null);
    setConnectionSelection(null);
    setError("");
  }
  function addPage() {
    const id = crypto.randomUUID(),
      firstLayer = crypto.randomUUID();
    if (
      run(
        {
          type: "page.add",
          index: model.document.pages.length,
          page: {
            pageId: id,
            name: `Page ${model.document.pages.length + 1}`,
            layers: [{ layerId: firstLayer, name: "Layer 1", nodes: [], connections: [] }],
          },
        },
        "Page added.",
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
            name: `Layer ${page.layers.length + 1}`,
            nodes: [],
            connections: [],
          },
        },
        "Layer added.",
      )
    )
      changeLayer(id);
  }
  function historyAction(direction: "undo" | "redo") {
    const current = modelRef.current;
    const result = history[direction](current, {
      expectedRevision: current.revision,
      now: new Date().toISOString(),
    });
    if (!result) return;
    if (!result.ok) {
      setError(result.errors.map((value) => value.message).join(" "));
      return;
    }
    publish(result.value.state);
    setError("");
    setFeedback(direction === "undo" ? "Edit undone." : "Edit redone.");
  }
  function onHistoryKey(event: KeyboardEvent<HTMLElement>) {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable='true']")
    )
      return;
    const key = event.key.toLowerCase();
    if (!(event.ctrlKey || event.metaKey) || event.altKey || (key !== "z" && key !== "y")) return;
    event.preventDefault();
    event.stopPropagation();
    historyAction(key === "y" || event.shiftKey ? "redo" : "undo");
  }
  function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const connection: Connection = {
      connectionId: selectedConnection?.connectionId ?? crypto.randomUUID(),
      sourceNodeId: String(fields.get("source")),
      targetNodeId: String(fields.get("target")),
      routing: "straight",
      label: String(fields.get("label") ?? ""),
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
    if (run(command, selectedConnection ? "Connector updated." : "Connector added.")) {
      setSelection(null);
      setConnectionSelection(connection.connectionId);
    }
  }

  function addRectangle() {
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
    const node: Node = {
      nodeId: crypto.randomUUID(),
      type: "rectangle",
      text: "Rectangle",
      geometry: {
        x,
        y,
        width: 180,
        height: 90,
        rotation: 0,
      },
      styleId: null,
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
        "Rectangle added.",
      )
    ) {
      setSelection(node.nodeId);
      setConnectionSelection(null);
      setFitRequest((value) => value + 1);
    }
  }

  function removeSelected() {
    if (selectedConnection && connectionOwner) {
      if (
        run(
          {
            type: "connection.remove",
            pageId: page.pageId,
            layerId: connectionOwner.layerId,
            connectionId: selectedConnection.connectionId,
          },
          "Connector deleted.",
        )
      ) {
        setConnectionSelection(null);
        outlineHeading.current?.focus();
      }
      return;
    }
    if (!selected || !owner) return;
    if (
      run(
        {
          type: "node.remove",
          pageId: page.pageId,
          layerId: owner.layerId,
          nodeId: selected.nodeId,
        },
        `${selected.text || "Rectangle"} deleted.`,
      )
    ) {
      setSelection(null);
      outlineHeading.current?.focus();
    }
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
    const active = document.activeElement;
    if (active !== event.currentTarget && !event.currentTarget.contains(active)) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, button, [contenteditable='true']")
    )
      return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.ctrlKey && !event.metaKey) removeSelected();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      select(null);
      return;
    }
    if (!selected) return;
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const [dx, dy] = direction.map((value) => value * step);
    const geometry = selected.geometry;
    commitGeometry(
      selected.nodeId,
      event.altKey
        ? {
            ...geometry,
            width: geometry.width + dx,
            height: geometry.height + dy,
          }
        : { ...geometry, x: geometry.x + dx, y: geometry.y + dy },
    );
  }

  function preventAltDragClone(
    event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
  ) {
    // shortcut: Alt-drag cloning stays disabled until clones have canonical commands.
    const isMove = event.type === "pointermove" || event.type === "mousemove";
    if (!event.altKey || (isMove && event.buttons === 0)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function applyGeometry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const fields = new FormData(event.currentTarget);
    commitGeometry(selected.nodeId, {
      ...selected.geometry,
      x: Number(fields.get("x")),
      y: Number(fields.get("y")),
      width: Number(fields.get("width")),
      height: Number(fields.get("height")),
    });
  }

  return (
    <main className="pc-editor" onKeyDownCapture={onHistoryKey}>
      <header className="pc-topbar">
        <div className="pc-brand">
          <img src={symbol} alt="" width="36" height="36" />
          <h1>PeerCanvas</h1>
        </div>
        <div className="pc-document-title">
          <strong>{model.document.metadata.title}</strong>
          <span className="pc-unsaved">Unsaved · in memory</span>
        </div>
        <div role="group" aria-label="Edit history" className="pc-history-controls">
          <button
            type="button"
            className="pc-btn"
            disabled={!history.canUndo}
            onClick={() => historyAction("undo")}
          >
            Undo
          </button>
          <button
            type="button"
            className="pc-btn"
            disabled={!history.canRedo}
            onClick={() => historyAction("redo")}
          >
            Redo
          </button>
        </div>
        <span className="pc-local-state">
          <span className="pc-local-indicator" aria-hidden="true" /> Local workspace
        </span>
      </header>
      <p className="pc-memory-notice">
        This example lives only in memory. Closing or reloading the app loses all changes. Saving
        and opening files are not available yet.
      </p>
      <div className="pc-workspace">
        <aside className="pc-outline" aria-labelledby="outline-heading">
          <section className="pc-structure" aria-label="Document structure">
            <label htmlFor="active-page">Page</label>
            <select
              id="active-page"
              value={page.pageId}
              onChange={(event) => changePage(event.target.value)}
            >
              {model.document.pages.map((value) => (
                <option key={value.pageId} value={value.pageId}>
                  {value.name}
                </option>
              ))}
            </select>
            <button type="button" className="pc-btn" onClick={addPage}>
              Add page
            </button>
            <form
              ref={pageNameForm}
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  {
                    type: "page.rename",
                    pageId: page.pageId,
                    name: String(new FormData(event.currentTarget).get("name")),
                  },
                  "Page renamed.",
                );
              }}
            >
              <label htmlFor="page-name">Page name</label>
              <input
                id="page-name"
                name="name"
                aria-describedby={error ? "editor-error" : undefined}
                aria-invalid={Boolean(error)}
                required
                defaultValue={page.name}
              />
              <button className="pc-btn" type="submit">
                Rename page
              </button>
            </form>
            <label htmlFor="active-layer">Layer</label>
            <select
              id="active-layer"
              value={layer.layerId}
              onChange={(event) => changeLayer(event.target.value)}
            >
              {page.layers.map((value) => (
                <option key={value.layerId} value={value.layerId}>
                  {value.name}
                </option>
              ))}
            </select>
            <button type="button" className="pc-btn" onClick={addLayer}>
              Add layer
            </button>
            <form
              ref={layerNameForm}
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  {
                    type: "layer.rename",
                    pageId: page.pageId,
                    layerId: layer.layerId,
                    name: String(new FormData(event.currentTarget).get("name")),
                  },
                  "Layer renamed.",
                );
              }}
            >
              <label htmlFor="layer-name">Layer name</label>
              <input
                id="layer-name"
                name="name"
                aria-describedby={error ? "editor-error" : undefined}
                aria-invalid={Boolean(error)}
                required
                defaultValue={layer.name}
              />
              <button className="pc-btn" type="submit">
                Rename layer
              </button>
            </form>
          </section>
          <div className="pc-panel-title">
            <h2 id="outline-heading" ref={outlineHeading} tabIndex={-1}>
              Elements
            </h2>
            <span>{layer.nodes.length}</span>
          </div>
          <p className="pc-context-label">
            {page.name} / {layer.name}
          </p>
          <ul className="pc-element-list" aria-label="Diagram elements">
            {layer.nodes.map((node) => (
              <li key={node.nodeId}>
                <button
                  type="button"
                  aria-pressed={selection === node.nodeId}
                  onClick={() => select(node.nodeId)}
                >
                  <span className="pc-element-symbol" aria-hidden="true" />
                  <span>{node.text || "Rectangle"}</span>
                  {selection === node.nodeId && (
                    <span className="pc-selected-label" aria-hidden="true">
                      Selected
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {layer.nodes.length === 0 && (
            <p className="pc-empty">No elements. Add a rectangle to begin.</p>
          )}
          <button type="button" className="pc-btn pc-add" onClick={addRectangle}>
            Add rectangle
          </button>
          <h2 className="pc-connections-title">Connections</h2>
          <ul className="pc-element-list" aria-label="Diagram connections">
            {layer.connections.map((connection) => (
              <li key={connection.connectionId}>
                <button
                  type="button"
                  aria-pressed={connectionSelection === connection.connectionId}
                  onClick={() => {
                    setSelection(null);
                    setConnectionSelection(connection.connectionId);
                    setError("");
                  }}
                >
                  {connection.label ||
                    `${pageNodes.find((node) => node.nodeId === connection.sourceNodeId)?.text || "Shape"} to ${pageNodes.find((node) => node.nodeId === connection.targetNodeId)?.text || "Shape"}`}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="pc-btn pc-add"
            onClick={() => {
              setSelection(null);
              setConnectionSelection(null);
              connectionForm.current?.reset();
            }}
          >
            New connector
          </button>
        </aside>
        <section className="pc-canvas-panel" aria-label="Canvas workspace">
          <div className="pc-canvas-toolbar">
            <span>
              {page.name} / {layer.name}
            </span>
            <div className="pc-zoom-controls" role="group" aria-label="Canvas zoom">
              <button
                type="button"
                className="pc-btn"
                aria-label="Zoom out"
                disabled={zoom <= 0.1}
                onClick={() => setZoom((value) => Math.max(0.1, value - 0.1))}
              >
                <span className="pc-zoom-icon" aria-hidden="true" />
              </button>
              <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
              <button
                type="button"
                className="pc-btn"
                aria-label="Zoom in"
                disabled={zoom >= 4}
                onClick={() => setZoom((value) => Math.min(4, value + 0.1))}
              >
                <span className="pc-zoom-icon pc-zoom-in-icon" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pc-btn"
                onClick={() => setFitRequest((value) => value + 1)}
              >
                Fit to content
              </button>
            </div>
          </div>
          <div
            className="pc-canvas-region"
            role="region"
            aria-label="Diagram canvas"
            aria-describedby="keyboard-help"
            tabIndex={0}
            onKeyDownCapture={onKeyDownCapture}
            onPointerDownCapture={preventAltDragClone}
            onPointerMoveCapture={preventAltDragClone}
            onMouseDownCapture={preventAltDragClone}
            onMouseMoveCapture={preventAltDragClone}
          >
            <WeaveCanvas
              document={model.document}
              pageId={page.pageId}
              layerId={layer.layerId}
              selection={selection}
              connectionSelection={connectionSelection}
              zoom={zoom}
              fitRequest={fitRequest}
              onSelect={select}
              onZoomChange={setZoom}
              onCommitGeometry={commitGeometry}
            />
          </div>
          <p id="keyboard-help" className="pc-keyboard-help">
            Select on canvas or in Elements. With the canvas focused: arrow keys move; Alt + arrows
            resize; Shift uses 10-unit steps. Delete removes; Escape clears selection. Geometry
            fields provide another keyboard path. Ctrl/Cmd + Z undoes; Shift + Ctrl/Cmd + Z or
            Ctrl/Cmd + Y redoes.
          </p>
        </section>
        <aside className="pc-inspector" aria-labelledby="inspector-heading">
          <h2 id="inspector-heading">Properties</h2>
          {selected ? (
            <>
              <p className="pc-selection-title">
                {selected.text || "Rectangle"}
                <span>{selected.type === "text" ? "Text" : "Rectangle"}</span>
              </p>
              <dl className="pc-style-summary" aria-label="Shape appearance">
                <dt>Fill</dt>
                <dd>
                  {selected.type === "text"
                    ? "None"
                    : selectedStyle
                      ? (selectedStyle.fill ?? "None")
                      : defaultAppearance.fill}
                </dd>
                <dt>Stroke</dt>
                <dd>
                  {selected.type === "text"
                    ? "None"
                    : selectedStyle
                      ? (selectedStyle.stroke ?? "None")
                      : defaultAppearance.stroke}
                </dd>
                <dt>Stroke width</dt>
                <dd>{selectedStyle?.strokeWidth ?? defaultAppearance.strokeWidth}</dd>
                <dt>Text color</dt>
                <dd>{selectedStyle?.textColor ?? defaultAppearance.textColor}</dd>
                <dt>Font size</dt>
                <dd>{selectedStyle?.fontSize ?? defaultAppearance.fontSize}</dd>
              </dl>
              <form
                ref={textForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    {
                      type: "node.update",
                      pageId: page.pageId,
                      layerId: owner!.layerId,
                      node: {
                        ...selected,
                        text: String(new FormData(event.currentTarget).get("text")),
                      },
                    },
                    "Text updated.",
                  );
                }}
              >
                <label htmlFor="node-text">Text</label>
                <input
                  id="node-text"
                  name="text"
                  defaultValue={selected.text}
                  aria-describedby={error ? "editor-error" : undefined}
                />
                <button className="pc-btn" type="submit">
                  Apply text
                </button>
              </form>
              <form ref={geometryForm} onSubmit={applyGeometry}>
                <fieldset>
                  <legend>Position &amp; size</legend>
                  <div className="pc-geometry-grid">
                    {geometryFields.map((field) => (
                      <label key={field} htmlFor={`geometry-${field}`}>
                        {field === "x"
                          ? "X position"
                          : field === "y"
                            ? "Y position"
                            : field === "width"
                              ? "Width"
                              : "Height"}
                        <input
                          id={`geometry-${field}`}
                          name={field}
                          type="number"
                          step="any"
                          required
                          defaultValue={selected.geometry[field]}
                          aria-describedby={error ? "editor-error" : undefined}
                          aria-invalid={Boolean(error)}
                        />
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="pc-btn pc-primary">
                    Apply geometry
                  </button>
                </fieldset>
              </form>
              <div
                className="pc-move-controls"
                role="group"
                aria-label="Move selection by 10 units"
              >
                {directions.map((direction) => (
                  <button
                    key={direction.label}
                    type="button"
                    className="pc-btn"
                    aria-label={`${direction.label} 10 units`}
                    onClick={() =>
                      commitGeometry(selected.nodeId, {
                        ...selected.geometry,
                        x: selected.geometry.x + direction.x,
                        y: selected.geometry.y + direction.y,
                      })
                    }
                  >
                    {direction.label}
                  </button>
                ))}
              </div>
              <button type="button" className="pc-btn pc-delete" onClick={removeSelected}>
                Delete element
              </button>
            </>
          ) : (
            <form
              ref={connectionForm}
              key={`${page.pageId}:${layer.layerId}:${connectionSelection ?? "new"}`}
              onSubmit={submitConnection}
              className="pc-connection-form"
            >
              <fieldset>
                <legend>{selectedConnection ? "Connector properties" : "Connect shapes"}</legend>
                <label htmlFor="connection-source">Source</label>
                <select
                  id="connection-source"
                  aria-describedby={error ? "editor-error" : undefined}
                  aria-invalid={Boolean(error)}
                  name="source"
                  defaultValue={selectedConnection?.sourceNodeId ?? pageNodes[0]?.nodeId}
                  required
                >
                  {pageNodes.map((node) => (
                    <option key={node.nodeId} value={node.nodeId}>
                      {node.text || "Rectangle"}
                    </option>
                  ))}
                </select>
                <label htmlFor="connection-target">Target</label>
                <select
                  id="connection-target"
                  aria-describedby={error ? "editor-error" : undefined}
                  aria-invalid={Boolean(error)}
                  name="target"
                  defaultValue={selectedConnection?.targetNodeId ?? pageNodes[1]?.nodeId}
                  required
                >
                  {pageNodes.map((node) => (
                    <option key={node.nodeId} value={node.nodeId}>
                      {node.text || "Rectangle"}
                    </option>
                  ))}
                </select>
                <label htmlFor="connection-label">Connector label</label>
                <input
                  id="connection-label"
                  name="label"
                  defaultValue={selectedConnection?.label ?? ""}
                  aria-describedby={error ? "editor-error" : undefined}
                />
                <p className="pc-empty">
                  Stroke {connectorStyle?.stroke ?? defaultAppearance.stroke}, width{" "}
                  {connectorStyle?.strokeWidth ?? defaultAppearance.strokeWidth}.
                </p>
                <p className="pc-empty">
                  Straight routing. Both endpoints must be different shapes on this page.
                </p>
                {pageNodes.length < 2 && (
                  <p className="pc-empty">
                    Add at least two shapes on this page to create a connector.
                  </p>
                )}
                <button
                  className="pc-btn pc-primary"
                  type="submit"
                  disabled={!selectedConnection && pageNodes.length < 2}
                >
                  {selectedConnection ? "Apply connector" : "Add connector"}
                </button>
              </fieldset>
              {selectedConnection && (
                <button className="pc-btn pc-delete" type="button" onClick={removeSelected}>
                  Delete connector
                </button>
              )}
            </form>
          )}
          {error && (
            <p id="editor-error" className="pc-error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
      <footer className="pc-statusbar">
        <p role="status" aria-label="Editing status">
          {feedback}
        </p>
        <span>Revision {model.revision} · in memory</span>
      </footer>
    </main>
  );
}
