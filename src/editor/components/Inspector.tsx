import { useEffect, useRef, type FormEvent } from "react";
import { defaultAppearance } from "../../canvas/projection";
import type { Connection, Geometry, Node, Style } from "../../document";
import { useI18n } from "../../i18n";
import type { ConnectionDraft } from "./useEditorSession";

const geometryFields = [
  ["x", "editor.inspector.x"],
  ["y", "editor.inspector.y"],
  ["width", "editor.inspector.width"],
  ["height", "editor.inspector.height"],
] as const;

// Visible arrows are decorative; each button's accessible name is the complete translated phrase.
const directions = [
  { label: "editor.inspector.moveLeft", glyph: "←", x: -10, y: 0 },
  { label: "editor.inspector.moveUp", glyph: "↑", x: 0, y: -10 },
  { label: "editor.inspector.moveDown", glyph: "↓", x: 0, y: 10 },
  { label: "editor.inspector.moveRight", glyph: "→", x: 10, y: 0 },
] as const;

type Props = {
  /** Page and layer identity; a new-connector draft belongs to one page/layer. */
  contextKey: string;
  selected: Node | undefined;
  selectedName: string;
  selectedStyle: Style | undefined;
  selectedConnection: Connection | undefined;
  connectorStyle: Style | undefined;
  /** Candidate connector endpoints: nodes on the active page. */
  pageNodes: Node[];
  nodeLabel: (node: Node) => string;
  /** Changing this value discards an unsubmitted new-connector draft. */
  connectorDraftKey: number;
  /** True while a persistent error is shown; fields then reference it via `errorId`. */
  hasError: boolean;
  errorId: string;
  onApplyText: (text: string) => void;
  onApplyGeometry: (geometry: Geometry) => void;
  onSubmitConnection: (draft: ConnectionDraft) => void;
  onDelete: () => void;
};

