import { useRef } from "react";
import { useI18n } from "../i18n";
import Dialog from "./ui/Dialog";
import "./UnsavedChangesDialog.css";

type Props = {
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  busy: boolean;
  /** Already translated by the owner, who re-renders it on a language change. */
  error: string | null;
};

export default function UnsavedChangesDialog({ onSave, onDiscard, onCancel, busy, error }: Props) {
  const { t } = useI18n();
  const cancel = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      role="alertdialog"
      size="sm"
      title={t("documents.unsaved.title")}
      description={t("documents.unsaved.prompt")}
      titleId="pc-unsaved-title"
      descriptionId="pc-unsaved-description"
      className="pc-unsaved-dialog"
      busy={busy}
      onClose={onCancel}
      initialFocusRef={cancel}
      footer={
        <>
          <button className="pc-btn" type="button" ref={cancel} disabled={busy} onClick={onCancel}>
            {t("documents.unsaved.cancel")}
          </button>
          <button className="pc-btn" type="button" disabled={busy} onClick={onDiscard}>
            {t("documents.unsaved.discard")}
          </button>
          <button
            className="pc-btn pc-primary"
            type="button"
            disabled={busy}
            onClick={() => void onSave()}
          >
            {t("documents.unsaved.save")}
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="pc-unsaved-dialog-error">
          {error}
        </p>
      )}
      {busy && <p role="status">{t("documents.unsaved.saving")}</p>}
    </Dialog>
  );
}
