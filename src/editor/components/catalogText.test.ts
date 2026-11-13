import { describe, expect, it } from "vitest";
import { bundledShapeManifest } from "../../shapes/manifest";
import { localizeShape, searchLocalizedShapes } from "./catalogText";

// A stand-in translator keeps this test independent of resource wording.
const spanish: Record<string, string> = {
  "editor.defaults.rectangle": "Rectángulo",
  "editor.catalog.basicRectangle.keywords": "caja, proceso, forma",
  "editor.catalog.category.basic": "Básicas",
};
const t = (key: string) => spanish[key] ?? key;
const entries = bundledShapeManifest.entries;

describe("localized catalog presentation", () => {
  it("localizes built-in names without changing the approved manifest", () => {
    const before = JSON.stringify(entries);
    const shape = localizeShape(entries[0], t);
    expect(shape).toMatchObject({ name: "Rectángulo", category: "Básicas" });
    expect(shape.entry.displayName).toBe("Rectangle");
    expect(JSON.stringify(entries)).toBe(before);
  });

  it("finds entries by localized terms without diacritics and by manifest terms", () => {
    for (const query of ["rectangulo", "RECTÁNGULO", "caja", "box", "Rectangle", "  "]) {
      expect(searchLocalizedShapes(entries, query, t).map((shape) => shape.entry.id)).toEqual([
        "basic-rectangle",
      ]);
    }
    expect(searchLocalizedShapes(entries, "círculo", t)).toEqual([]);
  });
});
