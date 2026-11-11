import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

const handlers = () => ({
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  onCancel: vi.fn(),
  busy: false,
  error: null,
});

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.restoreAllMocks();
});

describe("UnsavedChangesDialog", () => {
  it("labels the prompt and offers the three actions", () => {
    const props = handlers();
    render(<UnsavedChangesDialog {...props} />);
    const dialog = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    expect(dialog.getAttribute("aria-describedby")).toBe("pc-unsaved-description");
    expect(screen.getByText("Save your changes before continuing?")).toBeTruthy();
    for (const [name, handler] of [
      ["Save", props.onSave],
      ["Discard", props.onDiscard],
      ["Cancel", props.onCancel],
    ] as const) {
      fireEvent.click(within(dialog).getByRole("button", { name }));
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it("focuses Cancel, contains Tab, handles Escape and restores focus", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const props = handlers();
    const { unmount } = render(<UnsavedChangesDialog {...props} />);
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
    fireEvent.keyDown(save, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(props.onCancel).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("blocks actions during save and announces status and errors", () => {
    const props = handlers();
    const { rerender } = render(<UnsavedChangesDialog {...props} busy error="Could not save." />);
    expect(screen.getByRole("alert").textContent).toBe("Could not save.");
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    for (const button of within(dialog).getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
    rerender(<UnsavedChangesDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });
});
