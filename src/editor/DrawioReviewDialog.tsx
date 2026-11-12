import { useEffect, useRef, type KeyboardEvent } from "react";

export type DrawioReview = {
  kind: "import" | "export";
  displayName?: string;
  losses: string[];
  preservedFragmentCount: number;
};

type Props = {
  review: DrawioReview;
  busy: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
};

export default function DrawioReviewDialog({ review, busy, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const isImport = review.kind === "import";

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
      role={review.losses.length > 0 ? "alertdialog" : "dialog"}
      aria-labelledby="pc-drawio-title"
      aria-describedby={
        review.losses.length > 0
          ? "pc-drawio-description pc-drawio-loss-list"
          : "pc-drawio-description"
      }
      aria-busy={busy}
      tabIndex={-1}
      onKeyDown={containFocus}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) void onCancel();
      }}
    >
      <h2 id="pc-drawio-title">{isImport ? "Review draw.io import" : "Review draw.io export"}</h2>
      <p id="pc-drawio-description">
        {isImport
          ? `Import ${review.displayName ?? "this file"} as a new unsaved document? The source file will remain unchanged.`
          : "Export the current diagram to a new draw.io file?"}
      </p>
      {review.preservedFragmentCount > 0 && (
        <p className="pc-drawio-preserved" role="status">
          {review.preservedFragmentCount} safe source fragments will be retained but not rendered in
          PeerCanvas.
        </p>
      )}
      {review.losses.length > 0 ? (
        <section className="pc-drawio-losses" aria-labelledby="pc-drawio-losses-heading">
          <h3 id="pc-drawio-losses-heading">Known compatibility losses</h3>
          <ul id="pc-drawio-loss-list">
            {review.losses.map((loss, index) => (
              <li key={`${index}-${loss}`}>{loss}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p>No known compatibility losses.</p>
      )}
      {busy && <p role="status">Working…</p>}
      <div className="pc-unsaved-dialog-actions">
        <button
          className="pc-btn"
          type="button"
          ref={cancel}
          disabled={busy}
          onClick={() => void onCancel()}
        >
          Cancel
        </button>
        <button
          className="pc-btn pc-primary"
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {isImport ? "Import diagram" : "Save draw.io"}
        </button>
      </div>
    </dialog>
  );
}
