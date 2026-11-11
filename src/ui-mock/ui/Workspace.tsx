import { useCallback, useId, useMemo, useRef, useState } from "react";
import brandMark from "../../../docs/branding/assets/peercanvas-symbol-color.png";
import type { MoveNodeRequest } from "../services/demo-service";
import { useDemo } from "./context";
import Icon from "./Icon";
import LeftPanel from "./LeftPanel";
import Menu, { type MenuItem } from "./Menu";
import RightPanel from "./RightPanel";
import { currentPage, findNode, nodeLabel } from "./types";
import WeaveCanvas, {
  type CanvasStatus,
  type CanvasViewportHandle,
  type PanDirection,
} from "./WeaveCanvas";

const panDirections: Record<string, PanDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

function SaveStatus() {
  const { state, dirty } = useDemo();
  const saving = state.operation?.kind === "save" && state.operation.status === "running";
  const text = saving
    ? "Saving (simulated)…"
    : dirty
      ? "Unsaved changes"
      : state.savedRevision === null
        ? "Never saved (simulated)"
        : "Saved in memory (simulated)";
  return (
    <span className={`pc-save ${dirty ? "pc-save-dirty" : ""}`} data-testid="save-status">
      <span className="pc-dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export default function Workspace() {
  const { state, service, ui, setUi, actions, dirty } = useDemo();
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>({ state: "starting" });
  const canvasRef = useRef<CanvasViewportHandle>(null);
  const canvasHelpId = useId();
  const doc = state.document;
  const page = currentPage(doc, state.pageId);
  const selected = findNode(doc, state.selection);
  const pageNodes = useMemo(() => page?.layers.flatMap((layer) => layer.nodes) ?? [], [page]);
  const hasSelection = Boolean(selected);
  const noSelection = "Select an element first (canvas, Outline panel, or [ and ] on the canvas).";

  const select = useCallback(
    (nodeId: string | null) => {
      service.select(nodeId);
      const found = findNode(service.getSnapshot().document, nodeId);
      actions.announce(found ? `Selected ${nodeLabel(found.node)}` : "Selection cleared");
    },
    [service, actions],
  );

  // A drag is a transient renderer gesture; only the release reaches the service, which owns
  // validation (role, revision, bounds). Cancelled drags never call this, so selection stays.
  const moveNode = useCallback(
    (request: MoveNodeRequest) => {
      const accepted = service.moveNode(request);
      if (accepted) {
        // Select the moved shape so the inspector and status bar describe what just changed.
        if (service.getSnapshot().selection !== request.nodeId) service.select(request.nodeId);
        const found = findNode(service.getSnapshot().document, request.nodeId);
        actions.announce(
          found ? `Moved ${nodeLabel(found.node)} to ${request.x}, ${request.y}` : "Shape moved",
        );
      } else {
        // The service has already published the specific reason as an alert notice.
        actions.announce("Move rejected. The document was not changed.");
      }
      return accepted;
    },
    [service, actions],
  );

  if (!doc) return null;

  const menus: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: "File",
      items: [
        { label: "New document", onSelect: () => actions.requestReplace({ type: "new" }) },
        {
          label: "Open recent…",
          onSelect: () => setUi((current) => ({ ...current, view: "home", homeSection: "recent" })),
        },
        {
          label: "Save",
          shortcut: "Ctrl/⌘ S",
          onSelect: () => actions.run("Save", () => service.save()),
        },
        { label: "Rename…", onSelect: () => actions.openDialog({ kind: "rename" }) },
        {
          label: "Import…",
          separatorBefore: true,
          onSelect: () => actions.openDialog({ kind: "import" }),
        },
        { label: "Export…", onSelect: () => actions.openDialog({ kind: "export" }) },
        {
          label: "Print…",
          onSelect: () => undefined,
          disabledReason: "Printing is not part of this demonstration; no output is produced.",
        },
        {
          label: "Close document",
          separatorBefore: true,
          onSelect: () => actions.requestReplace({ type: "close" }),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Undo",
          shortcut: "Ctrl/⌘ Z",
          onSelect: () => service.undo(),
          disabledReason: state.canUndo ? null : "Nothing to undo yet.",
        },
        {
          label: "Redo",
          shortcut: "Ctrl/⌘ ⇧ Z",
          onSelect: () => service.redo(),
          disabledReason: state.canRedo ? null : "Nothing to redo.",
        },
        {
          label: "Add rectangle",
          separatorBefore: true,
          onSelect: () => service.addShape("rectangle"),
        },
        { label: "Add text", onSelect: () => service.addShape("text") },
        {
          label: "Connect to next element",
          onSelect: () => service.connectSelected(),
          disabledReason: hasSelection ? null : noSelection,
        },
        {
          label: "Delete selection",
          shortcut: "Del",
          onSelect: () => service.removeSelected(),
          disabledReason: hasSelection ? null : noSelection,
        },
        {
          label: "Send invalid command (rejection test)",
          separatorBefore: true,
          onSelect: () =>
            actions.run("Invalid command", () =>
              service.execute({ type: "demo.invalid-command", reason: "rejection test" }),
            ),
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Zoom in", shortcut: "Ctrl/⌘ +", onSelect: () => actions.zoomBy(1) },
        { label: "Zoom out", shortcut: "Ctrl/⌘ −", onSelect: () => actions.zoomBy(-1) },
        { label: "Actual size", shortcut: "Ctrl/⌘ 0", onSelect: () => actions.setZoom(1) },
        {
          label: "Fit to content",
          onSelect: () => setUi((current) => ({ ...current, fitRequest: current.fitRequest + 1 })),
        },
        {
          label: ui.leftOpen ? "Hide structure panel" : "Show structure panel",
          separatorBefore: true,
          onSelect: () => setUi((current) => ({ ...current, leftOpen: !current.leftOpen })),
        },
        {
          label: ui.rightOpen ? "Hide side panel" : "Show side panel",
          onSelect: () => setUi((current) => ({ ...current, rightOpen: !current.rightOpen })),
        },
        {
          label: ui.prefs.theme === "dark" ? "Light theme" : "Dark theme",
          separatorBefore: true,
          onSelect: () =>
            setUi((current) => ({
              ...current,
              prefs: { ...current.prefs, theme: current.prefs.theme === "dark" ? "light" : "dark" },
            })),
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help", onSelect: () => actions.openDialog({ kind: "help" }) },
        {
          label: "Keyboard shortcuts",
          shortcut: "?",
          onSelect: () => actions.openDialog({ kind: "shortcuts" }),
        },
        { label: "Preferences…", onSelect: () => actions.openDialog({ kind: "preferences" }) },
        {
          label: "About & attribution",
          onSelect: () => actions.openDialog({ kind: "attribution" }),
        },
        {
          label: "Check for updates",
          onSelect: () => undefined,
          disabledReason: "Update checks need network access, which this demonstration never uses.",
        },
      ],
    },
  ];

  const onCanvasKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Keys typed into a control inside the canvas region (for example the empty-page buttons)
    // belong to that control, not to the diagram. Command shortcuts are handled globally.
    const target = event.target as HTMLElement;
    if (
      target !== event.currentTarget &&
      target.closest("button, a[href], input, select, textarea, [contenteditable]")
    )
      return;
    if (event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? ui.prefs.nudgeStep * 4 : ui.prefs.nudgeStep;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const isArrow = Object.prototype.hasOwnProperty.call(move, event.key);
    if (isArrow && event.altKey) {
      // Viewport pan: transient scroll only, never a document command.
      event.preventDefault();
      const direction = panDirections[event.key];
      const moved = canvasRef.current?.pan(direction, event.shiftKey) ?? false;
      if (!moved) actions.announce(`Canvas already at the ${direction} edge`);
      return;
    }
    // Remaining Alt combinations (Alt+[, Alt+Delete, …) are not canvas commands.
    if (event.altKey) return;
    if (isArrow) {
      event.preventDefault();
      if (!selected) return actions.explain(noSelection);
      const [dx, dy] = move[event.key];
      const { x, y } = selected.node.geometry;
      service.updateSelected({ x: x + dx, y: y + dy });
      return;
    }
    if (event.key === "[" || event.key === "]") {
      event.preventDefault();
      if (pageNodes.length === 0) return actions.explain("This page has no elements to select.");
      const index = pageNodes.findIndex((node) => node.nodeId === state.selection);
      const next =
        event.key === "]"
          ? (index + 1) % pageNodes.length
          : (index - 1 + pageNodes.length) % pageNodes.length;
      select(pageNodes[index === -1 && event.key === "[" ? pageNodes.length - 1 : next].nodeId);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (!selected) return actions.explain(noSelection);
      service.removeSelected();
      return;
    }
    if (event.key === "Escape" && state.selection) {
      event.preventDefault();
      select(null);
    }
  };

  const disconnected = !state.connected;
  const docTitle = doc.metadata.title;

  return (
    <div className="pc-workspace">
      <header className="pc-toolbar">
        <button
          type="button"
          className="pc-home-btn"
          aria-label="Go to home"
          onClick={() => setUi((current) => ({ ...current, view: "home" }))}
        >
          <img src={brandMark} alt="" width={24} height={24} />
        </button>
        <div className="pc-doc-title">
          <button
            type="button"
            className="pc-title-btn"
            aria-label={`Document title: ${docTitle}. Rename`}
            onClick={() => actions.openDialog({ kind: "rename" })}
          >
            {docTitle}
          </button>
          <SaveStatus />
        </div>
        <nav className="pc-menubar" aria-label="Application menus">
          {menus.map((menu) => (
            <Menu
              key={menu.label}
              label={menu.label}
              items={menu.items}
              onExplain={actions.explain}
            />
          ))}
        </nav>
        <div className="pc-toolbar-group" role="group" aria-label="History">
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Undo"
            aria-disabled={!state.canUndo}
            onClick={() =>
              state.canUndo ? service.undo() : actions.explain("Nothing to undo yet.")
            }
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Redo"
            aria-disabled={!state.canRedo}
            onClick={() => (state.canRedo ? service.redo() : actions.explain("Nothing to redo."))}
          >
            <Icon name="redo" />
          </button>
        </div>
        <div className="pc-toolbar-group" role="group" aria-label="Insert">
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Add rectangle"
            onClick={() => service.addShape("rectangle")}
          >
            <Icon name="rect" />
          </button>
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Add text"
            onClick={() => service.addShape("text")}
          >
            <Icon name="text" />
          </button>
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Connect selected element to the next element"
            aria-disabled={!hasSelection}
            onClick={() =>
              hasSelection ? service.connectSelected() : actions.explain(noSelection)
            }
          >
            <Icon name="connect" />
          </button>
        </div>
        <div className="pc-toolbar-spacer" />
        <div className="pc-toolbar-group" role="group" aria-label="Side panels">
          {(
            [
              ["inspector", "Inspector", "sliders"],
              ["history", "History", "history"],
              ["assistant", "Assistant", "chat"],
              ["collab", "Collaboration", "people"],
            ] as const
          ).map(([panel, label, icon]) => (
            <button
              key={panel}
              type="button"
              className="pc-icon-btn"
              data-panel-toggle={panel}
              aria-label={label}
              aria-pressed={ui.rightOpen && ui.rightPanel === panel}
              onClick={() =>
                setUi((current) =>
                  current.rightOpen && current.rightPanel === panel
                    ? { ...current, rightOpen: false }
                    : { ...current, rightOpen: true, rightPanel: panel },
                )
              }
            >
              <Icon name={icon} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pc-btn pc-btn-primary pc-save-btn"
          onClick={() => actions.run("Save", () => service.save())}
        >
          <Icon name="save" /> Save
        </button>
      </header>

      {state.role === "viewer" && (
        <p className="pc-role-strip" role="note">
          You are a simulated <strong>viewer</strong>. Edit controls stay visible so you can observe
          the service rejecting mutations.
        </p>
      )}

      <div className="pc-body">
        {ui.leftOpen && <LeftPanel onSelect={select} />}
        <main id="pc-main" className="pc-canvas-wrap" tabIndex={-1}>
          <h1 className="pc-sr-only">
            {docTitle} — {page?.name ?? "No page"}
          </h1>
          <p id={canvasHelpId} className="pc-sr-only">
            Projection of the document page. Click an element or press ] and [ to select; drag an
            element to move it, or use the arrow keys. Each move is validated by the document
            service when released. Delete removes the selection, Escape clears it. Alt (Option) with
            the arrow keys scrolls the view without changing the document; Shift scrolls further.
            The Outline panel lists the same structure.
          </p>
          <div
            className={`pc-canvas ${ui.prefs.showGrid ? "pc-grid" : ""}`}
            role="region"
            aria-label={`Diagram canvas, page ${page?.name ?? ""}`}
            aria-describedby={canvasHelpId}
            tabIndex={0}
            onKeyDown={onCanvasKey}
          >
            <WeaveCanvas
              ref={canvasRef}
              document={doc}
              pageId={page?.pageId ?? null}
              layerId={state.layerId}
              selection={state.selection}
              revision={state.revision}
              role={state.role}
              onMoveNode={moveNode}
              zoom={ui.zoom}
              fitRequest={ui.fitRequest}
              onSelect={select}
              onZoomChange={actions.setZoom}
              onStatusChange={setCanvasStatus}
            />
            {pageNodes.length === 0 && canvasStatus.state === "ready" && (
              <div className="pc-canvas-empty">
                <p>This page is empty.</p>
                <div>
                  <button
                    type="button"
                    className="pc-btn"
                    onClick={() => service.addShape("rectangle")}
                  >
                    Add rectangle
                  </button>
                  <button type="button" className="pc-btn" onClick={() => service.addShape("text")}>
                    Add text
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
        {ui.rightOpen && <RightPanel />}
      </div>

      <footer className="pc-statusbar" aria-label="Status">
        <div className="pc-status-group" role="group" aria-label="Pages">
          {doc.pages.map((p) => (
            <button
              key={p.pageId}
              type="button"
              className="pc-page-tab"
              aria-pressed={p.pageId === page?.pageId}
              onClick={() => {
                service.setPage(p.pageId);
                actions.announce(`Page ${p.name}`);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <span className="pc-status-item" data-testid="selection-status">
          {selected ? `Selected: ${nodeLabel(selected.node)}` : "No selection"}
        </span>
        <span className="pc-status-item">
          Revision {state.revision}
          {dirty ? " · unsaved" : ""}
        </span>
        <span className={`pc-status-item ${disconnected ? "pc-warn" : ""}`}>
          <span className="pc-dot" aria-hidden="true" />
          {state.connected ? "Peers connected (simulated)" : "Offline — local editing continues"}
        </span>
        <span className="pc-status-item">Role: {state.role}</span>
        <div className="pc-toolbar-spacer" />
        <div className="pc-status-group" role="group" aria-label="Zoom">
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Zoom out"
            onClick={() => actions.zoomBy(-1)}
          >
            <Icon name="minus" />
          </button>
          <button
            type="button"
            className="pc-zoom-value"
            aria-label={`Zoom ${Math.round(ui.zoom * 100)}%. Reset to 100%`}
            onClick={() => actions.setZoom(1)}
          >
            {Math.round(ui.zoom * 100)}%
          </button>
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Zoom in"
            onClick={() => actions.zoomBy(1)}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            className="pc-icon-btn"
            aria-label="Fit to content"
            onClick={() => setUi((current) => ({ ...current, fitRequest: current.fitRequest + 1 }))}
          >
            <Icon name="fit" />
          </button>
        </div>
      </footer>
    </div>
  );
}
