import bundledManifestSource from "./manifest.json";

export const shapeManifestSchemaVersion = 1 as const;

export type RightsPermission = "permitted" | "prohibited" | "unknown";
export type ShapeReview =
  | { status: "unreviewed"; reviewer: null; reviewedAt: null }
  | { status: "approved" | "rejected"; reviewer: string; reviewedAt: string };

export interface ShapeManifestEntry {
  id: string;
  displayName: string;
  category: string;
  keywords: string[];
  previewPath: string | null;
  source: { project: string; url: string; revision: string };
  version: string;
  sha256: string;
  license: { identifier: string; sourceUrl: string };
  attribution: { text: string; trademarkNotice: string | null };
  rights: {
    redistribution: RightsPermission;
    modification: RightsPermission;
    commercialUse: RightsPermission;
  };
  review: ShapeReview;
}

export type ApprovedShapeManifestEntry = Omit<ShapeManifestEntry, "review"> & {
  review: { status: "approved"; reviewer: string; reviewedAt: string };
};

export interface ShapeManifest {
  schemaVersion: typeof shapeManifestSchemaVersion;
  entries: ShapeManifestEntry[];
}

export interface ShapeManifestIssue {
  code:
    | "INVALID_MANIFEST"
    | "INVALID_ENTRY"
    | "DUPLICATE_ID"
    | "REVIEW_REQUIRED"
    | "REVIEW_REJECTED"
    | "REDISTRIBUTION_NOT_PERMITTED";
  path: string;
  message: string;
}

export interface ShapeManifestResult {
  entries: ApprovedShapeManifestEntry[];
  issues: ShapeManifestIssue[];
}

type RecordValue = Record<string, unknown>;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const PERMISSIONS = ["permitted", "prohibited", "unknown"] as const;
const ENTRY_FIELDS = [
  "id",
  "displayName",
  "category",
  "keywords",
  "previewPath",
  "source",
  "version",
  "sha256",
  "license",
  "attribution",
  "rights",
  "review",
] as const;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const hasFields = (value: unknown, fields: readonly string[]): value is RecordValue =>
  isRecord(value) &&
  Object.keys(value).length === fields.length &&
  fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && value === value.trim();

const isHttpsUrl = (value: unknown): value is string => {
  if (!nonEmpty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
};

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

const hasControlCharacters = (value: string) =>
  value.split("").some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });

const isLocalPreviewPath = (value: unknown): value is string =>
  nonEmpty(value) &&
  !hasControlCharacters(value) &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
  value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");

const issue = (
  code: ShapeManifestIssue["code"],
  path: string,
  message: string,
): ShapeManifestIssue => ({ code, path, message });

