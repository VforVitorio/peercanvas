# ADR-0006: Explicit draw.io compatibility subset

- **Status:** Proposed, gated on WP-06 fixtures.
- **Date:** 2026-11-07.

## Context

draw.io documents have XML-based graph structure, compressed variants, styles, metadata, custom elements, and embedded assets. Matching every feature is not a realistic initial target and silent losses would be harmful.

## Options

1. Build a separate import/export adapter with a tested subset and loss reporting.
2. Claim full compatibility before fixture coverage exists.
3. Convert through an external service.

## Decision

Use a versioned local adapter with a declared compatibility matrix. Parse safely, report unsupported transformations, preserve original fragments where safe, and never claim full parity without test evidence. No external conversion service is required.

## Rationale and consequences

An isolated adapter keeps the canonical model independent from an external file format and allows partial support to be transparent. This requires a curated fixture corpus and explicit mapping decisions.

## Risks and validation

WP-06 must test compressed/uncompressed inputs, multiple pages, geometry, labels, edges, unsupported styles, malformed XML, decompression limits, SVG sanitization, and round-trip semantics.
