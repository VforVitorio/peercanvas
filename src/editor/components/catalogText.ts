import { searchShapes } from "../../shapes/catalog";
import type { ApprovedShapeManifestEntry } from "../../shapes/manifest";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Interface-language presentation of built-in catalog entries. The approved manifest stays
 * unchanged (it remains the identity and attribution record); unknown entries show it as is.
 * Literal keys keep the resource scan able to verify every key.
 */
const builtIn: Record<string, { name: string; keywords: string }> = {
  "basic-rectangle": {
    name: "editor.defaults.rectangle",
    keywords: "editor.catalog.basicRectangle.keywords",
  },
};
const categories: Record<string, string> = { Basic: "editor.catalog.category.basic" };

export type LocalizedShape = {
  entry: ApprovedShapeManifestEntry;
  name: string;
  category: string;
  keywords: string[];
};

export function localizeShape(entry: ApprovedShapeManifestEntry, t: Translate): LocalizedShape {
  const text = builtIn[entry.id];
  const category = categories[entry.category];
  return {
    entry,
    name: text ? t(text.name) : entry.displayName,
    category: category ? t(category) : entry.category,
    keywords: text
      ? t(text.keywords)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
  };
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Matches the approved manifest search plus the localized name, category, and keywords, so a
 * Spanish query such as "rectángulo" or "caja" finds the same approved entry.
 */
export function searchLocalizedShapes(
  entries: ApprovedShapeManifestEntry[],
  query: string,
  t: Translate,
): LocalizedShape[] {
  const term = normalize(query.trim());
  const manifestMatches = new Set(searchShapes(entries, query).map((entry) => entry.id));
  return entries
    .map((entry) => localizeShape(entry, t))
    .filter(
      (shape) =>
        manifestMatches.has(shape.entry.id) ||
        [shape.name, shape.category, ...shape.keywords].some((value) =>
          normalize(value).includes(term),
        ),
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || (left.entry.id < right.entry.id ? -1 : 1),
    );
}
