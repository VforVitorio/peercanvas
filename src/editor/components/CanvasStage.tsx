import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";
import WeaveCanvas from "../../canvas/WeaveCanvas";
import type { Document, Geometry } from "../../document";
import { useI18n } from "../../i18n";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

type Props = {
  document: Document;
  pageId: string;
  layerId: string;
  pageName: string;
  layerName: string;
  selection: string | null;
  connectionSelection: string | null;
  zoom: number;
  fitRequest: number;
  regionRef: Ref<HTMLDivElement>;
  /** Set while an open drawer owns the keyboard path. */
  inert?: boolean;
  /** Optional controls around the page/layer context, such as drawer toggles. */
  contextStart?: ReactNode;
  contextEnd?: ReactNode;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  onSelect: (nodeId: string | null) => void;
  onCommitGeometry: (nodeId: string, geometry: Geometry) => boolean;
  onRegionKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
};

function preventAltDragClone(event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
  // shortcut: Alt-drag cloning stays disabled until clones have canonical commands.
  const isMove = event.type === "pointermove" || event.type === "mousemove";
  if (!event.altKey || (isMove && event.buttons === 0)) return;
  event.preventDefault();
  event.stopPropagation();
}

/** Canvas chrome: page/layer context above, the disposable Weave projection, zoom/fit below. */
export default function CanvasStage(props: Props) {
  const { t } = useI18n();
  const { zoom } = props;
  return (
    <section
      className="pc-canvas-panel"
      aria-label={t("editor.canvas.workspace")}
      {...(props.inert ? { inert: "" } : {})}
    >
      <div className="pc-canvas-context">
        {props.contextStart}
        <span className="pc-canvas-context-label">
          {t("editor.canvas.context", { page: props.pageName, layer: props.layerName })}
        </span>
        {props.contextEnd}
      </div>
      <div
        ref={props.regionRef}
        className="pc-canvas-region"
        role="region"
        aria-label={t("editor.canvas.region")}
        aria-describedby="keyboard-help"
        tabIndex={0}
        onKeyDownCapture={props.onRegionKeyDownCapture}
        onPointerDownCapture={preventAltDragClone}
        onPointerMoveCapture={preventAltDragClone}
        onMouseDownCapture={preventAltDragClone}
        onMouseMoveCapture={preventAltDragClone}
      >
        <WeaveCanvas
          document={props.document}
          pageId={props.pageId}
          layerId={props.layerId}
          selection={props.selection}
          connectionSelection={props.connectionSelection}
          zoom={zoom}
          fitRequest={props.fitRequest}
          onSelect={props.onSelect}
          onZoomChange={props.onZoomChange}
          onCommitGeometry={props.onCommitGeometry}
        />
      </div>
      <div className="pc-canvas-footer">
        <p id="keyboard-help" className="pc-visually-hidden">
          {t("editor.canvas.keyboardHelp")}
        </p>
        <div className="pc-zoom-controls" role="group" aria-label={t("editor.canvas.zoomGroup")}>
          <button
            type="button"
            className="pc-btn"
            aria-label={t("editor.canvas.zoomOut")}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => props.onZoomChange(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
          >
            <span className="pc-zoom-icon" aria-hidden="true" />
          </button>
          <output aria-label={t("editor.canvas.zoomLevel")}>
            {t("editor.canvas.zoomPercent", { value: Math.round(zoom * 100) })}
          </output>
          <button
            type="button"
            className="pc-btn"
            aria-label={t("editor.canvas.zoomIn")}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => props.onZoomChange(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
          >
            <span className="pc-zoom-icon pc-zoom-in-icon" aria-hidden="true" />
          </button>
          <button type="button" className="pc-btn" onClick={props.onFit}>
            {t("editor.canvas.fit")}
          </button>
        </div>
      </div>
    </section>
  );
}
