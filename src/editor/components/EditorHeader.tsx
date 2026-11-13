import { useEffect, useRef, type FormEvent } from "react";
import symbol from "../../../docs/branding/assets/peercanvas-symbol-color.png";
import { useI18n } from "../../i18n";
import FileMenu, { type FileMenuItem } from "./FileMenu";

export type DocumentState = "busy" | "recovered" | "dirty" | "saved" | "new";

type Props = {
  title: string;
  state: DocumentState;
  fileName: string | null;
  renaming: boolean;
  editingLocked: boolean;
  errorId: string;
  hasError: boolean;
  fileItems: FileMenuItem[];
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onRename: (title: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreferences: () => void;
  onHelp: () => void;
  /** Set while an open drawer owns the keyboard path. */
  inert?: boolean;
};

const stateKeys: Record<DocumentState, string> = {
  busy: "documents.status.busy",
  recovered: "documents.status.recovered",
  dirty: "documents.status.unsaved",
  saved: "documents.status.saved",
  new: "documents.status.new",
};

/** Compact header: symbol, editable title, real document state, File menu, and global actions. */
export default function EditorHeader(props: Props) {
  const { t } = useI18n();
  const titleForm = useRef<HTMLFormElement>(null);
  const titleButton = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(props.renaming);

  // Reset an open draft when the canonical title changes (for example, after undo).
  useEffect(() => {
    titleForm.current?.reset();
  }, [props.title]);

  // Return focus to the title control once the rename form closes.
  useEffect(() => {
    if (wasRenaming.current && !props.renaming) titleButton.current?.focus();
    wasRenaming.current = props.renaming;
  }, [props.renaming]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onRename(String(new FormData(event.currentTarget).get("title")));
  }

  return (
    <header className="pc-header" {...(props.inert ? { inert: "" } : {})}>
      <div className="pc-brand">
        <img src={symbol} alt="" width="24" height="24" />
        <h1>PeerCanvas</h1>
      </div>
      <div className="pc-document">
        {props.renaming ? (
          <form
            ref={titleForm}
            className="pc-title-form"
            onSubmit={submit}
            onReset={props.onCancelRename}
          >
            <label className="pc-visually-hidden" htmlFor="document-title">
              {t("documents.rename.label")}
            </label>
            <input
              id="document-title"
              name="title"
              type="text"
              required
              defaultValue={props.title}
              aria-describedby={props.hasError ? props.errorId : undefined}
              aria-invalid={props.hasError}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.form?.reset();
                }
              }}
            />
            <button type="submit" className="pc-btn pc-btn--primary pc-primary">
              {t("documents.rename.save")}
            </button>
            <button type="reset" className="pc-btn">
              {t("documents.rename.cancel")}
            </button>
          </form>
        ) : (
          <button
            ref={titleButton}
            type="button"
            className="pc-document-title"
            aria-label={t("documents.rename.titleLabel", { title: props.title })}
            title={t("documents.rename.titleLabel", { title: props.title })}
            disabled={props.editingLocked}
            onClick={props.onStartRename}
          >
            {props.title}
          </button>
        )}
        <span className="pc-document-status" data-state={props.state} aria-live="polite">
          {t(stateKeys[props.state])}
        </span>
        {props.fileName && (
          <span className="pc-file-name" title={props.fileName}>
            {props.fileName}
          </span>
        )}
      </div>
      <div className="pc-header-actions">
        <FileMenu items={props.fileItems} disabled={props.editingLocked || props.renaming} />
        <button
          type="button"
          className="pc-btn"
          disabled={!props.canSave}
          aria-keyshortcuts="Control+S Meta+S"
          onClick={props.onSave}
        >
          {t("editor.header.save")}
        </button>
        <div
          role="group"
          aria-label={t("editor.header.historyGroup")}
          className="pc-history-controls"
        >
          <button
            type="button"
            className="pc-btn"
            disabled={props.editingLocked || !props.canUndo}
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={props.onUndo}
          >
            {t("editor.header.undo")}
          </button>
          <button
            type="button"
            className="pc-btn"
            disabled={props.editingLocked || !props.canRedo}
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            onClick={props.onRedo}
          >
            {t("editor.header.redo")}
          </button>
        </div>
        <button
          type="button"
          className="pc-btn"
          aria-haspopup="dialog"
          onClick={props.onPreferences}
        >
          {t("editor.header.preferences")}
        </button>
        <button type="button" className="pc-btn" aria-haspopup="dialog" onClick={props.onHelp}>
          {t("editor.header.help")}
        </button>
      </div>
    </header>
  );
}
