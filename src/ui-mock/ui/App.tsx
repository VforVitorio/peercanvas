import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createDemoService, type DemoService, type DemoState } from "../services/demo-service";
import Banner from "./Banner";
import {
  DemoContext,
  initialUi,
  ZOOM_STEPS,
  type DemoActions,
  type DemoContextValue,
  type UiState,
} from "./context";
import Dialogs from "./Dialogs";
import { ImportReview, OperationPanel, Toasts } from "./Feedback";
import Home from "./Home";
import { themeCss } from "./tokens";
import type { PendingReplacement } from "./types";
import Workspace from "./Workspace";

const THEME_CSS = themeCss();

/** Reveal the panel relevant to a freshly loaded fixture (UI-only presentation choice). */
function panelFor(snapshot: DemoState): Partial<UiState> {
  if (snapshot.proposal?.status === "pending" && snapshot.proposal.source !== "import")
    return { rightOpen: true, rightPanel: "assistant", assistantSource: snapshot.proposal.source };
  if (snapshot.fixture === "collaboration") return { rightOpen: true, rightPanel: "collab" };
  return {};
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export default function App() {
  // One service instance for the lifetime of the demo.
  const [service] = useState<DemoService>(() => createDemoService());
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [ui, setUiState] = useState<UiState>(initialUi);
  const [liveMessage, setLiveMessage] = useState("");
  const [uiNotice, setUiNotice] = useState<{ id: number; message: string } | null>(null);
  const pendingAction = useRef<PendingReplacement | null>(null);
  const noticeId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Cancel simulated timers so no work remains pending after unmount.
      service.dispose();
    };
  }, [service]);

  const zoomRef = useRef(ui.zoom);
  zoomRef.current = ui.zoom;
  const setUi = useCallback((update: (ui: UiState) => UiState) => setUiState(update), []);
  const dirty = Boolean(state.document) && state.savedRevision !== state.revision;

  const announce = useCallback((message: string) => {
    // Clearing first makes repeated identical messages re-announce.
    setLiveMessage("");
    queueMicrotask(() => mounted.current && setLiveMessage(message));
  }, []);

  const explain = useCallback(
    (message: string) => {
      noticeId.current += 1;
      setUiNotice({ id: noticeId.current, message });
      announce(message);
    },
    [announce],
  );

  const run = useCallback(
    (label: string, work: () => Promise<void> | void) => {
      try {
        const result: unknown = work();
        if (result instanceof Promise)
          result.catch((error: unknown) => {
            if (mounted.current)
              explain(
                `${label} did not complete (simulated): ${error instanceof Error ? error.message : String(error)}`,
              );
          });
      } catch (error) {
        explain(
          `${label} was rejected (simulated): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [explain],
  );

  const performReplace = useCallback(
    (action: PendingReplacement, decision?: "save" | "discard") => {
      pendingAction.current = action;
      const label =
        action.type === "open"
          ? `Open “${action.label}”`
          : action.type === "new"
            ? "New document"
            : action.type === "close"
              ? "Close document"
              : `Recover “${action.label}”`;
      run(label, async () => {
        const before = service.getSnapshot().document;
        if (action.type === "open") await service.open(action.fixture, decision);
        else if (action.type === "new") await service.newDocument(decision);
        else if (action.type === "close") await service.close(decision);
        else await service.recover(action.id, decision);
        if (!mounted.current) return;
        const after = service.getSnapshot();
        if (after.needsDecision) return; // the decision dialog effect takes over
        pendingAction.current = null;
        // A failed or cancelled replacement leaves the previous document active: keep the workspace.
        const replaced = action.type === "close" ? !after.document : after.document !== before;
        if (!replaced) return;
        setUiState((current) => ({
          ...current,
          view: after.document ? "workspace" : "home",
          ...panelFor(after),
        }));
        // Move focus to the new main region so keyboard users are not left on <body>.
        setTimeout(() => mounted.current && document.getElementById("pc-main")?.focus(), 0);
      });
    },
    [run, service],
  );

  const actions: DemoActions = useMemo(
    () => ({
      announce,
      explain,
      run,
      requestReplace: (action) => {
        if (dirty) setUiState((current) => ({ ...current, dialog: { kind: "decision", action } }));
        else {
          setUiState((current) => (current.dialog ? { ...current, dialog: null } : current));
          performReplace(action);
        }
      },
      resolveReplace: (action, decision) => {
        setUiState((current) => ({ ...current, dialog: null }));
        performReplace(action, decision);
      },
      cancelReplace: () => {
        pendingAction.current = null;
        // Clear a service-side decision request too (port: dismissNotice clears needsDecision).
        if (service.getSnapshot().needsDecision) service.dismissNotice();
        setUiState((current) => ({ ...current, dialog: null }));
        announce("Cancelled. The current document and its changes remain open.");
      },
      openDialog: (dialog) => setUiState((current) => ({ ...current, dialog })),
      closeDialog: () => setUiState((current) => ({ ...current, dialog: null })),
      setZoom: (zoom) => {
        const next = Math.min(4, Math.max(0.25, Math.round(zoom * 100) / 100));
        setUiState((current) => ({ ...current, zoom: next }));
        announce(`Zoom ${Math.round(next * 100)}%`);
      },
      zoomBy: (direction) => {
        const zoom = zoomRef.current;
        const next =
          direction > 0
            ? (ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? 4)
            : ([...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001) ?? 0.25);
        setUiState((current) => ({ ...current, zoom: next }));
        announce(`Zoom ${Math.round(next * 100)}%`);
      },
      resetDemo: () => {
        service.reset();
        pendingAction.current = null;
        setUiState(initialUi);
        setUiNotice(null);
        announce("Demo reset to its initial fixture, scenario, and preferences.");
      },
      loadFixture: (fixture) => {
        service.reset(fixture);
        pendingAction.current = null;
        const after = service.getSnapshot();
        setUiState((current) => ({
          ...initialUi,
          prefs: current.prefs,
          view: after.document ? "workspace" : "home",
          ...panelFor(after),
        }));
        announce(`Loaded the simulated “${fixture}” fixture.`);
      },
      showPanel: (panel) =>
        setUiState((current) => ({ ...current, rightOpen: true, rightPanel: panel })),
    }),
    [announce, explain, run, dirty, performReplace, service],
  );

  // If the service itself requests an unsaved-changes decision, surface it.
  useEffect(() => {
    if (state.needsDecision && pendingAction.current && ui.dialog?.kind !== "decision") {
      const action = pendingAction.current;
      setUiState((current) => ({ ...current, dialog: { kind: "decision", action } }));
    }
  }, [state.needsDecision, ui.dialog]);

  // Without a document there is nothing to show in the workspace.
  const view = state.document ? ui.view : "home";

  // Global shortcuts. Dialogs own their own keyboard handling.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (ui.dialog) {
        // Dialogs own their keys, but the browser's real Save dialog must never open.
        if (mod && key === "s") event.preventDefault();
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        if (state.document) run("Save", () => service.save());
        else explain("Nothing to save: open or create a document first.");
        return;
      }
      if (isTextTarget(event.target)) return;
      // Edit and zoom shortcuts belong to the workspace; Home must not change the hidden document.
      if (view !== "workspace") {
        if (!mod && event.key === "?") {
          event.preventDefault();
          actions.openDialog({ kind: "shortcuts" });
        }
        return;
      }
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (state.canUndo) service.undo();
        else explain("Nothing to undo.");
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        if (state.canRedo) service.redo();
        else explain("Nothing to redo.");
      } else if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        actions.zoomBy(1);
      } else if (mod && key === "-") {
        event.preventDefault();
        actions.zoomBy(-1);
      } else if (mod && key === "0") {
        event.preventDefault();
        actions.setZoom(1);
      } else if (!mod && event.key === "?") {
        event.preventDefault();
        actions.openDialog({ kind: "shortcuts" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    ui.dialog,
    view,
    state.document,
    state.canUndo,
    state.canRedo,
    service,
    run,
    explain,
    actions,
  ]);

  const value: DemoContextValue = { service, state, ui, setUi, actions, dirty };
  const motion = ui.prefs.reduceMotion ? "reduce" : "system";

  return (
    <DemoContext.Provider value={value}>
      <style>{THEME_CSS}</style>
      <div className="pc-root antialiased" data-theme={ui.prefs.theme} data-motion={motion}>
        <div id="pc-shell" className="pc-shell">
          <a className="pc-skip" href="#pc-main">
            Skip to main content
          </a>
          <Banner />
          {view === "home" ? <Home /> : <Workspace />}
          <div className="pc-float-stack">
            {view === "workspace" && <ImportReview />}
            <OperationPanel />
          </div>
          <Toasts uiNotice={uiNotice} onDismissUi={() => setUiNotice(null)} />
        </div>
        <div className="pc-sr-only" aria-live="polite" aria-atomic="true" data-testid="live">
          {liveMessage}
        </div>
        <Dialogs />
      </div>
    </DemoContext.Provider>
  );
}
