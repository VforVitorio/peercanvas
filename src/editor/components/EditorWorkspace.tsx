import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Node } from "../../document";
import { useI18n } from "../../i18n";
import { usePreferences } from "../../preferences/PreferencesProvider";
import DrawioReviewDialog, { type DrawioReview } from "../DrawioReviewDialog";
import UnsavedChangesDialog from "../UnsavedChangesDialog";
import CanvasStage from "./CanvasStage";
import EditorHeader, { type DocumentState } from "./EditorHeader";
import type { FileMenuItem } from "./FileMenu";
import HelpDialog from "./HelpDialog";
import Inspector from "./Inspector";
import NavigationTabs from "./NavigationTabs";
import PreferencesDialog from "./PreferencesDialog";
import ShapesPanel from "./ShapesPanel";
import StructurePanel from "./StructurePanel";
import { useFormatMessage } from "./useFormatMessage";
import { nodeName, useEditorSession } from "./useEditorSession";
import { useResponsiveLayout, type DrawerSide } from "./useResponsiveLayout";

const ERROR_ID = "editor-error";
const LEFT_PANEL_ID = "pc-left-panel";
const RIGHT_PANEL_ID = "pc-inspector";
type NavigationTab = "shapes" | "structure";
type Overlay = "help" | "preferences" | null;

const inert = (value: boolean) => (value ? { inert: "" } : {});

/** True when an element can receive focus: rendered, not hidden, and not inside an inert subtree. */
function canFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element?.isConnected && !element.closest("[hidden], [inert]"));
}

/**
 * Production editor composition. Document state, commands, and history live in
 * useEditorSession; this component arranges the header, navigation, canvas, inspector, overlays,
 * and responsive drawers around it.
 */
