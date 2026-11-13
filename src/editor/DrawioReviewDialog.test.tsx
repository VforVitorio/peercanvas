import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import DrawioReviewDialog from "./DrawioReviewDialog";

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

describe("draw.io compatibility review dialog", () => {
  it("shows losses and preserved content before import confirmation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DrawioReviewDialog
        review={{
          kind: "import",
          displayName: "architecture.drawio",
          losses: ["One unsupported grid setting will not be imported."],
          preservedFragmentCount: 2,
        }}
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Review draw.io import" });
    expect(dialog.getAttribute("aria-describedby")).toContain("pc-drawio-loss-list");
    expect(within(dialog).getByText(/architecture.drawio/)).toBeTruthy();
    expect(within(dialog).getByText(/2 safe source fragments/)).toBeTruthy();
    expect(within(dialog).getByText(/grid setting/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Import diagram" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows an empty-loss export review and allows cancellation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DrawioReviewDialog
        review={{ kind: "export", losses: [], preservedFragmentCount: 0 }}
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Review draw.io export" });
    expect(within(dialog).getByText("No known compatibility losses.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("focuses Cancel, keeps Tab inside, closes on Escape and restores focus", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    const { unmount } = render(
      <DrawioReviewDialog
        review={{ kind: "export", losses: ["Loss"], preservedFragmentCount: 0 }}
        busy={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Save draw.io" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("blocks every way out while working", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DrawioReviewDialog
        review={{ kind: "import", displayName: "a.drawio", losses: [], preservedFragmentCount: 0 }}
        busy
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(dialog);
    expect(within(dialog).getByText("Working…")).toBeTruthy();
    for (const button of within(dialog).getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    const event = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("keeps one list item per reported loss, in order, and user file names untouched", () => {
    render(
      <DrawioReviewDialog
        review={{
          kind: "import",
          displayName: "{count} <b>plan</b>.drawio",
          losses: ["Third thing", "First thing", "Third thing"],
          preservedFragmentCount: 1,
        }}
        busy={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["Third thing", "First thing", "Third thing"]);
    expect(screen.getByText(/\{count\} <b>plan<\/b>\.drawio/)).toBeTruthy();
    // One fragment uses the singular phrase.
    expect(screen.getByRole("status").textContent).toMatch(
      /^1 safe source fragment will be retained/,
    );
  });

  it("is fully translated and retranslates when the language changes", () => {
    const review = {
      kind: "import" as const,
      displayName: "arquitectura.drawio",
      losses: ["Pérdida ya traducida por quien llama."],
      preservedFragmentCount: 3,
    };
    const { rerender } = render(
      <I18nProvider locale="es">
        <DrawioReviewDialog review={review} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </I18nProvider>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Revisar la importación de draw.io" });
    expect(
      within(dialog).getByText(/¿Importar arquitectura\.drawio como un documento nuevo/),
    ).toBeTruthy();
    expect(within(dialog).getByText(/Se conservarán 3 fragmentos seguros/)).toBeTruthy();
    expect(within(dialog).getByText("Pérdidas de compatibilidad conocidas")).toBeTruthy();
    expect(within(dialog).getByText("Pérdida ya traducida por quien llama.")).toBeTruthy();
    for (const name of ["Cancelar", "Importar diagrama"]) {
      expect(within(dialog).getByRole("button", { name })).toBeTruthy();
    }
    rerender(
      <I18nProvider locale="en">
        <DrawioReviewDialog review={review} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole("alertdialog", { name: "Review draw.io import" })).toBe(dialog);
    expect(within(dialog).getByText(/3 safe source fragments/)).toBeTruthy();
  });

  it("translates the empty-loss export review", () => {
    render(
      <I18nProvider locale="es">
        <DrawioReviewDialog
          review={{ kind: "export", losses: [], preservedFragmentCount: 0 }}
          busy={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Revisar la exportación a draw.io" });
    expect(within(dialog).getByText("No hay pérdidas de compatibilidad conocidas.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Guardar draw.io" })).toBeTruthy();
  });
});
