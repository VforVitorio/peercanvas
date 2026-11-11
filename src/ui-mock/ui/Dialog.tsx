import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute("inert") && element.getAttribute("aria-hidden") !== "true",
  );
}

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Element whose subtree becomes inert while the dialog is open. */
  inertTargetId?: string;
  /** Element to focus first; defaults to the first focusable control. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  size?: "sm" | "md" | "lg";
  role?: "dialog" | "alertdialog";
}

/**
 * Modal dialog with focus containment, Escape dismissal, background inerting, and focus
 * restoration. Focus returns to the element focused when the dialog mounted (the caller
 * may override restoration by focusing elsewhere after close).
 */
export default function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  inertTargetId = "pc-shell",
  initialFocusRef,
  size = "md",
  role = "dialog",
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const shell = document.getElementById(inertTargetId);
    shell?.setAttribute("inert", "");
    shell?.setAttribute("aria-hidden", "true");
    const target = initialFocusRef?.current ?? (panel.current && focusableWithin(panel.current)[0]);
    (target ?? panel.current)?.focus();
    return () => {
      shell?.removeAttribute("inert");
      shell?.removeAttribute("aria-hidden");
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    };
    // Mount-only: restoration target is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = focusableWithin(panel.current);
    if (items.length === 0) {
      event.preventDefault();
      panel.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="pc-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`pc-dialog pc-dialog-${size}`}
        onKeyDown={onKeyDown}
      >
        <header className="pc-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="pc-icon-btn" aria-label="Close dialog" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        {description && (
          <p id={descriptionId} className="pc-dialog-description">
            {description}
          </p>
        )}
        <div className="pc-dialog-body">{children}</div>
        {footer && <footer className="pc-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.querySelector(".pc-root") ?? document.body,
  );
}
