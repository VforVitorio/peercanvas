import { useEffect, useId, useRef, useState } from "react";
import { useDemo } from "./context";
import Icon from "./Icon";
import Tabs from "./Tabs";
import { currentPage, nodeLabel, type LeftPanel as LeftPanelId } from "./types";

const tabs = [
  { id: "shapes", label: "Shapes" },
  { id: "outline", label: "Outline" },
  { id: "pages", label: "Pages" },
  { id: "layers", label: "Layers" },
] as const satisfies ReadonlyArray<{ id: LeftPanelId; label: string }>;

/** Rename form: Enter commits through the service, Escape cancels and restores focus. */
function RenameForm({
  label,
  value,
  onSubmit,
  onDone,
}: {
  label: string;
  value: string;
  onSubmit: (name: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <form
      className="pc-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim()) onSubmit(draft.trim());
        onDone();
      }}
    >
      <label htmlFor={id} className="pc-sr-only">
        {label}
      </label>
      <input
        id={id}
        ref={input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onDone();
          }
        }}
      />
      <button type="submit" className="pc-btn pc-btn-small">
        Save
      </button>
      <button type="button" className="pc-btn pc-btn-small" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

export default function LeftPanel({ onSelect }: { onSelect: (nodeId: string | null) => void }) {
  const { state, service, ui, setUi, actions } = useDemo();
  const [renaming, setRenaming] = useState<"page" | "layer" | null>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const doc = state.document;
  const page = currentPage(doc, state.pageId);
  if (!doc || !page) return null;

  const finishRename = () => {
    setRenaming(null);
    queueMicrotask(() => renameButton.current?.focus());
  };

  const unavailableShape = (name: string) =>
    actions.explain(
      `${name} shapes are not part of the agreed demo command set; only rectangles and text can be added.`,
    );

  let content: React.ReactNode;
  if (ui.leftPanel === "shapes") {
    content = (
      <div className="pc-shape-grid">
        <button type="button" className="pc-shape" onClick={() => service.addShape("rectangle")}>
          <Icon name="rect" />
          Rectangle
        </button>
        <button type="button" className="pc-shape" onClick={() => service.addShape("text")}>
          <Icon name="text" />
          Text
        </button>
        {["Ellipse", "Diamond", "Image", "Freehand"].map((name) => (
          <button
            key={name}
            type="button"
            className="pc-shape pc-shape-unavailable"
            aria-disabled="true"
            aria-label={`${name} (unavailable in this demo)`}
            onClick={() => unavailableShape(name)}
          >
            {name}
            <span className="pc-shape-note">Unavailable</span>
          </button>
        ))}
        <p className="pc-muted pc-small">
          New shapes are added to the active layer “
          {page.layers.find((layer) => layer.layerId === state.layerId)?.name ??
            page.layers[0]?.name}
          ”.
        </p>
      </div>
    );
  } else if (ui.leftPanel === "outline") {
    content = (
      <div className="pc-outline">
        {page.layers.map((layer) => (
          <section key={layer.layerId} aria-label={`Layer ${layer.name}`}>
            <h3>
              {layer.name}
              {layer.layerId === state.layerId && <span className="pc-tag">Active</span>}
            </h3>
            {layer.nodes.length === 0 ? (
              <p className="pc-muted pc-small">No elements</p>
            ) : (
              <ul>
                {layer.nodes.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      className="pc-outline-item"
                      aria-pressed={state.selection === node.nodeId}
                      onClick={() => onSelect(state.selection === node.nodeId ? null : node.nodeId)}
                    >
                      <Icon name={node.type === "text" ? "text" : "rect"} />
                      <span>{nodeLabel(node)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {layer.connections.length > 0 && (
              <p className="pc-muted pc-small">
                {layer.connections.length} connection{layer.connections.length === 1 ? "" : "s"}
              </p>
            )}
          </section>
        ))}
      </div>
    );
  } else if (ui.leftPanel === "pages") {
    content = (
      <div className="pc-list-panel">
        <ul aria-label="Pages">
          {doc.pages.map((p) => (
            <li key={p.pageId}>
              <button
                type="button"
                className="pc-list-item"
                aria-pressed={p.pageId === page.pageId}
                onClick={() => {
                  service.setPage(p.pageId);
                  actions.announce(`Page ${p.name}`);
                }}
              >
                {p.name}
                <span className="pc-muted pc-small">
                  {p.layers.reduce((sum, layer) => sum + layer.nodes.length, 0)} elements
                </span>
              </button>
            </li>
          ))}
        </ul>
        {renaming === "page" ? (
          <RenameForm
            label="Page name"
            value={page.name}
            onSubmit={(name) => service.renamePage(name)}
            onDone={finishRename}
          />
        ) : (
          <div className="pc-row">
            <button type="button" className="pc-btn pc-btn-small" onClick={() => service.addPage()}>
              Add page
            </button>
            <button
              ref={renameButton}
              type="button"
              className="pc-btn pc-btn-small"
              onClick={() => setRenaming("page")}
            >
              Rename
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-small pc-btn-danger"
              aria-disabled={doc.pages.length <= 1}
              onClick={() =>
                doc.pages.length <= 1
                  ? actions.explain("A document keeps at least one page.")
                  : service.removePage()
              }
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  } else {
    content = (
      <div className="pc-list-panel">
        <p className="pc-muted pc-small">
          Layers of page “{page.name}”. The active layer receives new shapes.
        </p>
        <ul aria-label="Layers">
          {page.layers.map((layer) => (
            <li key={layer.layerId}>
              <button
                type="button"
                className="pc-list-item"
                aria-pressed={layer.layerId === state.layerId}
                onClick={() => {
                  service.setLayer(layer.layerId);
                  actions.announce(`Active layer ${layer.name}`);
                }}
              >
                {layer.name}
                <span className="pc-muted pc-small">{layer.nodes.length} elements</span>
              </button>
            </li>
          ))}
        </ul>
        {renaming === "layer" ? (
          <RenameForm
            label="Layer name"
            value={page.layers.find((layer) => layer.layerId === state.layerId)?.name ?? ""}
            onSubmit={(name) => service.renameLayer(name)}
            onDone={finishRename}
          />
        ) : (
          <div className="pc-row">
            <button
              type="button"
              className="pc-btn pc-btn-small"
              onClick={() => service.addLayer()}
            >
              Add layer
            </button>
            <button
              ref={renameButton}
              type="button"
              className="pc-btn pc-btn-small"
              onClick={() => setRenaming("layer")}
            >
              Rename
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-small pc-btn-danger"
              aria-disabled={page.layers.length <= 1}
              onClick={() =>
                page.layers.length <= 1
                  ? actions.explain("A page keeps at least one layer.")
                  : service.removeLayer()
              }
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="pc-panel pc-panel-left" aria-label="Document structure">
      <Tabs
        label="Structure panels"
        tabs={tabs}
        active={ui.leftPanel}
        onChange={(id) => {
          setRenaming(null);
          setUi((current) => ({ ...current, leftPanel: id }));
        }}
      >
        {content}
      </Tabs>
    </aside>
  );
}
