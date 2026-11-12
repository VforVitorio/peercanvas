import { describe, expect, it } from "vitest";
import { searchShapes, shapePreviewDataUri } from "./catalog";
import { bundledShapeManifest, type ApprovedShapeManifestEntry } from "./manifest";

const entry = (
  id: string,
  displayName: string,
  category: string,
  keywords: string[],
): ApprovedShapeManifestEntry => ({
  id,
  displayName,
  category,
  keywords,
  previewPath: null,
  source: { project: "Fixture", url: "https://example.test/source", revision: "fixture-v1" },
  version: "1.0.0",
  sha256: "a".repeat(64),
  license: { identifier: "Fixture", sourceUrl: "https://example.test/license" },
  attribution: { text: "Synthetic fixture.", trademarkNotice: null },
  rights: { redistribution: "permitted", modification: "permitted", commercialUse: "permitted" },
  review: { status: "approved", reviewer: "Fixture reviewer", reviewedAt: "2026-11-12" },
});

describe("offline shape catalog", () => {
  it("searches names, categories, and keywords with deterministic ordering", () => {
    const entries = [
      entry("zulu-box", "Box", "Flow", ["rectangle"]),
      entry("alpha-box", "Box", "Basic", ["process"]),
      entry("cloud", "Cloud", "Network", ["node"]),
    ];

    expect(searchShapes(entries, "  PROCESS ").map(({ id }) => id)).toEqual(["alpha-box"]);
    expect(searchShapes(entries, "FLOW").map(({ id }) => id)).toEqual(["zulu-box"]);
    expect(searchShapes(entries, "").map(({ id }) => id)).toEqual([
      "alpha-box",
      "zulu-box",
      "cloud",
    ]);
    expect(entries.map(({ id }) => id)).toEqual(["zulu-box", "alpha-box", "cloud"]);
  });

  it("loads the local reviewed preview without fetching it", () => {
    const shape = bundledShapeManifest.entries[0];
    const preview = shapePreviewDataUri(shape);
    expect(preview).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(preview!.split(",", 2)[1])).toContain("<svg");
  });
});
