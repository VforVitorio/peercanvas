import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});
