# Shape catalog design

Status: proposed; no external shape or logo catalog is bundled.

## Responsibilities

The catalog resolves a stable shape identifier to a renderer-compatible shape definition and searchable metadata. It is separate from document storage: documents reference stable shape identifiers and record the version/schema needed to render them.

## Manifest fields

Each asset entry should include:

- stable identifier, display name, category, keywords and preview reference;
- source project, source URL, repository commit/tag or release;
- license identifier and license text/source;
- required attribution and any trademark notice;
- content hash and version;
- supported renderer/model version;
- review status, reviewer and review date;
- whether redistribution, modification and commercial use are allowed.

An asset with unknown rights stays out of the bundled catalog. A permissive repository license does not automatically cover logos, brand marks, imported stencils, fonts, or user-contributed assets.

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
