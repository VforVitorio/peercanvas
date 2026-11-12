# ADR-0007: Version the document model for catalog and draw.io references

- **Status:** Accepted by the maintainer for S3.
- **Date:** 2026-11-12.

## Context

Schema v1 reserves catalog and source-compatibility data as empty or null. S3 requires shape nodes to retain a stable catalog ID and asset version, and draw.io import/export to retain some unsupported source fragments safely. Adding either value to schema v1 would make existing strict validation reject its own output or silently discard data.

## Decision

Persist schema v2. Each node has a nullable `catalogReference` containing the manifest shape ID and asset version. `sourceCompatibility` is either null or a draw.io v1 object with source page IDs, a mapping from source cell IDs to canonical node/connection IDs, and preserved cell fragments for each PeerCanvas page. Schema-v0 and schema-v1 documents migrate in memory to v2 with null catalog references and no source fragments; they become dirty and are rewritten only after a successful user save.

Preserved fragments remain inert and are never rendered. The importer retains bounded unsupported `<mxCell>` fragments with no active content or external references. The source-cell mapping lets export preserve references between these fragments and mapped cells. If an edit deletes a mapped target, the source fragment remains stored in the document but is omitted from export with a loss report. Removing a page removes its compatibility record; undo restores the record with the page.

The initial interchange limit is 10 MiB encoded input, 10 MiB decoded XML in total, a 100:1 compressed-page expansion ratio, 250,000 XML nodes, 64 levels of nesting, and 100 pages. Preserved source data is capped at 1,000 fragments, 64 KiB per fragment, and 1 MiB total; the source-cell map is capped at 100,000 entries. Schema-v2 document validation applies the same preservation bounds before save; the native exporter reparses each fragment before writing it.

## Consequences

- The canonical TypeScript model remains the only document authority; catalog and source references are validated data, not renderer or native state.
- Old supported documents remain readable and are not rewritten until an explicit save succeeds.
- The importer and exporter support a declared subset. Unsafe or over-limit source cells are rejected; other unsupported content is reported before import confirmation. Safe fragments retain relationships to mapped cells while their targets exist.
- External shape libraries, arbitrary XML extensions, embedded SVG/images, and full draw.io fidelity remain outside S3.

## Verification

WP-05 verifies reference persistence and v0/v1 migration. WP-06 verifies bounded XML/DEFLATE parsing, safe-fragment persistence, loss reporting, overwrite confirmation, and round-trip behavior against the versioned fixture corpus.
