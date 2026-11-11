import { useId, useRef, useState } from "react";
import { useDemo } from "./context";
import Dialog from "./Dialog";
import type { PendingReplacement } from "./types";

const shortcuts: Array<[string, string]> = [
  ["Ctrl/⌘ S", "Save (simulated, in memory)"],
  ["Ctrl/⌘ Z", "Undo"],
  ["Ctrl/⌘ ⇧ Z or Ctrl Y", "Redo"],
  ["Ctrl/⌘ + / −", "Zoom in / out"],
  ["Ctrl/⌘ 0", "Zoom to 100%"],
  ["?", "Open this list"],
  ["] / [", "Canvas focused: select next / previous element"],
  ["Arrow keys", "Canvas focused: move selection (Shift for larger steps)"],
  ["Drag a shape", "Pointer: move it; the release is one validated, undoable move"],
  [
    "Alt/⌥ + arrow keys",
    "Canvas focused: scroll the view (Shift for a page); never edits. Mouse wheel and scrollbars also scroll",
  ],
  ["Delete / Backspace", "Canvas focused: delete selection"],
  ["Escape", "Clear selection, close a menu or dialog"],
  ["Ctrl/⌘ Enter", "Send a message in the assistant panel"],
];

function describe(action: PendingReplacement): string {
  switch (action.type) {
    case "open":
      return `open “${action.label}”`;
    case "new":
      return "create a new document";
    case "close":
      return "close this document";
    case "recover":
      return `restore “${action.label}”`;
  }
}

