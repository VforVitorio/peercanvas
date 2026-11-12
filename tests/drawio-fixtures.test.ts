import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

type Fixture = {
  id: string;
  path: string;
  fixtureVersion: string;
  sha256: string;
  source: {
    project: string;
    url: string;
    revision: string;
    license: string;
    redistribution: string;
    attribution: string;
  };
  format: string;
  expectedOutcome: "import" | "reject";
  supportedSemantics: string[];
  expectedPreservedFragments: number;
  expectedLosses: string[];
};

const fixtureDirectory = resolve(process.cwd(), "tests/fixtures/drawio");
const manifest = JSON.parse(readFileSync(resolve(fixtureDirectory, "manifest.json"), "utf8")) as {
  schemaVersion: number;
  fixtures: Fixture[];
};

describe("draw.io fixture corpus", () => {
  it("records versioned first-party provenance, permission, coverage, and expected outcomes", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    expect(new Set(manifest.fixtures.map(({ id }) => id)).size).toBe(manifest.fixtures.length);
    expect(new Set(manifest.fixtures.map(({ path }) => path)).size).toBe(manifest.fixtures.length);
    for (const fixture of manifest.fixtures) {
      expect(fixture.fixtureVersion).toBe("1.0.0");
      expect(fixture.source).toMatchObject({
        project: "PeerCanvas synthetic fixture corpus",
        revision: "fixture-v1",
        license: "Apache-2.0",
        redistribution: "permitted",
      });
      expect(fixture.source.attribution).toMatch(/synthetic XML|input fixture/i);
      expect(fixture.supportedSemantics).toBeInstanceOf(Array);
      expect(fixture.expectedLosses).toBeInstanceOf(Array);
      expect(fixture.expectedPreservedFragments).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains only files whose bytes match their recorded hash", () => {
    for (const fixture of manifest.fixtures) {
      const file = resolve(fixtureDirectory, fixture.path);
      const relativePath = relative(fixtureDirectory, file);
      expect(isAbsolute(relativePath)).toBe(false);
      expect(relativePath === ".." || relativePath.startsWith(`..${sep}`)).toBe(false);
      const bytes = readFileSync(file);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.sha256);
    }
  });

  it("covers plain/compressed pages, linked safe fragments, expected loss, and rejection fixtures", () => {
    const byId = new Map(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
    expect(byId.get("basic-uncompressed")?.format).toBe("uncompressed-mxfile");
    expect(byId.get("compressed-page")?.format).toBe(
      "compressed-page-uri-encoded-raw-deflate-base64",
    );
    expect(byId.get("safe-linked-unsupported")).toMatchObject({
      expectedOutcome: "import",
      expectedPreservedFragments: 1,
      expectedLosses: [],
    });
    expect(byId.get("unsupported-setting")?.expectedLosses).toContain("mxGraphModel.grid");
    expect(byId.get("doctype-entity")?.expectedOutcome).toBe("reject");
    expect(byId.get("malformed-xml")?.expectedOutcome).toBe("reject");
    expect(byId.get("unsafe-svg")?.expectedLosses).toContain("embedded SVG and event handler");
  });
});
