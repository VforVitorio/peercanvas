import { useEffect, useRef, type FormEvent, type Ref } from "react";
import type { Document, Layer, Node, Page } from "../../document";
import { useI18n } from "../../i18n";

type Props = {
  document: Document;
  page: Page;
  layer: Layer;
  pageNodes: Node[];
  selection: string | null;
  connectionSelection: string | null;
  errorId: string;
  hasError: boolean;
  elementsHeadingRef: Ref<HTMLHeadingElement>;
  /** Display name for a node: its own text, else a localized type label. */
  nodeLabel: (node: Node) => string;
  onChangePage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: (name: string) => void;
  onChangeLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onRenameLayer: (name: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onNewConnector: () => void;
};

const nameFrom = (event: FormEvent<HTMLFormElement>) =>
  String(new FormData(event.currentTarget).get("name"));

/** Pages, layers, elements, and connections in canonical order. Renames use Apply-style forms. */
export default function StructurePanel(props: Props) {
  const { t, formatNumber } = useI18n();
  const { page, layer, hasError } = props;
  const pageNameForm = useRef<HTMLFormElement>(null);
  const layerNameForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    pageNameForm.current?.reset();
  }, [page.pageId, page.name]);
  useEffect(() => {
    layerNameForm.current?.reset();
  }, [layer.layerId, layer.name]);
  const describedBy = hasError ? props.errorId : undefined;

  return (
    <div className="pc-structure" role="group" aria-label={t("editor.structure.label")}>
      <section className="pc-section">
        <div className="pc-field">
          <label htmlFor="active-page">{t("editor.structure.page")}</label>
          <select
            id="active-page"
            value={page.pageId}
            onChange={(event) => props.onChangePage(event.target.value)}
          >
            {props.document.pages.map((value) => (
              <option key={value.pageId} value={value.pageId}>
                {value.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="pc-btn pc-btn--block" onClick={props.onAddPage}>
          {t("editor.structure.addPage")}
        </button>
        <form
          ref={pageNameForm}
          className="pc-field"
          onSubmit={(event) => {
            event.preventDefault();
            props.onRenamePage(nameFrom(event));
          }}
        >
          <label htmlFor="page-name">{t("editor.structure.pageName")}</label>
          <div className="pc-field-row">
            <input
              id="page-name"
              name="name"
              aria-describedby={describedBy}
              aria-invalid={hasError}
              required
              defaultValue={page.name}
            />
            <button className="pc-btn" type="submit">
              {t("editor.structure.renamePage")}
            </button>
          </div>
        </form>
      </section>
      <section className="pc-section">
        <div className="pc-field">
          <label htmlFor="active-layer">{t("editor.structure.layer")}</label>
          <select
            id="active-layer"
            value={layer.layerId}
            onChange={(event) => props.onChangeLayer(event.target.value)}
          >
            {page.layers.map((value) => (
              <option key={value.layerId} value={value.layerId}>
                {value.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="pc-btn pc-btn--block" onClick={props.onAddLayer}>
          {t("editor.structure.addLayer")}
        </button>
        <form
          ref={layerNameForm}
          className="pc-field"
          onSubmit={(event) => {
            event.preventDefault();
            props.onRenameLayer(nameFrom(event));
          }}
        >
          <label htmlFor="layer-name">{t("editor.structure.layerName")}</label>
          <div className="pc-field-row">
            <input
              id="layer-name"
              name="name"
              aria-describedby={describedBy}
              aria-invalid={hasError}
              required
              defaultValue={layer.name}
            />
            <button className="pc-btn" type="submit">
              {t("editor.structure.renameLayer")}
            </button>
          </div>
        </form>
      </section>
      <section className="pc-section" aria-labelledby="outline-heading">
        <h2
          id="outline-heading"
          className="pc-section-title"
          ref={props.elementsHeadingRef}
          tabIndex={-1}
        >
          {t("editor.structure.elements")}{" "}
          <span className="pc-count">{formatNumber(layer.nodes.length)}</span>
        </h2>
        <p className="pc-hint">
          {t("editor.canvas.context", { page: page.name, layer: layer.name })}
        </p>
        <ul className="pc-list" aria-label={t("editor.structure.elementsList")}>
          {layer.nodes.map((node) => (
            <li key={node.nodeId}>
              <button
                type="button"
                className="pc-list-item"
                aria-pressed={props.selection === node.nodeId}
                onClick={() => props.onSelectNode(node.nodeId)}
              >
                <span className="pc-list-symbol" aria-hidden="true" />
                <span className="pc-list-label">{props.nodeLabel(node)}</span>
              </button>
            </li>
          ))}
        </ul>
        {layer.nodes.length === 0 && <p className="pc-empty">{t("editor.structure.noElements")}</p>}
      </section>
      <section className="pc-section" aria-labelledby="connections-heading">
        <h2 id="connections-heading" className="pc-section-title">
          {t("editor.structure.connections")}{" "}
          <span className="pc-count">{formatNumber(layer.connections.length)}</span>
        </h2>
        <ul className="pc-list" aria-label={t("editor.structure.connectionsList")}>
          {layer.connections.map((connection) => {
            const source = props.pageNodes.find((node) => node.nodeId === connection.sourceNodeId);
            const target = props.pageNodes.find((node) => node.nodeId === connection.targetNodeId);
            return (
              <li key={connection.connectionId}>
                <button
                  type="button"
                  className="pc-list-item"
                  aria-pressed={props.connectionSelection === connection.connectionId}
                  onClick={() => props.onSelectConnection(connection.connectionId)}
                >
                  <span className="pc-list-label">
                    {connection.label ||
                      t("editor.connector.defaultName", {
                        source: source ? props.nodeLabel(source) : t("editor.defaults.shape"),
                        target: target ? props.nodeLabel(target) : t("editor.defaults.shape"),
                      })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {layer.connections.length === 0 && (
          <p className="pc-empty">{t("editor.structure.noConnections")}</p>
        )}
        <button type="button" className="pc-btn pc-btn--block" onClick={props.onNewConnector}>
          {t("editor.structure.newConnector")}
        </button>
      </section>
    </div>
  );
}
