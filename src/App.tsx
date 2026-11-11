import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import symbol from "../docs/branding/assets/peercanvas-symbol-color.png";
import WeaveCanvas from "./canvas/WeaveCanvas";
import { executeCommand, type Geometry, type Node } from "./document";
import { createSample, LAYER_ID, PAGE_ID } from "./editor/sample";
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
  const [selection, setSelection] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [feedback, setFeedback] = useState("Select an element to start editing.");
  const [error, setError] = useState("");
  const outlineHeading = useRef<HTMLHeadingElement>(null);
  const geometryForm = useRef<HTMLFormElement>(null);
  const layer = model.document.pages[0].layers[0];
  const selected = layer.nodes.find((node) => node.nodeId === selection);

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
    modelRef.current = result.value.state;
    setModel(result.value.state);
    setError("");
    setFeedback(message);
    return true;
  }

  function select(nodeId: string | null) {
    const node = modelRef.current.document.pages[0].layers[0].nodes.find(
      (candidate) => candidate.nodeId === nodeId,
    );
    setSelection(node?.nodeId ?? null);
    setError("");
    setFeedback(node ? `${node.text || "Rectangle"} selected.` : "Selection cleared.");
  }

  function commitGeometry(nodeId: string, geometry: Geometry): boolean {
    const node = modelRef.current.document.pages[0].layers[0].nodes.find(
      (candidate) => candidate.nodeId === nodeId,
    );
    if (!node) {
      setError("That element is no longer in the document. Canvas state was restored.");
      return false;
    }
    return run(
      { type: "node.update", pageId: PAGE_ID, layerId: LAYER_ID, node: { ...node, geometry } },
      `${node.text || "Rectangle"} updated.`,
    );
  }

  function addRectangle() {
    const nodes = modelRef.current.document.pages[0].layers[0].nodes;
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
        { type: "node.add", pageId: PAGE_ID, layerId: LAYER_ID, node, index: nodes.length },
        "Rectangle added.",
      )
    ) {
      setSelection(node.nodeId);
      setFitRequest((value) => value + 1);
    }
  }

  function removeSelected() {
    if (!selected) return;
    if (
      run(
        { type: "node.remove", pageId: PAGE_ID, layerId: LAYER_ID, nodeId: selected.nodeId },
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
    <main className="pc-editor">
      <header className="pc-topbar">
        <div className="pc-brand">
          <img src={symbol} alt="" width="36" height="36" />
          <h1>PeerCanvas</h1>
        </div>
        <div className="pc-document-title">
          <strong>{model.document.metadata.title}</strong>
          <span className="pc-unsaved">Unsaved · in memory</span>
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
          <div className="pc-panel-title">
            <h2 id="outline-heading" ref={outlineHeading} tabIndex={-1}>
              Elements
            </h2>
            <span>{layer.nodes.length}</span>
          </div>
          <p className="pc-context-label">
            {model.document.pages[0].name} / {layer.name}
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
        </aside>
        <section className="pc-canvas-panel" aria-label="Canvas workspace">
          <div className="pc-canvas-toolbar">
            <span>Page 1</span>
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
              pageId={PAGE_ID}
              layerId={LAYER_ID}
              selection={selection}
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
            fields provide another keyboard path.
          </p>
        </section>
        <aside className="pc-inspector" aria-labelledby="inspector-heading">
          <h2 id="inspector-heading">Properties</h2>
          {selected ? (
            <>
              <p className="pc-selection-title">
                {selected.text || "Rectangle"}
                <span>Rectangle</span>
              </p>
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
            <p className="pc-empty">Select an element to inspect its position and size.</p>
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
