import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dialog from "./Dialog";

afterEach(() => cleanup());

function Sample({
  onClose = vi.fn(),
  busy = false,
  closeOnBackdrop = false,
  focusSecond = false,
}: {
  onClose?: () => void;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  focusSecond?: boolean;
}) {
  const second = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      title="Sample dialog"
      description="Sample description"
      onClose={onClose}
      busy={busy}
      closeOnBackdrop={closeOnBackdrop}
      initialFocusRef={focusSecond ? second : undefined}
      footer={
        <>
          <button type="button" disabled={busy}>
            Cancel
          </button>
          <button type="button" disabled>
            Never reachable
          </button>
          <button type="button" disabled={busy}>
            Confirm
          </button>
        </>
      }
    >
      <input aria-label="First field" disabled={busy} />
      <input aria-label="Second field" ref={second} disabled={busy} />
    </Dialog>
  );
}

const cancelEvent = () => new Event("cancel", { bubbles: false, cancelable: true });

describe("Dialog", () => {
  it("is a named, described, open modal dialog", () => {
    render(<Sample />);
    const dialog = screen.getByRole("dialog", { name: "Sample dialog" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const description = document.getElementById(dialog.getAttribute("aria-describedby")!);
    expect(description?.textContent).toBe("Sample description");
    expect(within(dialog).getByRole("heading", { name: "Sample dialog" })).toBeTruthy();
  });

  it("supports the alertdialog role and explicit label/description ids", () => {
    render(
      <Dialog
        role="alertdialog"
        title="Careful"
        description="Details"
        titleId="custom-title"
        descriptionId="custom-description"
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Careful" });
    expect(dialog.getAttribute("aria-labelledby")).toBe("custom-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("custom-description");
  });

  it("lets the owner override aria-describedby", () => {
    render(<Dialog title="T" description="D" describedBy="a b" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe("a b");
  });

  it("focuses the first focusable control, or the requested one", () => {
    const { unmount } = render(<Sample />);
    expect(document.activeElement).toBe(screen.getByLabelText("First field"));
    unmount();
    render(<Sample focusSecond />);
    expect(document.activeElement).toBe(screen.getByLabelText("Second field"));
  });

  it("focuses the dialog itself when it has nothing focusable", () => {
    render(<Dialog title="Empty" onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("restores focus to the invoking control when it closes", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<Sample />);
    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("does not restore focus to an element that left the document", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<Sample />);
    trigger.remove();
    expect(() => unmount()).not.toThrow();
  });

  it("keeps Tab inside the dialog, skipping disabled controls", () => {
    render(<Sample />);
    const first = screen.getByLabelText("First field");
    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();
    const forward = fireEvent.keyDown(confirm, { key: "Tab" });
    expect(forward).toBe(false);
    expect(document.activeElement).toBe(first);
    const backward = fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(backward).toBe(false);
    expect(document.activeElement).toBe(confirm);
    // Tabbing between inner controls is left to the browser.
    const second = screen.getByLabelText("Second field");
    second.focus();
    expect(fireEvent.keyDown(second, { key: "Tab" })).toBe(true);
  });

  it("closes on the native cancel request (Escape) without letting the browser close it", () => {
    const onClose = vi.fn();
    render(<Sample onClose={onClose} />);
    const event = cancelEvent();
    fireEvent(screen.getByRole("dialog"), event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("ignores close requests while busy and parks focus on the dialog", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sample onClose={onClose} />);
    expect(document.activeElement).toBe(screen.getByLabelText("First field"));
    rerender(<Sample onClose={onClose} busy closeOnBackdrop />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(dialog);
    const event = cancelEvent();
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    // With every control disabled, Tab is swallowed so focus cannot leave the dialog.
    expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })).toBe(false);
    rerender(<Sample onClose={onClose} />);
    expect(dialog.getAttribute("aria-busy")).toBe("false");
    expect(document.activeElement).toBe(screen.getByLabelText("First field"));
  });

  it("closes on a backdrop click only when asked to, never from inside the surface", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sample onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Sample onClose={onClose} closeOnBackdrop />);
    fireEvent.click(screen.getByRole("heading", { name: "Sample dialog" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses showModal and close when the platform provides them", () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    });
    try {
      const { unmount } = render(<Sample />);
      expect(showModal).toHaveBeenCalledOnce();
      unmount();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
});
