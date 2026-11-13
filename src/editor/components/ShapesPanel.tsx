import { useState } from "react";
import { useI18n } from "../../i18n";
import { shapeNodeType, shapePreviewDataUri } from "../../shapes/catalog";
import {
  bundledShapeManifest,
  type ApprovedShapeManifestEntry,
  type RightsPermission,
} from "../../shapes/manifest";
import { searchLocalizedShapes } from "./catalogText";

type Props = {
  disabled: boolean;
  onAddShape: (shape: ApprovedShapeManifestEntry) => void;
};

const insertable = bundledShapeManifest.entries.filter((entry) => shapeNodeType(entry) !== null);
const rights: Record<RightsPermission, string> = {
  permitted: "editor.shapes.rights.permitted",
  prohibited: "editor.shapes.rights.prohibited",
  unknown: "editor.shapes.rights.unknown",
};

/**
 * Approved local catalog. Names and categories of built-in entries are shown in the interface
 * language; attribution, license identifiers, and source records are shown as approved.
 */
export default function ShapesPanel({ disabled, onAddShape }: Props) {
  const { t, formatNumber } = useI18n();
  const [query, setQuery] = useState("");
  const results = searchLocalizedShapes(insertable, query, t);

  return (
    <section className="pc-section pc-shape-library" aria-labelledby="shape-library-heading">
      <h2 id="shape-library-heading" className="pc-section-title">
        {t("editor.shapes.library")}{" "}
        <span className="pc-count">{formatNumber(results.length)}</span>
      </h2>
      <div className="pc-field">
        <label htmlFor="shape-search">{t("editor.shapes.search")}</label>
        <input
          id="shape-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {results.length > 0 ? (
        <ul className="pc-shape-results" aria-label={t("editor.shapes.list")}>
          {results.map(({ entry, name, category }) => {
            const preview = shapePreviewDataUri(entry);
            return (
              <li key={entry.id} className="pc-shape-result">
                <button
                  type="button"
                  className="pc-shape-add"
                  aria-label={t("editor.shapes.add", { name })}
                  onClick={() => onAddShape(entry)}
                  disabled={disabled}
                >
                  {preview ? (
                    <img src={preview} alt="" aria-hidden="true" />
                  ) : (
                    <span className="pc-shape-fallback" aria-hidden="true" />
                  )}
                  <span>
                    <strong>{name}</strong>
                    <small>{t("editor.shapes.meta", { category, version: entry.version })}</small>
                  </span>
                </button>
                <details>
                  <summary>{t("editor.shapes.source")}</summary>
                  <p>{entry.attribution.text}</p>
                  <p>
                    {t("editor.shapes.licenseLine", {
                      license: entry.license.identifier,
                      redistribution: t(rights[entry.rights.redistribution]),
                    })}
                  </p>
                  <p>
                    {t("editor.shapes.sourceLine", {
                      project: entry.source.project,
                      revision: entry.source.revision,
                    })}
                  </p>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pc-empty" role="status">
          {t("editor.shapes.noMatches")}
        </p>
      )}
    </section>
  );
}
