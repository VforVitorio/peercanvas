import { useId, useState } from "react";
import { useDemo } from "./context";
import Icon from "./Icon";
import ProposalCard from "./ProposalCard";

const commandLabels: Record<string, string> = {
  "document.setMetadata": "Rename document",
  "node.add": "Add element",
  "node.update": "Edit element",
  "node.remove": "Delete element",
  "connection.add": "Connect elements",
  "connection.remove": "Remove connection",
  "page.add": "Add page",
  "page.rename": "Rename page",
  "page.remove": "Remove page",
  "layer.add": "Add layer",
  "layer.rename": "Rename layer",
  "layer.remove": "Remove layer",
  "style.put": "Change style",
  batch: "Grouped edit",
};

const originLabels: Record<string, string> = {
  ui: "You",
  history: "Undo/redo",
  assistant: "Assistant (approved)",
  mcp: "MCP (approved)",
  import: "Import (approved)",
};
import {
  currentPage,
  findNode,
  nodeLabel,
  styleFor,
  type DocNode,
  type RightPanel as PanelId,
} from "./types";

const titles: Record<PanelId, string> = {
  inspector: "Inspector",
  history: "History",
  assistant: "Assistant & MCP",
  collab: "Collaboration",
};

type Field = "text" | "x" | "y" | "width" | "height" | "fill";

