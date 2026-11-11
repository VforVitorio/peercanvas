import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness } from "./test/weaveMock";
import App from "./App";

vi.mock("@inditextech/weave-sdk", async () => (await import("./test/weaveMock")).sdk);
vi.mock(
  "@inditextech/weave-renderer-konva-base",
  async () => (await import("./test/weaveMock")).renderer,
);
vi.mock(
  "@inditextech/weave-store-standalone/client",
  async () => (await import("./test/weaveMock")).store,
);

const SLOW = { timeout: 3000 };

// jsdom performs no layout; give the Weave host a fixed size so viewport fitting is observable.
let sized = true;
beforeEach(() => {
  harness.reset();
  sized = true;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => (sized ? 700 : 0));
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() =>
    sized ? 600 : 0,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openFixture(title = "Product architecture") {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }));
  await screen.findByRole("region", { name: /Diagram canvas/ }, SLOW);
  await waitFor(() => expect(harness.instances.length).toBeGreaterThan(0));
}

const zoomLabel = () => screen.getByRole("button", { name: /^Zoom \d+%/ }).textContent;
const saveStatus = () => screen.getByTestId("save-status").textContent;

describe("initial fit to content", () => {
  it("fits the complete fixture on first activation without dirtying the document", async () => {
    await openFixture();
    // Rightmost node edge is x=860; (700 - 96) / 860 = 70%.
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    await waitFor(() => expect(harness.latest().stage.scaleValue.x).toBeCloseTo(0.7, 2), SLOW);
    expect(saveStatus()).not.toMatch(/Unsaved/);
    expect(screen.getByText(/Revision 0\b/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps a manual zoom after the initial fit, including across edits and pages", async () => {
    await openFixture();
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(zoomLabel()).toBe("75%");
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Data flow" }));
    // First visit to another page fits that page once; returning keeps whatever the user set.
    // Data flow's right edge is x=680: (700 - 96) / 680 = 89%.
    await waitFor(() => expect(zoomLabel()).toBe("89%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "System overview" }));
    await waitFor(() => expect(zoomLabel()).toBe("75%"), SLOW);
  });

  it("still fits on request with the keyboard-reachable control", async () => {
    await openFixture();
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit to content" }));
    await waitFor(() => expect(zoomLabel()).toBe("70%"), SLOW);
  });

  it("waits for a laid-out viewport instead of fitting against zero size", async () => {
    sized = false;
    await openFixture();
    expect(zoomLabel()).toBe("100%");
  });
});

describe("semantic appearance across editor themes", () => {
  const setTheme = (name: "Dark" | "Light") => {
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Preferences/ }));
    fireEvent.click(screen.getByRole("radio", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
  };

  it("projects identical default and explicit appearance in light and dark chrome", async () => {
    await openFixture();
    fireEvent.click(screen.getAllByRole("button", { name: "Add rectangle" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    const snapshot = () =>
      JSON.stringify(
        harness
          .latest()
          .elements.map((element) => [element.key, element.props])
          .sort(),
      );
    await waitFor(() => expect(harness.latest().elements.length).toBeGreaterThan(5), SLOW);
    const light = snapshot();
    const instancesBefore = harness.instances.length;

    setTheme("Dark");
    expect(document.querySelector<HTMLElement>(".pc-root")!.dataset.theme).toBe("dark");
    await waitFor(() => expect(snapshot()).toBe(light));
    // Theme is chrome only: it neither re-renders the canvas nor touches the document.
    expect(harness.instances.length).toBe(instancesBefore);
    expect(saveStatus()).toBe("Unsaved changes");
    expect(screen.getByText(/Revision 2\b/)).toBeTruthy();

    setTheme("Light");
    expect(snapshot()).toBe(light);
  });

  it("renders Add text with legible black default text and no fill/stroke in dark chrome", async () => {
    await openFixture();
    setTheme("Dark");
    fireEvent.click(screen.getAllByRole("button", { name: "Add text" })[0]);
    await waitFor(() =>
      expect(
        harness
          .latest()
          .elements.some((e) => e.props.nodeType === "rectangle" && e.props.fill === "transparent"),
      ).toBe(true),
    );
    const text = harness
      .latest()
      .elements.find((e) => e.props.fill === "transparent" && e.props.strokeWidth === 0)!;
    expect(text.props).toMatchObject({
      fill: "transparent",
      stroke: "transparent",
      labelFill: "#000000",
      labelFontSize: 16,
    });
    // Explicit fixture styling is unchanged by the dark theme.
    expect(harness.latest().nodeByLabel("Web client")).toMatchObject({
      fill: "#e8efff",
      stroke: "#3155b7",
      strokeWidth: 2,
      labelFill: "#182646",
    });
  });
});