export default function EditorWorkspace() {
  const session = useEditorSession();
  const layout = useResponsiveLayout();
  const format = useFormatMessage();
  const { t, message } = useI18n();
  const preferences = usePreferences();
  const { documents, page, layer, editingLocked } = session;
  const [tab, setTab] = useState<NavigationTab>("shapes");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [connectorDraftKey, setConnectorDraftKey] = useState(0);
  const elementsHeading = useRef<HTMLHeadingElement>(null);
  const canvasRegion = useRef<HTMLDivElement>(null);
  const panels = useRef<Record<DrawerSide, HTMLElement | null>>({ left: null, right: null });

  const errorText = format(session.error);
  const hasError = errorText !== "";
  const label = (node: Node) => {
    const name = nodeName(node);
    return typeof name === "object" ? format(name) : String(name);
  };

  const openSide: DrawerSide | null = layout.isOpen("left")
    ? "left"
    : layout.isOpen("right")
      ? "right"
      : null;

  // Move focus into a drawer when it opens so the keyboard path stays inside it.
  useEffect(() => {
    if (!openSide) return;
    const panel = panels.current[openSide];
    panel?.querySelector<HTMLElement>(".pc-panel-close")?.focus();
  }, [openSide]);

  function focusAfterRemoval() {
    const heading = elementsHeading.current;
    if (canFocus(heading)) heading.focus();
    else canvasRegion.current?.focus();
  }

  function removeFromInspector() {
    if (session.removeSelected()) focusAfterRemoval();
  }

  /** Canvas keyboard editing: active only while focus is inside the canvas region. */
  function onCanvasKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
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
      // Focus stays on the canvas so keyboard editing can continue.
      if (!event.ctrlKey && !event.metaKey) session.removeSelected();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      session.select(null);
      return;
    }
    const selected = session.selected;
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
    session.commitGeometry(
      selected.nodeId,
      event.altKey
        ? { ...geometry, width: geometry.width + dx, height: geometry.height + dy }
        : { ...geometry, x: geometry.x + dx, y: geometry.y + dy },
    );
  }

  function onDrawerKeyDown(side: DrawerSide, event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !layout.isDrawer(side) || !layout.isOpen(side)) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    layout.closeDrawer();
  }

  const fileActionsLocked = editingLocked || session.renamingDocument;
  const nativeActionsDisabled = !documents.available || fileActionsLocked;
  const fileItems: FileMenuItem[] = [
    {
      id: "new",
      label: t("documents.menu.new"),
      shortcut: "Mod+N",
      disabled: fileActionsLocked,
      onSelect: documents.newDocument,
    },
    {
      id: "open",
      label: t("documents.menu.open"),
      shortcut: "Mod+O",
      disabled: nativeActionsDisabled,
      onSelect: documents.openDocument,
    },
    {
      id: "reopen",
      label: t("documents.menu.reopen"),
      title: documents.recentName
        ? t("documents.menu.reopenNamed", { name: documents.recentName })
        : t("documents.menu.noRecent"),
      disabled: nativeActionsDisabled || !documents.recentName,
      onSelect: documents.reopenLast,
    },
    { id: "separator-save", separator: true },
    {
      id: "save",
      label: t("documents.menu.save"),
      shortcut: "Mod+S",
      disabled: nativeActionsDisabled,
      onSelect: () => void documents.saveDocument(),
    },
    {
      id: "save-as",
      label: t("documents.menu.saveAs"),
      shortcut: "Mod+Shift+S",
      disabled: nativeActionsDisabled,
      onSelect: () => void documents.saveAs(),
    },
    { id: "separator-interchange", separator: true },
    {
      id: "import",
      label: t("documents.menu.importDrawio"),
      disabled: nativeActionsDisabled,
      onSelect: documents.importDrawio,
    },
    {
      id: "export",
      label: t("documents.menu.exportDrawio"),
      disabled: nativeActionsDisabled,
      onSelect: () => void documents.prepareDrawioExport(),
    },
    { id: "separator-close", separator: true },
    {
      id: "close",
      label: t("documents.menu.close"),
      disabled: fileActionsLocked,
      onSelect: documents.closeDocument,
    },
  ];

  const documentState: DocumentState = documents.busy
    ? "busy"
    : documents.recovered
      ? "recovered"
      : documents.dirty
        ? "dirty"
        : documents.fileName
          ? "saved"
          : "new";

  // Loss entries are translated on every render so an open review follows a language change.
  const drawioReview: DrawioReview | null = documents.drawioImport
    ? {
        kind: "import",
        displayName: documents.drawioImport.displayName,
        losses: documents.drawioImport.losses.map(format),
        preservedFragmentCount: documents.drawioImport.preservedFragmentCount,
      }
    : documents.drawioExport
      ? {
          kind: "export",
          losses: documents.drawioExport.losses.map(format),
          preservedFragmentCount: documents.drawioExport.preservedFragmentCount,
        }
      : null;

  const drawerProps = (side: DrawerSide) => {
    const drawer = layout.isDrawer(side);
    const open = layout.isOpen(side);
    const otherOpen = openSide !== null && openSide !== side;
    return {
      "data-drawer": String(drawer),
      "data-open": String(drawer ? open : true),
      "aria-hidden": drawer && !open ? true : undefined,
      ...inert((drawer && !open) || otherOpen),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => onDrawerKeyDown(side, event),
      ref: (element: HTMLElement | null) => {
        panels.current[side] = element;
      },
    };
  };

  const drawerToggle = (side: DrawerSide) =>
    layout.isDrawer(side) && (
      <button
        ref={layout.registerToggle(side)}
        type="button"
        className="pc-btn pc-drawer-toggle"
        data-drawer={side}
        aria-controls={side === "left" ? LEFT_PANEL_ID : RIGHT_PANEL_ID}
        aria-expanded={layout.isOpen(side)}
        onClick={() => layout.toggleDrawer(side)}
      >
        {side === "left"
          ? t(layout.isOpen("left") ? "editor.panels.closeLeft" : "editor.panels.openLeft")
          : t(layout.isOpen("right") ? "editor.panels.closeRight" : "editor.panels.openRight")}
      </button>
    );

  const closeButton = (side: DrawerSide) =>
    layout.isDrawer(side) && (
      <button type="button" className="pc-btn pc-panel-close" onClick={() => layout.closeDrawer()}>
        {t(side === "left" ? "editor.panels.closeLeft" : "editor.panels.closeRight")}
      </button>
    );

  // While a drawer is open the rest of the shell is inert; the drawer is the keyboard path.
  const behindDrawer = openSide !== null;

  return (
    <main
      className="pc-editor"
      data-layout={layout.layout}
      onKeyDownCapture={session.onShortcutKey}
    >
      <EditorHeader
        inert={behindDrawer}
        title={session.model.document.metadata.title}
        state={documentState}
        fileName={documents.fileName}
        renaming={session.renamingDocument}
        editingLocked={editingLocked}
        errorId={ERROR_ID}
        hasError={hasError}
        fileItems={fileItems}
        canSave={!nativeActionsDisabled}
        canUndo={session.canUndo}
        canRedo={session.canRedo}
        onStartRename={() => session.setRenamingDocument(true)}
        onCancelRename={() => session.setRenamingDocument(false)}
        onRename={session.renameDocument}
        onSave={() => void documents.saveDocument()}
        onUndo={() => session.historyAction("undo")}
        onRedo={() => session.historyAction("redo")}
        onPreferences={() => setOverlay("preferences")}
        onHelp={() => setOverlay("help")}
      />
      {!documents.available && (
        <p className="pc-notice" data-tone="info" {...inert(behindDrawer)}>
          <span className="pc-notice-body">{t("documents.notice.desktopOnly")}</span>
        </p>
      )}
      {preferences.warning && (
        <div className="pc-notice" data-tone="warning" role="status" {...inert(behindDrawer)}>
          <span className="pc-notice-body">{message(preferences.warning)}</span>
          <span className="pc-notice-actions">
            <button type="button" className="pc-btn" onClick={preferences.dismissWarning}>
              {t("common.preferences.dismissWarning")}
            </button>
          </span>
        </div>
      )}
      {documents.recovery && (
        <section
          className="pc-notice pc-recovery-notice"
          data-tone="warning"
          role="alert"
          aria-labelledby="recovery-heading"
          {...inert(behindDrawer)}
        >
          <div className="pc-notice-body">
            <h2 id="recovery-heading">{t("documents.recovery.title")}</h2>
            <p>
              {t("documents.recovery.body", { name: documents.recovery.candidate.displayName })}
            </p>
          </div>
          <div className="pc-notice-actions pc-recovery-actions">
            <button
              type="button"
              className="pc-btn pc-btn--primary pc-primary"
              disabled={documents.busy}
              onClick={documents.recoverBackup}
            >
              {t("documents.recovery.recover")}
            </button>
            <button
              type="button"
              className="pc-btn"
              disabled={documents.busy}
              onClick={documents.dismissRecovery}
            >
              {t("documents.recovery.keep")}
            </button>
          </div>
        </section>
      )}
      {hasError && (
        <div className="pc-notice" data-tone="error" {...inert(behindDrawer)}>
          <p id={ERROR_ID} className="pc-error pc-notice-body" role="alert">
            {errorText}
          </p>
        </div>
      )}
      <div className="pc-workspace" aria-busy={editingLocked} {...inert(editingLocked)}>
        <aside
          id={LEFT_PANEL_ID}
          className="pc-panel pc-panel-left"
          aria-label={t("editor.panels.leftLabel")}
          {...drawerProps("left")}
        >
          {layout.isDrawer("left") && <div className="pc-panel-header">{closeButton("left")}</div>}
          <NavigationTabs<NavigationTab>
            label={t("editor.panels.tabs")}
            active={tab}
            onChange={setTab}
            tabs={[
              {
                id: "shapes",
                label: t("editor.tabs.shapes"),
                content: <ShapesPanel disabled={editingLocked} onAddShape={session.addShape} />,
              },
              {
                id: "structure",
                label: t("editor.tabs.structure"),
                content: (
                  <StructurePanel
                    document={session.model.document}
                    page={page}
                    layer={layer}
                    pageNodes={session.pageNodes}
                    selection={session.selection}
                    connectionSelection={session.connectionSelection}
                    errorId={ERROR_ID}
                    hasError={hasError}
                    elementsHeadingRef={elementsHeading}
                    nodeLabel={label}
                    onChangePage={session.changePage}
                    onAddPage={session.addPage}
                    onRenamePage={session.renamePage}
                    onChangeLayer={session.changeLayer}
                    onAddLayer={session.addLayer}
                    onRenameLayer={session.renameLayer}
                    onSelectNode={session.select}
                    onSelectConnection={session.selectConnection}
                    onNewConnector={() => {
                      session.selectConnection(null);
                      setConnectorDraftKey((value) => value + 1);
                    }}
                  />
                ),
              },
            ]}
          />
        </aside>
        <CanvasStage
          inert={behindDrawer}
          document={session.model.document}
          pageId={page.pageId}
          layerId={layer.layerId}
          pageName={page.name}
          layerName={layer.name}
          selection={session.selection}
          connectionSelection={session.connectionSelection}
          zoom={session.zoom}
          fitRequest={session.fitRequest}
          regionRef={canvasRegion}
          contextStart={drawerToggle("left")}
          contextEnd={drawerToggle("right")}
          onZoomChange={session.setZoom}
          onFit={session.requestFit}
          onSelect={session.select}
          onCommitGeometry={session.commitGeometry}
          onRegionKeyDownCapture={onCanvasKeyDownCapture}
        />
        <aside
          id={RIGHT_PANEL_ID}
          className="pc-panel pc-panel-right pc-inspector"
          aria-labelledby="inspector-heading"
          {...drawerProps("right")}
        >
          <div className="pc-panel-header">
            <h2 id="inspector-heading">{t("editor.inspector.title")}</h2>
            {closeButton("right")}
          </div>
          <div className="pc-panel-body">
            <Inspector
              contextKey={`${page.pageId}:${layer.layerId}`}
              selected={session.selected}
              selectedName={session.selected ? label(session.selected) : ""}
              selectedStyle={session.selectedStyle}
              selectedConnection={session.selectedConnection}
              connectorStyle={session.connectorStyle}
              pageNodes={session.pageNodes}
              nodeLabel={label}
              connectorDraftKey={connectorDraftKey}
              hasError={hasError}
              errorId={ERROR_ID}
              onApplyText={session.updateSelectedText}
              onApplyGeometry={(geometry) =>
                session.selected && session.commitGeometry(session.selected.nodeId, geometry)
              }
              onSubmitConnection={session.submitConnection}
              onDelete={removeFromInspector}
            />
          </div>
        </aside>
        {openSide && (
          <button
            type="button"
            className="pc-drawer-scrim"
            data-open="true"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => layout.closeDrawer()}
          />
        )}
      </div>
      <footer className="pc-statusbar" {...inert(behindDrawer)}>
        <p role="status" aria-label={t("editor.status.label")}>
          {format(session.feedback)}
        </p>
        <span data-revision={session.model.revision}>
          {documents.dirty
            ? t("editor.status.revisionUnsaved", { revision: session.model.revision })
            : documents.fileName
              ? t("editor.status.revisionFile", {
                  revision: session.model.revision,
                  name: documents.fileName,
                })
              : t("editor.status.revisionNew", { revision: session.model.revision })}
        </span>
      </footer>
      {overlay === "help" && <HelpDialog onClose={() => setOverlay(null)} />}
      {overlay === "preferences" && <PreferencesDialog onClose={() => setOverlay(null)} />}
      {documents.pendingAction && (
        <UnsavedChangesDialog
          onSave={documents.saveAndContinue}
          onDiscard={documents.discardAndContinue}
          onCancel={documents.cancelReplacement}
          busy={documents.busy}
          error={documents.promptError ? format(documents.promptError) : null}
        />
      )}
      {drawioReview && (
        <DrawioReviewDialog
          review={drawioReview}
          busy={documents.busy}
          onConfirm={
            drawioReview.kind === "import"
              ? documents.acceptDrawioImport
              : documents.confirmDrawioExport
          }
          onCancel={
            drawioReview.kind === "import"
              ? documents.cancelDrawioImport
              : documents.cancelDrawioExport
          }
        />
      )}
    </main>
  );
}
