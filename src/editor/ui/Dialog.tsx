import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import "./Dialog.css";

export type DialogProps = {
  title: string;
  /** Called for Escape, the native cancel request, and (optionally) backdrop clicks; never while `busy`. */
  onClose: () => void;
  children?: ReactNode;
  /** Short explanatory text, referenced by `aria-describedby`. */
  description?: ReactNode;
  /** "alertdialog" for decisions that interrupt the user (unsaved changes, loss reviews). */
  role?: "dialog" | "alertdialog";
  /** Blocks every way of closing, sets `aria-busy` and parks focus on the dialog until it clears. */
  busy?: boolean;
  /** Element focused when the dialog opens. Defaults to the first focusable control. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Action row rendered below the body. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
  className?: string;
  titleId?: string;
  descriptionId?: string;
  /** Overrides `aria-describedby` entirely, e.g. "intro-id list-id". */
  describedBy?: string;
};

const FOCUSABLE = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hidden && element.closest("[hidden], [inert]") === null,
  );
}

function focusInitial(element: HTMLDialogElement, preferred?: RefObject<HTMLElement | null>) {
  (preferred?.current ?? focusable(element)[0] ?? element).focus();
}

/**
 * Modal dialog on the native `<dialog>` element. Mount it to open and unmount it to close; it
 * traps Tab, ignores close requests while busy, and restores focus to the control that opened it.
 */
export default function Dialog({
  title,
  onClose,
  children,
  description,
  role = "dialog",
  busy = false,
  initialFocusRef,
  footer,
  size = "md",
  closeOnBackdrop = false,
  className,
  titleId,
  descriptionId,
  describedBy,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fallbackTitleId = useId();
  const fallbackDescriptionId = useId();
  const headingId = titleId ?? fallbackTitleId;
  const summaryId = descriptionId ?? fallbackDescriptionId;
  // Read at open/close time only; consumers may pass fresh props on every render.
  const initialFocus = useRef(initialFocusRef);
  initialFocus.current = initialFocusRef;

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // jsdom and very old WebViews lack showModal/close; the open attribute keeps the dialog usable.
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    focusInitial(element, initialFocus.current);
    return () => {
      if (typeof element.close === "function") element.close();
      else element.removeAttribute("open");
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const element = dialog.current!;
    if (busy) {
      // A focused control that becomes disabled may drop focus to the body; keep it in the dialog.
      const active = document.activeElement;
      if (element.contains(active) || active === document.body || active === null) element.focus();
    } else if (document.activeElement === element) {
      focusInitial(element, initialFocus.current);
    }
  }, [busy]);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = focusable(event.currentTarget);
    if (controls.length === 0) {
      event.preventDefault();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    // The surface fills the dialog box, so a click that targets the element itself hit the backdrop.
    if (closeOnBackdrop && !busy && event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialog}
      className={["pc-dialog", `pc-dialog--${size}`, className].filter(Boolean).join(" ")}
      role={role}
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={describedBy ?? (description ? summaryId : undefined)}
      aria-busy={busy}
      tabIndex={-1}
      onKeyDown={containFocus}
      onClick={onBackdrop}
      onCancel={(event) => {
        // Never let the browser close the element itself: the owner decides by unmounting.
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="pc-dialog-surface">
        <h2 id={headingId} className="pc-dialog-title">
          {title}
        </h2>
        {description && (
          <p id={summaryId} className="pc-dialog-description">
            {description}
          </p>
        )}
        <div className="pc-dialog-body">{children}</div>
        {footer && <div className="pc-dialog-footer pc-dialog-actions">{footer}</div>}
      </div>
    </dialog>
  );
}
