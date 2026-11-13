import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
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

  it("parks focus on the dialog while saving and returns it to Cancel afterwards", () => {
    const props = handlers();
    const { rerender } = render(<UnsavedChangesDialog {...props} />);
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);
    rerender(<UnsavedChangesDialog {...props} busy />);
    expect(document.activeElement).toBe(dialog);
    // Nothing is focusable while saving, so Tab cannot leave the prompt.
    expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })).toBe(false);
    rerender(<UnsavedChangesDialog {...props} error="Could not save." />);
    expect(document.activeElement).toBe(cancel);
  });

  it("is fully translated and retranslates when the language changes", () => {
    const props = handlers();
    const { rerender } = render(
      <I18nProvider locale="es">
        <UnsavedChangesDialog {...props} busy error="No se pudo guardar el archivo." />
      </I18nProvider>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Cambios pendientes" });
    expect(
      within(dialog).getByText("¿Quieres guardar los cambios antes de continuar?"),
    ).toBeTruthy();
    expect(within(dialog).getByRole("status").textContent).toBe("Guardando…");
    // The owner's already-translated error text is shown untouched.
    expect(within(dialog).getByRole("alert").textContent).toBe("No se pudo guardar el archivo.");
    rerender(
      <I18nProvider locale="es">
        <UnsavedChangesDialog {...props} />
      </I18nProvider>,
    );
    for (const name of ["Cancelar", "Descartar", "Guardar"]) {
      expect(within(dialog).getByRole("button", { name })).toBeTruthy();
    }
    rerender(
      <I18nProvider locale="en">
        <UnsavedChangesDialog {...props} />
      </I18nProvider>,
    );
    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBe(dialog);
    expect(within(dialog).getByRole("button", { name: "Discard" })).toBeTruthy();
  });
});