function validateEntry(value: unknown, path: string): ShapeManifestIssue | null {
  if (!hasFields(value, ENTRY_FIELDS))
    return issue("INVALID_ENTRY", path, "Entry does not match schema v1.");
  if (typeof value.id !== "string" || !ID.test(value.id)) {
    return issue("INVALID_ENTRY", `${path}/id`, "Expected a lowercase stable ID slug.");
  }
  if (!nonEmpty(value.displayName) || !nonEmpty(value.category) || !nonEmpty(value.version)) {
    return issue("INVALID_ENTRY", path, "Display name, category, and version are required.");
  }
  if (!Array.isArray(value.keywords) || !value.keywords.every(nonEmpty)) {
    return issue("INVALID_ENTRY", `${path}/keywords`, "Keywords must be non-empty strings.");
  }
  if (value.previewPath !== null && !isLocalPreviewPath(value.previewPath)) {
    return issue(
      "INVALID_ENTRY",
      `${path}/previewPath`,
      "Preview references must be local relative paths.",
    );
  }
  if (
    !hasFields(value.source, ["project", "url", "revision"]) ||
    !nonEmpty(value.source.project) ||
    !isHttpsUrl(value.source.url) ||
    !nonEmpty(value.source.revision)
  ) {
    return issue(
      "INVALID_ENTRY",
      `${path}/source`,
      "Source project, HTTPS URL, and revision are required.",
    );
  }
  if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) {
    return issue("INVALID_ENTRY", `${path}/sha256`, "Expected a lowercase SHA-256 hex digest.");
  }
  if (
    !hasFields(value.license, ["identifier", "sourceUrl"]) ||
    !nonEmpty(value.license.identifier) ||
    !isHttpsUrl(value.license.sourceUrl)
  ) {
    return issue(
      "INVALID_ENTRY",
      `${path}/license`,
      "License identifier and HTTPS source URL are required.",
    );
  }
  if (
    !hasFields(value.attribution, ["text", "trademarkNotice"]) ||
    !nonEmpty(value.attribution.text) ||
    (value.attribution.trademarkNotice !== null && !nonEmpty(value.attribution.trademarkNotice))
  ) {
    return issue(
      "INVALID_ENTRY",
      `${path}/attribution`,
      "Attribution text and an optional trademark notice are required.",
    );
  }
  if (
    !hasFields(value.rights, ["redistribution", "modification", "commercialUse"]) ||
    !PERMISSIONS.includes(value.rights.redistribution as (typeof PERMISSIONS)[number]) ||
    !PERMISSIONS.includes(value.rights.modification as (typeof PERMISSIONS)[number]) ||
    !PERMISSIONS.includes(value.rights.commercialUse as (typeof PERMISSIONS)[number])
  ) {
    return issue("INVALID_ENTRY", `${path}/rights`, "Each rights decision must be explicit.");
  }
  if (!hasFields(value.review, ["status", "reviewer", "reviewedAt"])) {
    return issue(
      "INVALID_ENTRY",
      `${path}/review`,
      "Review status, reviewer, and date fields are required.",
    );
  }
  if (value.review.status === "unreviewed") {
    return value.review.reviewer === null && value.review.reviewedAt === null
      ? null
      : issue(
          "INVALID_ENTRY",
          `${path}/review`,
          "Unreviewed entries must not claim reviewer metadata.",
        );
  }
  if (value.review.status !== "approved" && value.review.status !== "rejected") {
    return issue("INVALID_ENTRY", `${path}/review/status`, "Expected an explicit review status.");
  }
  if (!nonEmpty(value.review.reviewer) || !isIsoDate(value.review.reviewedAt)) {
    return issue(
      "INVALID_ENTRY",
      `${path}/review`,
      "Reviewed entries require a reviewer and valid date.",
    );
  }
  return null;
}

export function parseShapeManifest(value: unknown): ShapeManifestResult {
  if (!hasFields(value, ["schemaVersion", "entries"])) {
    return {
      entries: [],
      issues: [issue("INVALID_MANIFEST", "", "Manifest does not match schema v1.")],
    };
  }
  if (value.schemaVersion !== shapeManifestSchemaVersion || !Array.isArray(value.entries)) {
    return {
      entries: [],
      issues: [
        issue("INVALID_MANIFEST", "/schemaVersion", "Unsupported or invalid manifest schema."),
      ],
    };
  }

  const issues: ShapeManifestIssue[] = [];
  const idIndexes = new Map<string, number[]>();
  value.entries.forEach((rawEntry, index) => {
    if (!isRecord(rawEntry) || typeof rawEntry.id !== "string" || !ID.test(rawEntry.id)) return;
    const indexes = idIndexes.get(rawEntry.id) ?? [];
    indexes.push(index);
    idIndexes.set(rawEntry.id, indexes);
  });

  const duplicates = new Set<number>();
  for (const [id, indexes] of idIndexes) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      duplicates.add(index);
      issues.push(issue("DUPLICATE_ID", `/entries/${index}/id`, `Duplicate shape ID '${id}'.`));
    }
  }

  const entries: ApprovedShapeManifestEntry[] = [];
  value.entries.forEach((rawEntry, index) => {
    if (duplicates.has(index)) return;
    const path = `/entries/${index}`;
    const invalidEntry = validateEntry(rawEntry, path);
    if (invalidEntry !== null) {
      issues.push(invalidEntry);
      return;
    }

    const entry = rawEntry as ShapeManifestEntry;
    if (entry.review.status === "unreviewed") {
      issues.push(issue("REVIEW_REQUIRED", `${path}/review`, "Unreviewed entries are excluded."));
      return;
    }
    if (entry.review.status === "rejected") {
      issues.push(issue("REVIEW_REJECTED", `${path}/review`, "Rejected entries are excluded."));
      return;
    }
    if (entry.rights.redistribution !== "permitted") {
      issues.push(
        issue(
          "REDISTRIBUTION_NOT_PERMITTED",
          `${path}/rights/redistribution`,
          "Redistribution must be explicitly permitted.",
        ),
      );
      return;
    }
    entries.push(entry as ApprovedShapeManifestEntry);
  });

  return { entries, issues };
}

export const bundledShapeManifest = parseShapeManifest(bundledManifestSource);