/** Properties for the current node, connection, or empty selection. Apply buttons commit drafts. */
export default function Inspector(props: Props) {
  const { t, formatNumber } = useI18n();
  const { selected, selectedStyle, selectedConnection, connectorStyle, hasError } = props;
  const textForm = useRef<HTMLFormElement>(null);
  const geometryForm = useRef<HTMLFormElement>(null);
  const connectionForm = useRef<HTMLFormElement>(null);
  const describedBy = hasError ? props.errorId : undefined;

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

  const none = t("editor.inspector.none");

  function applyGeometry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const fields = new FormData(event.currentTarget);
    props.onApplyGeometry({
      ...selected.geometry,
      x: Number(fields.get("x")),
      y: Number(fields.get("y")),
      width: Number(fields.get("width")),
      height: Number(fields.get("height")),
    });
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    props.onSubmitConnection({
      source: String(fields.get("source")),
      target: String(fields.get("target")),
      label: String(fields.get("label") ?? ""),
    });
  }

  if (selected) {
    return (
      <>
        <p className="pc-selection-title">
          {props.selectedName}
          <span>
            {t(
              selected.type === "text"
                ? "editor.inspector.type.text"
                : "editor.inspector.type.rectangle",
            )}
          </span>
        </p>
        <dl className="pc-style-summary" aria-label={t("editor.inspector.appearance")}>
          <dt>{t("editor.inspector.fill")}</dt>
          <dd>
            {selected.type === "text"
              ? none
              : selectedStyle
                ? (selectedStyle.fill ?? none)
                : defaultAppearance.fill}
          </dd>
          <dt>{t("editor.inspector.stroke")}</dt>
          <dd>
            {selected.type === "text"
              ? none
              : selectedStyle
                ? (selectedStyle.stroke ?? none)
                : defaultAppearance.stroke}
          </dd>
          <dt>{t("editor.inspector.strokeWidth")}</dt>
          <dd>{formatNumber(selectedStyle?.strokeWidth ?? defaultAppearance.strokeWidth)}</dd>
          <dt>{t("editor.inspector.textColor")}</dt>
          <dd>{selectedStyle?.textColor ?? defaultAppearance.textColor}</dd>
          <dt>{t("editor.inspector.fontSize")}</dt>
          <dd>{formatNumber(selectedStyle?.fontSize ?? defaultAppearance.fontSize)}</dd>
        </dl>
        <form
          ref={textForm}
          className="pc-section"
          onSubmit={(event) => {
            event.preventDefault();
            props.onApplyText(String(new FormData(event.currentTarget).get("text")));
          }}
        >
          <div className="pc-field">
            <label htmlFor="node-text">{t("editor.inspector.text")}</label>
            <input
              id="node-text"
              name="text"
              defaultValue={selected.text}
              aria-describedby={describedBy}
            />
          </div>
          <button className="pc-btn pc-btn--block" type="submit">
            {t("editor.inspector.applyText")}
          </button>
        </form>
        <form ref={geometryForm} className="pc-section" onSubmit={applyGeometry}>
          <fieldset>
            <legend>{t("editor.inspector.positionSize")}</legend>
            <div className="pc-geometry-grid">
              {geometryFields.map(([field, label]) => (
                <label key={field} htmlFor={`geometry-${field}`}>
                  {t(label)}
                  <input
                    id={`geometry-${field}`}
                    name={field}
                    type="number"
                    step="any"
                    required
                    defaultValue={selected.geometry[field]}
                    aria-describedby={describedBy}
                    aria-invalid={hasError}
                  />
                </label>
              ))}
            </div>
            <button type="submit" className="pc-btn pc-primary pc-btn--primary pc-btn--block">
              {t("editor.inspector.applyGeometry")}
            </button>
          </fieldset>
        </form>
        <div className="pc-move-controls" role="group" aria-label={t("editor.inspector.moveGroup")}>
          {directions.map((direction) => (
            <button
              key={direction.label}
              type="button"
              className="pc-btn pc-icon-btn"
              aria-label={t(direction.label)}
              title={t(direction.label)}
              onClick={() =>
                props.onApplyGeometry({
                  ...selected.geometry,
                  x: selected.geometry.x + direction.x,
                  y: selected.geometry.y + direction.y,
                })
              }
            >
              <span aria-hidden="true">{direction.glyph}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pc-btn pc-delete pc-btn--danger pc-btn--block"
          onClick={props.onDelete}
        >
          {t("editor.inspector.deleteElement")}
        </button>
      </>
    );
  }

  return (
    <>
      {!selectedConnection && <p className="pc-hint">{t("editor.inspector.noSelection")}</p>}
      <form
        ref={connectionForm}
        key={`${props.contextKey}:${selectedConnection?.connectionId ?? `new-${props.connectorDraftKey}`}`}
        onSubmit={submitConnection}
        className="pc-section pc-connection-form"
      >
        <fieldset>
          <legend>
            {t(selectedConnection ? "editor.connector.properties" : "editor.connector.connect")}
          </legend>
          <div className="pc-field">
            <label htmlFor="connection-source">{t("editor.connector.source")}</label>
            <select
              id="connection-source"
              aria-describedby={describedBy}
              aria-invalid={hasError}
              name="source"
              defaultValue={selectedConnection?.sourceNodeId ?? props.pageNodes[0]?.nodeId}
              required
            >
              {props.pageNodes.map((node) => (
                <option key={node.nodeId} value={node.nodeId}>
                  {props.nodeLabel(node)}
                </option>
              ))}
            </select>
          </div>
          <div className="pc-field">
            <label htmlFor="connection-target">{t("editor.connector.target")}</label>
            <select
              id="connection-target"
              aria-describedby={describedBy}
              aria-invalid={hasError}
              name="target"
              defaultValue={selectedConnection?.targetNodeId ?? props.pageNodes[1]?.nodeId}
              required
            >
              {props.pageNodes.map((node) => (
                <option key={node.nodeId} value={node.nodeId}>
                  {props.nodeLabel(node)}
                </option>
              ))}
            </select>
          </div>
          <div className="pc-field">
            <label htmlFor="connection-label">{t("editor.connector.label")}</label>
            <input
              id="connection-label"
              name="label"
              defaultValue={selectedConnection?.label ?? ""}
              aria-describedby={describedBy}
            />
          </div>
          <p className="pc-hint">
            {t("editor.connector.style", {
              stroke: connectorStyle?.stroke ?? defaultAppearance.stroke,
              width: connectorStyle?.strokeWidth ?? defaultAppearance.strokeWidth,
            })}
          </p>
          <p className="pc-hint">{t("editor.connector.routing")}</p>
          {props.pageNodes.length < 2 && <p className="pc-hint">{t("editor.connector.needTwo")}</p>}
          <button
            className="pc-btn pc-primary pc-btn--primary pc-btn--block"
            type="submit"
            disabled={!selectedConnection && props.pageNodes.length < 2}
          >
            {t(selectedConnection ? "editor.connector.apply" : "editor.connector.add")}
          </button>
        </fieldset>
        {selectedConnection && (
          <button
            className="pc-btn pc-delete pc-btn--danger pc-btn--block"
            type="button"
            onClick={props.onDelete}
          >
            {t("editor.connector.delete")}
          </button>
        )}
      </form>
    </>
  );
}
