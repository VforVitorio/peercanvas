import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./svg";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;

describe("SVG preview sanitizer", () => {
  it("keeps supported drawing elements and rebuilds a safe SVG", () => {
    const result = sanitizeSvg(svg('<rect x="1" y="1" width="8" height="8" fill="#ffffff"/>'));

    expect(result).toContain("<rect");
    expect(result).toContain('fill="#ffffff"');
  });

  it("preserves meaningful spaces in text and tspan content", () => {
    const result = sanitizeSvg(svg("<text><tspan>A</tspan> <tspan>B</tspan></text>"));
    expect(result).toContain("</tspan> <tspan>");
  });

  it.each([
    svg("<script>alert(1)</script>"),
    svg('<rect onload="alert(1)"/>'),
    svg('<image href="https://example.test/pixel.svg"/>'),
    svg('<rect style="fill:url(https://example.test/a)"/>'),
    svg("<foreignObject><div>active</div></foreignObject>"),
    `<!DOCTYPE svg [<!ENTITY x "y">]>${svg("<rect/>")}`,
    svg('<rect fill="url(https://example.test/a)"/>'),
  ])("rejects active or unsupported content", (source) => {
    expect(sanitizeSvg(source)).toBeNull();
  });

  it("rejects oversized, deeply nested, and over-complex inputs", () => {
    expect(sanitizeSvg(svg(`<text>${"x".repeat(256 * 1024)}</text>`))).toBeNull();
    expect(sanitizeSvg(svg(`${"<g>".repeat(32)}<rect/>${"</g>".repeat(32)}`))).toBeNull();
    expect(sanitizeSvg(svg("<rect/>".repeat(2000)))).toBeNull();
    expect(sanitizeSvg(svg(`<text font-size="${"1".repeat(4097)}"/>`))).toBeNull();
  });
});