export default function Dialogs() {
  const { state, service, ui, setUi, actions } = useDemo();
  const dialog = ui.dialog;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState("svg");
  const renameId = useId();
  if (!dialog) return null;
  const close = actions.closeDialog;
  const title = state.document?.metadata.title ?? "Untitled";

  switch (dialog.kind) {
    case "decision":
      return (
        <Dialog
          key="decision"
          role="alertdialog"
          title="Unsaved changes"
          description={`“${title}” has unsaved changes. What should happen before you ${describe(dialog.action)}?`}
          onClose={actions.cancelReplace}
          initialFocusRef={cancelRef}
          size="sm"
          footer={
            <>
              <button
                ref={cancelRef}
                type="button"
                className="pc-btn"
                onClick={actions.cancelReplace}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-danger"
                onClick={() => actions.resolveReplace(dialog.action, "discard")}
              >
                Discard changes
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                onClick={() => actions.resolveReplace(dialog.action, "save")}
              >
                Save, then continue
              </button>
            </>
          }
        >
          <p className="pc-small pc-muted">Saving is simulated; nothing is written to disk.</p>
        </Dialog>
      );

    case "rename":
      return (
        <Dialog
          key="rename"
          title="Rename document"
          onClose={close}
          size="sm"
          initialFocusRef={renameInputRef}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("title");
              const next = typeof value === "string" ? value.trim() : "";
              if (!next) return actions.explain("A document title cannot be empty.");
              service.rename(next);
              close();
            }}
          >
            <div className="pc-field pc-field-wide">
              <label htmlFor={renameId}>Title</label>
              <input
                id={renameId}
                ref={renameInputRef}
                name="title"
                defaultValue={title}
                maxLength={120}
              />
            </div>
            <div className="pc-dialog-footer">
              <button type="button" className="pc-btn" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="pc-btn pc-btn-primary">
                Rename
              </button>
            </div>
          </form>
        </Dialog>
      );

    case "recovery": {
      const candidate = state.recovery.find((item) => item.id === dialog.id);
      return (
        <Dialog
          key="recovery"
          title="Recovery preview"
          description="Simulated recovery candidate. Nothing is read from or written to disk."
          onClose={close}
          footer={
            <>
              <button type="button" className="pc-btn" onClick={close}>
                Keep current state
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                aria-disabled={!candidate}
                onClick={() =>
                  candidate
                    ? actions.requestReplace({
                        type: "recover",
                        id: candidate.id,
                        label: candidate.title,
                      })
                    : actions.explain("This recovery candidate is no longer available.")
                }
              >
                Restore this version
              </button>
            </>
          }
        >
          {candidate ? (
            <div className="pc-recovery-preview">
              <h3>{candidate.title}</h3>
              <p>{candidate.description}</p>
              <p className="pc-tag pc-tag-warn">Simulated recovery — requires explicit restore</p>
            </div>
          ) : (
            <p>This candidate is no longer available. It may have been restored or reset.</p>
          )}
        </Dialog>
      );
    }

    case "import":
      return (
        <Dialog
          key="import"
          title="Import (simulated)"
          description="Uses a bundled fictional fixture. No file picker is opened and no file is parsed."
          onClose={close}
          footer={
            <>
              <button type="button" className="pc-btn" onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                onClick={() => {
                  close();
                  service.startOperation("import");
                  actions.announce("Simulated import started.");
                }}
              >
                Start simulated import
              </button>
            </>
          }
        >
          <p>
            The outcome follows the <strong>Outcome</strong> selector in the simulation banner
            (currently: {state.scenario}). Changes are shown for review before anything is applied;
            you can cancel while it runs or decline the preview.
          </p>
          <p className="pc-small pc-muted">
            Real import formats are not implemented. This does not indicate format support.
          </p>
        </Dialog>
      );

    case "export":
      return (
        <Dialog
          key="export"
          title="Export (simulated)"
          description="No file or download is created; the result is reported here only."
          onClose={close}
          footer={
            <>
              <button type="button" className="pc-btn" onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                onClick={() => {
                  close();
                  service.startOperation("export");
                  actions.announce(
                    `Simulated ${exportFormat.toUpperCase()} export started. No file will be created.`,
                  );
                }}
              >
                Start simulated export
              </button>
            </>
          }
        >
          <fieldset className="pc-fieldset">
            <legend>Format label (illustrative only)</legend>
            {[
              ["svg", "SVG"],
              ["png", "PNG"],
              ["json", "PeerCanvas JSON"],
            ].map(([value, label]) => (
              <label key={value} className="pc-radio">
                <input
                  type="radio"
                  name="pc-export-format"
                  value={value}
                  checked={exportFormat === value}
                  onChange={() => setExportFormat(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <p className="pc-small pc-muted">Outcome scenario: {state.scenario}.</p>
        </Dialog>
      );

    case "preferences": {
      const prefs = ui.prefs;
      const update = (patch: Partial<typeof prefs>) =>
        setUi((current) => ({ ...current, prefs: { ...current.prefs, ...patch } }));
      return (
        <Dialog
          key="preferences"
          title="Preferences"
          description="Kept in memory only. Reset demo restores the defaults."
          onClose={close}
          footer={
            <button type="button" className="pc-btn pc-btn-primary" onClick={close}>
              Done
            </button>
          }
        >
          <fieldset className="pc-fieldset">
            <legend>Theme</legend>
            {(["light", "dark"] as const).map((theme) => (
              <label key={theme} className="pc-radio">
                <input
                  type="radio"
                  name="pc-theme"
                  checked={prefs.theme === theme}
                  onChange={() => update({ theme })}
                />
                {theme === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <label className="pc-check">
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(event) => update({ reduceMotion: event.target.checked })}
            />
            Reduce motion (also follows the system setting)
          </label>
          <label className="pc-check">
            <input
              type="checkbox"
              checked={prefs.showGrid}
              onChange={(event) => update({ showGrid: event.target.checked })}
            />
            Show canvas grid
          </label>
          <label className="pc-check">
            Keyboard move step
            <select
              value={prefs.nudgeStep}
              onChange={(event) => update({ nudgeStep: Number(event.target.value) })}
            >
              {[1, 4, 8, 16].map((step) => (
                <option key={step} value={step}>
                  {step}px
                </option>
              ))}
            </select>
          </label>
        </Dialog>
      );
    }

    case "shortcuts":
      return (
        <Dialog key="shortcuts" title="Keyboard shortcuts" onClose={close}>
          <table className="pc-shortcuts">
            <caption className="pc-sr-only">Keyboard shortcuts</caption>
            <thead>
              <tr>
                <th scope="col">Keys</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map(([keys, label]) => (
                <tr key={keys}>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                  <td>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog>
      );

    case "help":
      return (
        <Dialog
          key="help"
          title="About this demonstration"
          onClose={close}
          size="lg"
          footer={
            <button
              type="button"
              className="pc-btn"
              onClick={() => actions.openDialog({ kind: "shortcuts" })}
            >
              View keyboard shortcuts
            </button>
          }
        >
          <p>
            This is an isolated, resettable UI demonstration of the planned PeerCanvas editor. All
            data is fictional and all service results are simulated in memory.
          </p>
          <h3>What is real here</h3>
          <ul>
            <li>The diagram is drawn by the Weave.js renderer from the demo document snapshot.</li>
            <li>
              Edits go through the demo service&apos;s validated commands; invalid ones are
              rejected.
            </li>
          </ul>
          <h3>What is simulated</h3>
          <ul>
            <li>Saving, opening, recovery, import, and export (no files are read or written).</li>
            <li>Collaboration, invitations, and roles (no network).</li>
            <li>Assistant and MCP conversations and proposals (no provider or server).</li>
          </ul>
          <h3>Editing on the canvas</h3>
          <p>
            The canvas draws a projection of the document: click to select, or drag a shape to move
            it. A drag is only a preview until you release; the release is sent as one validated
            move that the service can reject (for example as a viewer or after the document
            changed), and a cancelled drag changes nothing. Resize and restyle through the
            inspector; keyboard arrows also move the selection.
          </p>
          <p>
            When zoomed in, scroll the view with the mouse wheel, the scrollbars, or Alt/⌥ + arrow
            keys while the canvas is focused (add Shift to move a page). Scrolling and zooming only
            change your view; they never edit the document or mark it unsaved.
          </p>
          <h3>Scenarios</h3>
          <p>
            Use the banner to load a fixture, choose whether simulated operations succeed, wait,
            cancel, or fail, and reset everything including theme and preferences.
          </p>
        </Dialog>
      );

    case "attribution":
      return (
        <Dialog key="attribution" title="About & attribution" onClose={close} size="lg">
          <ul className="pc-attribution">
            <li>
              <strong>PeerCanvas brand mark</strong> — maintainer-supplied artwork
              (PeerCanvas_Branding_PNG_2026-11-07), used unchanged for PeerCanvas product surfaces.
              No third-party reuse permission is granted.
            </li>
            <li>
              <strong>Weave.js</strong> (@inditextech/weave-sdk, -renderer-konva-base,
              -store-standalone, -types 5.7.1) — © INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.),
              Apache-2.0. The canvas adapter derives from its setup and keeps that notice.
            </li>
            <li>
              <strong>Konva</strong> 10.0.2 — MIT. <strong>Yjs</strong> 13.6.27 — MIT.
            </li>
            <li>
              <strong>React</strong> 18.3.1 — MIT.
            </li>
            <li>
              Interface glyphs are simple strokes drawn for this demo. Text uses system fonts.
            </li>
          </ul>
          <p className="pc-small pc-muted">
            Adapted Weave.js code provenance is recorded in THIRD_PARTY_NOTICES.md; each package
            ships its own license text.
          </p>
        </Dialog>
      );
  }
}
