import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import "./UnsavedChangesDialog.css";

type Props = {
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
};

export default function UnsavedChangesDialog({ onSave, onDiscard, onCancel, busy, error }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (busy) dialog.current?.focus();
  }, [busy]);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (buttons.length === 0) {
      event.preventDefault();
      return;
    }
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === event.currentTarget)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialog}
      className="pc-unsaved-dialog"
      role="alertdialog"
      aria-labelledby="pc-unsaved-title"
      aria-describedby="pc-unsaved-description"
      aria-busy={busy}
      tabIndex={-1}
      onKeyDown={containFocus}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="pc-unsaved-title">Unsaved changes</h2>
      <p id="pc-unsaved-description">Save your changes before continuing?</p>
      {error && (
        <p role="alert" className="pc-unsaved-dialog-error">
          {error}
        </p>
      )}
      {busy && <p role="status">Saving…</p>}
      <div className="pc-unsaved-dialog-actions">
        <button className="pc-btn" type="button" ref={cancel} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="pc-btn" type="button" disabled={busy} onClick={onDiscard}>
          Discard
        </button>
        <button
          className="pc-btn pc-primary"
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
        >
          Save
        </button>
      </div>
    </dialog>
  );
}
