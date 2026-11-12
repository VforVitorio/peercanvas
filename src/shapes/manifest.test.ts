import { describe, expect, it } from "vitest";
import { bundledShapeManifest, parseShapeManifest } from "./manifest";

const reviewedEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "example-shape",
  displayName: "Example Shape",
  category: "basic",
  keywords: ["example", "test"],
  previewPath: null,
  source: {
    project: "Synthetic test fixture",
    url: "https://example.test/shapes",
    revision: "fixture-v1",
  },
  version: "1.0.0",
  sha256: "a".repeat(64),
  license: { identifier: "Example-Test", sourceUrl: "https://example.test/license" },
  attribution: { text: "Synthetic fixture; no asset is included.", trademarkNotice: null },
  rights: {
    redistribution: "permitted",
    modification: "permitted",
    commercialUse: "permitted",
  },
  review: { status: "approved", reviewer: "PeerCanvas test", reviewedAt: "2026-11-12" },
  ...overrides,
});

const manifest = (entries: unknown[]) => ({ schemaVersion: 1, entries });

describe("shape manifest", () => {
  it("starts with an empty, valid bundled manifest until asset rights are reviewed", () => {
    expect(bundledShapeManifest).toEqual({ entries: [], issues: [] });
  });

  it("includes only approved entries with explicit redistribution permission", () => {
    const unreviewed = reviewedEntry({
      id: "unreviewed-shape",
      review: { status: "unreviewed", reviewer: null, reviewedAt: null },
    });
    const rejected = reviewedEntry({
      id: "rejected-shape",
      review: { status: "rejected", reviewer: "Reviewer", reviewedAt: "2026-11-12" },
    });
    const unknownRights = reviewedEntry({
      id: "unknown-rights-shape",
      rights: { redistribution: "unknown", modification: "unknown", commercialUse: "unknown" },
    });

    const result = parseShapeManifest(
      manifest([reviewedEntry(), unreviewed, rejected, unknownRights]),
    );

    expect(result.entries.map((entry) => entry.id)).toEqual(["example-shape"]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "REVIEW_REQUIRED",
      "REVIEW_REJECTED",
      "REDISTRIBUTION_NOT_PERMITTED",
    ]);
  });

  it("excludes entries with missing metadata or invalid fields", () => {
    const missingLicense: Record<string, unknown> = reviewedEntry();
    delete missingLicense.license;
    const invalidHash = reviewedEntry({ id: "bad-hash", sha256: "not-a-digest" });
    const invalidSource = reviewedEntry({
      id: "bad-source",
      source: {
        project: "Synthetic test fixture",
        url: "http://example.test/shapes",
        revision: "v1",
      },
    });

    const result = parseShapeManifest(manifest([missingLicense, invalidHash, invalidSource]));

    expect(result.entries).toEqual([]);
    expect(result.issues).toHaveLength(3);
    expect(result.issues.every((issue) => issue.code === "INVALID_ENTRY")).toBe(true);
  });

  it("rejects control characters that URL parsing could strip from local preview paths", () => {
    const result = parseShapeManifest(
      manifest([reviewedEntry({ previewPath: "\u0000https:evil.test/shape.svg" })]),
    );

    expect(result.entries).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_ENTRY", path: "/entries/0/previewPath" }),
    );
  });

  it("excludes every entry sharing a stable ID", () => {
    const first = reviewedEntry();
    const duplicate = reviewedEntry({ displayName: "Other Shape" });

    const result = parseShapeManifest(manifest([first, duplicate]));

    expect(result.entries).toEqual([]);
    expect(result.issues.filter((issue) => issue.code === "DUPLICATE_ID")).toHaveLength(2);
  });

  it("rejects an unsupported manifest schema version", () => {
    const result = parseShapeManifest({ schemaVersion: 2, entries: [reviewedEntry()] });

    expect(result.entries).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_MANIFEST", path: "/schemaVersion" }),
    );
  });
});