function InspectorForm({ node, fill }: { node: DocNode; fill: string }) {
  const { service, actions } = useDemo();
  const base = useId();
  const initial = {
    text: node.text ?? "",
    x: String(node.geometry.x),
    y: String(node.geometry.y),
    width: String(node.geometry.width),
    height: String(node.geometry.height),
    fill,
  };
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<Field, string>> = {};
    const patch: {
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fill?: string;
    } = {};
    for (const key of ["x", "y", "width", "height"] as const) {
      const value = Number(draft[key]);
      if (draft[key].trim() === "" || !Number.isFinite(value)) nextErrors[key] = "Enter a number.";
      else if ((key === "width" || key === "height") && value <= 0)
        nextErrors[key] = "Must be greater than 0.";
      else if (value !== node.geometry[key]) patch[key] = value;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.fill)) nextErrors.fill = "Use a #RRGGBB colour.";
    else if (draft.fill.toLowerCase() !== fill.toLowerCase()) patch.fill = draft.fill;
    if (draft.text !== (node.text ?? "")) patch.text = draft.text;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      actions.announce("Some properties are invalid. Fix the highlighted fields.");
      return;
    }
    if (Object.keys(patch).length === 0) {
      actions.explain("No property changed.");
      return;
    }
    service.updateSelected(patch);
  };

  const field = (key: Exclude<Field, "fill" | "text">, label: string) => (
    <div className="pc-field">
      <label htmlFor={`${base}-${key}`}>{label}</label>
      <input
        id={`${base}-${key}`}
        inputMode="decimal"
        value={draft[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${base}-${key}-error` : undefined}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
      />
      {errors[key] && (
        <span id={`${base}-${key}-error`} className="pc-field-error">
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <form className="pc-inspector-form" onSubmit={submit} aria-label="Element properties">
      <div className="pc-field pc-field-wide">
        <label htmlFor={`${base}-text`}>Label text</label>
        <input
          id={`${base}-text`}
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
        />
      </div>
      <div className="pc-field-grid">
        {field("x", "X")}
        {field("y", "Y")}
        {field("width", "Width")}
        {field("height", "Height")}
      </div>
      <div className="pc-field pc-field-wide">
        <label htmlFor={`${base}-fill`}>Fill</label>
        <div className="pc-color-row">
          <input
            type="color"
            aria-label="Fill colour picker"
            value={/^#[0-9a-fA-F]{6}$/.test(draft.fill) ? draft.fill : "#ffffff"}
            onChange={(event) => setDraft((current) => ({ ...current, fill: event.target.value }))}
          />
          <input
            id={`${base}-fill`}
            value={draft.fill}
            aria-invalid={errors.fill ? true : undefined}
            aria-describedby={errors.fill ? `${base}-fill-error` : undefined}
            onChange={(event) => setDraft((current) => ({ ...current, fill: event.target.value }))}
          />
        </div>
        {errors.fill && (
          <span id={`${base}-fill-error`} className="pc-field-error">
            {errors.fill}
          </span>
        )}
      </div>
      <div className="pc-row">
        <button type="submit" className="pc-btn pc-btn-primary">
          Apply changes
        </button>
        <button
          type="button"
          className="pc-btn"
          onClick={() => {
            setDraft(initial);
            setErrors({});
          }}
        >
          Revert
        </button>
      </div>
    </form>
  );
}

function Inspector() {
  const { state, service } = useDemo();
  const doc = state.document;
  const found = findNode(doc, state.selection);
  if (!doc) return null;
  if (!found) {
    const page = currentPage(doc, state.pageId);
    const elements = page?.layers.reduce((sum, layer) => sum + layer.nodes.length, 0) ?? 0;
    return (
      <div className="pc-inspector-empty">
        <p>No element selected.</p>
        <p className="pc-muted pc-small">
          Select on the canvas, in the Outline panel, or focus the canvas and press ].
        </p>
        <dl className="pc-facts">
          <dt>Document</dt>
          <dd>{doc.metadata.title}</dd>
          <dt>Page</dt>
          <dd>{page?.name}</dd>
          <dt>Elements on page</dt>
          <dd>{elements}</dd>
          <dt>Pages</dt>
          <dd>{doc.pages.length}</dd>
          <dt>File name</dt>
          <dd>{state.filename ?? "Not saved (simulated)"}</dd>
        </dl>
      </div>
    );
  }
  const style = styleFor(doc, found.node.styleId);
  return (
    <div>
      <p className="pc-inspector-heading">
        <Icon name={found.node.type === "text" ? "text" : "rect"} /> {nodeLabel(found.node)}
        <span className="pc-muted pc-small"> · layer {found.layer.name}</span>
      </p>
      <InspectorForm
        key={`${found.node.nodeId}:${state.revision}`}
        node={found.node}
        fill={style?.fill ?? "#ffffff"}
      />
      <div className="pc-row pc-row-sep">
        <button type="button" className="pc-btn" onClick={() => service.connectSelected()}>
          <Icon name="connect" /> Connect to next
        </button>
        <button
          type="button"
          className="pc-btn pc-btn-danger"
          onClick={() => service.removeSelected()}
        >
          <Icon name="trash" /> Delete
        </button>
      </div>
    </div>
  );
}

function History() {
  const { state, service, actions } = useDemo();
  return (
    <div>
      <div className="pc-row">
        <button
          type="button"
          className="pc-btn"
          aria-disabled={!state.canUndo}
          onClick={() => (state.canUndo ? service.undo() : actions.explain("Nothing to undo yet."))}
        >
          <Icon name="undo" /> Undo
        </button>
        <button
          type="button"
          className="pc-btn"
          aria-disabled={!state.canRedo}
          onClick={() => (state.canRedo ? service.redo() : actions.explain("Nothing to redo."))}
        >
          <Icon name="redo" /> Redo
        </button>
      </div>
      {state.history.length === 0 ? (
        <p className="pc-muted pc-small">No accepted commands yet in this session.</p>
      ) : (
        <ol className="pc-history" aria-label="Accepted commands, oldest first">
          {state.history.map((entry) => (
            <li key={entry.id}>
              <span>{commandLabels[entry.label] ?? entry.label}</span>
              <span className="pc-tag">{originLabels[entry.origin] ?? entry.origin}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function OperationInline({ kind }: { kind: "assistant" | "mcp" }) {
  const { state, service } = useDemo();
  const op = state.operation;
  if (!op || op.kind !== kind) return null;
  const active = op.status === "running" || op.status === "waiting";
  return (
    <div className={`pc-op-inline pc-op-${op.status}`} role="status">
      <p>
        <strong>
          {op.status === "error"
            ? "Error"
            : op.status === "cancelled"
              ? "Cancelled"
              : op.status === "done"
                ? "Done"
                : op.status === "waiting"
                  ? "Waiting"
                  : "Working"}
        </strong>{" "}
        — {op.message} <span className="pc-muted">(simulated)</span>
      </p>
      {active && (
        <progress max={100} value={op.progress} aria-label={`${kind} progress`}>
          {op.progress}%
        </progress>
      )}
      <div className="pc-row">
        {op.status === "waiting" && (
          <button
            type="button"
            className="pc-btn pc-btn-small"
            onClick={() => service.finishWaiting()}
          >
            Continue
          </button>
        )}
        {active && (
          <button
            type="button"
            className="pc-btn pc-btn-small"
            onClick={() => service.cancelOperation()}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Assistant() {
  const { state, service, ui, setUi, actions } = useDemo();
  const [text, setText] = useState("");
  const inputId = useId();
  const source = ui.assistantSource;
  const messages = state.messages.filter((message) => message.source === source);
  const proposal = state.proposal;
  const busy =
    state.operation?.kind === source &&
    (state.operation.status === "running" || state.operation.status === "waiting");

  return (
    <div className="pc-assistant">
      <div className="pc-segmented" role="radiogroup" aria-label="Conversation source">
        {(
          [
            ["assistant", "Assistant"],
            ["mcp", "MCP client"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={source === value}
            className="pc-seg"
            onClick={() => setUi((current) => ({ ...current, assistantSource: value }))}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="pc-muted pc-small">
        {source === "assistant"
          ? "Simulated assistant. No provider, account, or network request is used."
          : "Simulated MCP client session. No MCP server is running."}
      </p>

      <ol className="pc-messages" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 && <li className="pc-muted pc-small">No messages yet.</li>}
        {messages.map((message) => (
          <li key={message.id} className={`pc-msg pc-msg-${message.role}`}>
            <span className="pc-msg-role">
              {message.role === "user"
                ? "You"
                : message.role === "system"
                  ? "System"
                  : source === "mcp"
                    ? "MCP client"
                    : "Assistant"}
            </span>
            {message.text}
          </li>
        ))}
      </ol>

      <OperationInline kind={source} />

      {proposal && proposal.source !== "import" && <ProposalCard proposal={proposal} />}

      <form
        className="pc-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim();
          if (!value) return actions.explain("Type a message first.");
          service.sendMessage(value, source);
          setText("");
        }}
      >
        <label htmlFor={inputId}>Message</label>
        <textarea
          id={inputId}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="pc-row">
          <button type="submit" className="pc-btn">
            Send
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-primary"
            aria-disabled={busy}
            onClick={() =>
              busy
                ? actions.explain("A simulated request is already in progress. Cancel it or wait.")
                : service.startOperation(source)
            }
          >
            Request proposal
          </button>
        </div>
      </form>
    </div>
  );
}

function Collaboration() {
  const { state, service, actions } = useDemo();
  return (
    <div className="pc-collab">
      <section className="pc-card-inline" aria-label="Connection">
        <p>
          <span
            className={`pc-dot ${state.connected ? "pc-dot-ok" : "pc-dot-warn"}`}
            aria-hidden="true"
          />
          {state.connected ? "Connected to simulated peers" : "Disconnected (simulated)"}
        </p>
        <p className="pc-muted pc-small">
          No network transport exists in this demo. Local editing always continues.
        </p>
        <button
          type="button"
          className="pc-btn pc-btn-small"
          onClick={() => service.toggleConnection()}
        >
          {state.connected ? "Simulate disconnect" : "Simulate reconnect"}
        </button>
      </section>

      <fieldset className="pc-fieldset">
        <legend>Your simulated role</legend>
        {(["editor", "viewer"] as const).map((role) => (
          <label key={role} className="pc-radio">
            <input
              type="radio"
              name="pc-role"
              checked={state.role === role}
              onChange={() => {
                service.setRole(role);
                actions.announce(`Your simulated role is now ${role}.`);
              }}
            />
            {role === "editor"
              ? "Editor (can change the document)"
              : "Viewer (mutations are rejected)"}
          </label>
        ))}
      </fieldset>

      <section aria-label="Invitation">
        <button type="button" className="pc-btn" onClick={() => service.invite()}>
          Create invitation
        </button>
        {state.invitation && (
          <div className="pc-invite">
            <code>{state.invitation}</code>
            <span className="pc-tag pc-tag-warn">Fictional — cannot be used</span>
          </div>
        )}
      </section>

      <h3 className="pc-subheading">Participants</h3>
      <ul className="pc-participants">
        {state.participants.length === 0 && <li className="pc-muted pc-small">Only you.</li>}
        {state.participants.map((person) => (
          <li key={person.id}>
            <span className="pc-avatar" aria-hidden="true">
              {person.name.slice(0, 1)}
            </span>
            <span className="pc-person">
              <span>{person.name}</span>
              <span className="pc-muted pc-small">
                {person.role} · {person.status}
              </span>
            </span>
            {person.status === "pending" ? (
              <span className="pc-row">
                <button
                  type="button"
                  className="pc-btn pc-btn-small"
                  onClick={() => service.admit(person.id, "editor")}
                  aria-label={`Admit ${person.name} as editor`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  className="pc-btn pc-btn-small"
                  onClick={() => service.admit(person.id, "viewer")}
                  aria-label={`Admit ${person.name} as viewer`}
                >
                  Viewer
                </button>
                <button
                  type="button"
                  className="pc-btn pc-btn-small pc-btn-danger"
                  onClick={() => service.deny(person.id)}
                  aria-label={`Deny ${person.name}`}
                >
                  Deny
                </button>
              </span>
            ) : person.role !== "host" ? (
              <button
                type="button"
                className="pc-btn pc-btn-small"
                onClick={() => service.revoke(person.id)}
                aria-label={`Revoke access for ${person.name}`}
              >
                Revoke
              </button>
            ) : (
              <span className="pc-tag">Host</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RightPanel() {
  const { ui, setUi } = useDemo();
  const panel = ui.rightPanel;
  return (
    <aside className="pc-panel pc-panel-right" aria-labelledby="pc-right-title">
      <header className="pc-panel-header">
        <h2 id="pc-right-title">{titles[panel]}</h2>
        <button
          type="button"
          className="pc-icon-btn"
          aria-label={`Close ${titles[panel]} panel`}
          onClick={() => {
            setUi((current) => ({ ...current, rightOpen: false }));
            // Return focus to the toolbar toggle so keyboard users are not dropped to <body>.
            queueMicrotask(() =>
              document.querySelector<HTMLElement>(`[data-panel-toggle="${panel}"]`)?.focus(),
            );
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="pc-icon">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <div className="pc-panel-body">
        {panel === "inspector" && <Inspector />}
        {panel === "history" && <History />}
        {panel === "assistant" && <Assistant />}
        {panel === "collab" && <Collaboration />}
      </div>
    </aside>
  );
}
