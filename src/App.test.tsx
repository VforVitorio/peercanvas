import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("application shell", () => {
  it("renders the product name", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "PeerCanvas" })).toBeTruthy();
  });
});
