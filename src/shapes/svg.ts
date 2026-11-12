const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ELEMENTS = new Set([
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
]);
const ATTRIBUTES = new Set([
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "dx",
  "dy",
  "points",
  "d",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
  "clip-rule",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "transform",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
]);
const MAX_BYTES = 256 * 1024;
const MAX_ELEMENTS = 2000;
const MAX_DEPTH = 32;
const MAX_ATTRIBUTE_CHARS = 4096;
const ACTIVE_VALUE = /(?:url\s*\(|javascript\s*:|data\s*:|https?\s*:|file\s*:|@import|\\)/i;

export function sanitizeSvg(source: string): string | null {
  if (
    new TextEncoder().encode(source).length > MAX_BYTES ||
    /<!DOCTYPE|<!ENTITY/i.test(source) ||
    typeof DOMParser === "undefined" ||
    typeof XMLSerializer === "undefined"
  )
    return null;

  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const originalRoot = parsed.documentElement;
  if (
    parsed.getElementsByTagName("parsererror").length > 0 ||
    originalRoot.localName !== "svg" ||
    originalRoot.namespaceURI !== SVG_NAMESPACE
  )
    return null;

  const output = document.implementation.createDocument(SVG_NAMESPACE, "svg");
  const root = output.documentElement;
  root.setAttribute("xmlns", SVG_NAMESPACE);
  let elementCount = 0;

  function copy(sourceElement: Element, targetElement: Element, depth: number): boolean {
    elementCount++;
    if (
      depth > MAX_DEPTH ||
      elementCount > MAX_ELEMENTS ||
      sourceElement.namespaceURI !== SVG_NAMESPACE ||
      !ELEMENTS.has(sourceElement.localName)
    )
      return false;

    for (const attribute of Array.from(sourceElement.attributes)) {
      if (sourceElement === originalRoot && attribute.name === "xmlns") continue;
      if (
        attribute.namespaceURI !== null ||
        !ATTRIBUTES.has(attribute.name) ||
        attribute.value.length > MAX_ATTRIBUTE_CHARS ||
        ACTIVE_VALUE.test(attribute.value)
      )
        return false;
      targetElement.setAttribute(attribute.name, attribute.value);
    }

    for (const child of Array.from(sourceElement.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.textContent ?? "";
        const isTextContent = ["text", "tspan"].includes(sourceElement.localName);
        if (value.trim() !== "" && !isTextContent) return false;
        if (isTextContent && value !== "") targetElement.appendChild(output.createTextNode(value));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return false;
      const sourceChild = child as Element;
      const targetChild = output.createElementNS(SVG_NAMESPACE, sourceChild.localName);
      if (!copy(sourceChild, targetChild, depth + 1)) return false;
      targetElement.appendChild(targetChild);
    }
    return true;
  }

  if (!copy(originalRoot, root, 1)) return null;
  return new XMLSerializer().serializeToString(output);
}
