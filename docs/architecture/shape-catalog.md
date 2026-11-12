# Shape catalog design

Status: manifest schema v1 is validated. S3 adds a local catalog with one first-party rectangle preview under Apache-2.0, offline search, stable node references, and a bounded SVG sanitizer.

## Responsibilities

The catalog resolves stable shape identifiers to renderer-supported node types and searchable metadata. It stays separate from document storage. Schema-v2 nodes retain `catalogReference: { shapeId, version } | null`; the current renderer mapping supports `basic-rectangle` as a rectangle node. Entries without a renderer mapping are not offered as usable shapes.

## Manifest schema v1

The bundled manifest is `src/shapes/manifest.json`. Each entry records:

- a stable lowercase ID, display name, category, search keywords, and optional local preview path;
- source project, HTTPS source URL, source revision, asset version, and lowercase SHA-256 content hash;
- license identifier and HTTPS license text/source URL;
- attribution text and an optional trademark notice;
- explicit redistribution, modification, and commercial-use decisions (`permitted`, `prohibited`, or `unknown`);
- review status, reviewer, and review date.

Only structurally valid entries with an approved review and explicit redistribution permission are usable. Unreviewed, rejected, or rights-unknown entries are excluded. Duplicate IDs exclude every occurrence so resolution cannot depend on array order. The validator checks manifest metadata and hash format; it does not fetch source URLs or verify legal claims.

The bundled `assets/rectangle.svg` was authored for PeerCanvas. Its SHA-256 is `4d6734d996faaac492a34fc2d470bef63a40f9cc417988c8db85dccc944e88e7`; the manifest records its source path, asset version, Apache-2.0 license, attribution, rights, and review date. It contains no upstream artwork.

## Search and loading

Search is local and works offline. It trims the query, matches case-insensitive substrings in display name, category, and keywords, then sorts by lowercased display name and stable ID. The static bundled manifest is sufficient for S3; there is no remote catalog service.

## SVG boundary

The preview sanitizer rebuilds SVG using an allowlist of basic vector elements and attributes. It rejects scripts, event handlers, external references, CSS, embedded HTML, unsupported namespaces/elements/attributes, DTD/entity declarations, and input above 256 KiB, 2,000 elements, 32 nesting levels, or 4,096 characters per attribute value. The original bundled file stays unchanged; only the sanitized result is loaded through an image data URL.

## Verification

Catalog tests cover local deterministic search, shape insertion, schema-v2 reference round trips, and empty results. SVG fixtures cover active content and each input bound. WP-05.3 separately reviews direct and transitive dependency license metadata and all bundled assets.

## Asset review

- The catalog bundles no third-party icons, logos, fonts, stencils, or draw.io library assets.
- Cloud vendor architecture assets have individual terms; public download access does not establish redistribution permission.
- draw.io source licensing does not automatically grant rights to every icon or stencil in draw.io.
- The only current shape preview is original first-party artwork under Apache-2.0; its file hash matches the manifest.
