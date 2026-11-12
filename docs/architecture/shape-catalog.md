# Shape catalog design

Status: schema v1 is defined and validated; no external shape or logo assets are bundled. Browse/search, SVG handling, and per-asset rights review remain in WP-05.2 and WP-05.3.

## Responsibilities

The catalog resolves a stable shape identifier to a renderer-compatible shape definition and searchable metadata. It is separate from document storage: documents reference stable shape identifiers and record the version/schema needed to render them.

## Manifest schema v1

The bundled manifest is `src/shapes/manifest.json`. It currently has no entries because no shape assets have completed rights review. Each entry records:

- a stable lowercase ID, display name, category, search keywords, and optional local preview path;
- source project, HTTPS source URL, source revision, asset version, and lowercase SHA-256 content hash;
- license identifier and HTTPS license text/source URL;
- attribution text and an optional trademark notice;
- explicit redistribution, modification, and commercial-use decisions (`permitted`, `prohibited`, or `unknown`);
- review status, reviewer, and review date.

Only structurally valid entries with an approved review and explicit redistribution permission are usable. Unreviewed, rejected, or rights-unknown entries are excluded and reported. Duplicate IDs exclude every occurrence so resolution cannot depend on array order. The validator checks manifest metadata and hash format; it does not fetch source URLs, verify legal claims, or recompute a digest without the asset file. Those checks belong to the per-asset review in WP-05.3.

The schema does not bind an asset to renderer/model versions. No bundled asset currently requires that compatibility rule; add it when a reviewed asset has a concrete renderer/model constraint.

A permissive repository license does not automatically cover logos, brand marks, imported stencils, fonts, or user-contributed assets. An asset with unknown rights stays out of the bundled catalog.

## Search and loading

Search is local and works offline. The first catalog can be a static manifest plus lazy asset loading. Do not add a remote catalog service unless the product later needs updates that cannot be shipped with a release.

## SVG boundary

Treat SVG as untrusted structured input. Parse and sanitize it before rendering. Reject scripts, event handlers, external network references, embedded HTML, unsafe CSS and oversized data. Keep a canonical asset entry and renderer-safe representation; do not mutate the original file in place.

## Verification

WP-05 must add manifest schema validation, deterministic search fixtures, sanitizer tests, and a license audit. Release review checks that each distributed shape is traceable to an allowed source and that notices are shipped where required.

## Initial rights review

- [Simple Icons](https://github.com/simple-icons/simple-icons) describes its icon assets as CC0, but brand/trademark policies still apply.
- Cloud vendor architecture assets have individual terms; do not infer unrestricted redistribution from public download access.
- draw.io source code licensing does not automatically grant redistribution rights to every icon or stencil included in the project.
- No third-party icon/logo assets are present in the current scaffold. This is a planning record, not a completed license audit.
