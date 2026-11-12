# draw.io compatibility

Status: Implemented on `feature/wp-06-drawio-interchange`; local tests pass. This work is not merged or released.

## Scope

PeerCanvas imports and exports a declared subset of draw.io documents. Compatibility is limited to the formats and semantics in this note. Import runs locally and stages a new unsaved document; it does not modify the source file or replace the active document until the user reviews and confirms it.

## Supported subset

| Feature                    | Behavior                                                                                                                  | Evidence                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| XML input                  | UTF-8 `.drawio` or `.xml` with an `<mxfile>` root or a bare `<mxGraphModel>` root                                         | `basic-uncompressed.drawio`; bare-root unit test           |
| Pages                      | One to 100 pages; page order and names are retained                                                                       | Multi-page unit test; compressed and uncompressed fixtures |
| Cells                      | Rectangles and plain text with finite position, size, and rotation                                                        | `basic-uncompressed.drawio`; round-trip test               |
| Basic styles               | RGB fill, stroke, and text colors, stroke width, and font size                                                            | `basic-uncompressed.drawio`; round-trip test               |
| Connections                | Straight connections between mapped nodes, with plain-text labels and no arrows                                           | `basic-uncompressed.drawio`; round-trip test               |
| Compressed pages           | URI-encoded raw DEFLATE followed by Base64                                                                                | `compressed-page.drawio`                                   |
| Safe unsupported cells     | Bounded `<mxCell>` fragments remain inert in the document and can be exported with their mapped source IDs and references | `safe-linked-unsupported.drawio`; fragment round-trip test |
| Deleted fragment targets   | The source fragment stays in the document, but export omits it and reports the loss while a mapped target is missing      | Stale-reference test                                       |
| Unsupported graph settings | Known unsupported values are reported before import confirmation                                                          | `unsupported-setting.drawio` reports `mxGraphModel.grid`   |

Unknown safe cells are preserved as source fragments, never rendered or executed. Other unsupported content is either reported as a loss or rejected when it cannot be safely retained.

## Rejection and resource limits

The parser rejects malformed XML, DTDs and entity declarations, namespaced XML, embedded HTML/SVG, event handlers, external references, and inputs over the configured limits. The fixture corpus includes malformed XML, a DTD/entity payload, and an unsafe embedded SVG with an event handler.

| Limit                           | Maximum |
| ------------------------------- | ------: |
| Encoded input file              |  10 MiB |
| Total decoded page XML          |  10 MiB |
| Compressed page expansion ratio |   100:1 |
| XML elements                    | 250,000 |
| XML nesting depth               |      64 |
| Pages                           |     100 |
| Layers                          |   1,000 |
| Nodes and connections           | 100,000 |
| Node and connection labels      | 100,000 characters each |
| Page, layer, and document titles | 256 characters each |
| Source cell identifiers         | 256 UTF-8 bytes each |
| Styles                          |  10,000 |
| Source ID mappings              | 100,000 |
| Preserved fragments             |   1,000 |
| One preserved fragment          |  64 KiB |
| All preserved fragments         |   1 MiB |

## Export and file safety

Before export, PeerCanvas shows known losses and requires confirmation when the report is non-empty. The user selects a local `.drawio` or `.xml` destination. Replacing an existing regular file requires a separate confirmation. A canceled export does not write. Failed publication restores the previous destination if it remains free; if another file appears during an overwrite, PeerCanvas leaves that file untouched, keeps the previous bytes in a recovery backup beside it, and reports that backup. Export does not change the active document.

To verify the previous destination before overwriting, PeerCanvas reads it as UTF-8 and applies the 10 MiB file limit. Larger or non-UTF-8 files are refused rather than replaced.

The exporter validates the generated XML before writing. Temporary export backups use unique sibling names and do not replace the document-recovery `.bak` file.

## Verification

The first-party corpus is in [`tests/fixtures/drawio/`](../../tests/fixtures/drawio/). Its manifest records the synthetic source, Apache-2.0 permission, version, hash, feature coverage, and expected outcome for each fixture. Rust unit tests also exercise bare and multiple pages, hostile content, round trips, stale fragment references, XML limits, and decompression limits.

The local Rust release check is a compile check, not a native UI smoke test. The local Tauri bundle attempt failed while generating the macOS app icon (`No matching IconType` for the configured PNG), so native file-dialog interaction remains unverified. Cross-platform required CI is separate evidence.

## Related decisions and references

- [ADR-0006: Explicit draw.io compatibility subset](decisions/ADR-0006-drawio-compatibility.md)
- [ADR-0007: Version the document model for catalog and draw.io references](decisions/ADR-0007-document-schema-v2-compatibility.md)
- [draw.io file format notes](https://github.com/jgraph/drawio/wiki/File-Format)
- [draw.io repository and licensing notes](https://github.com/jgraph/drawio)
- [OWASP XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
