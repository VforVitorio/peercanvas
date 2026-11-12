# Spec Delta

## Purpose

Defines the supported draw.io document subset and how the application reports unsupported or lossy content during interchange.

## ADDED Requirements

### Requirement: Publish the supported draw.io subset

The system SHALL document the draw.io formats and semantic features it supports for each release. The initial importer SHALL accept UTF-8 `.drawio` or `.xml` files with an `<mxfile>` root or a bare `<mxGraphModel>` root, including uncompressed pages and pages encoded as URI-encoded raw DEFLATE and Base64 text. It SHALL map at most 100 pages and the supported rectangle, plain-text, basic-style, and straight-connection semantics.

#### Scenario: Import a supported document

- **WHEN** a user imports a document using a declared supported format and feature subset
- **THEN** the system maps supported semantics into the active document and reports any unsupported content

### Requirement: Report unsupported draw.io content

The system SHALL identify unsupported or lossy constructs before the user confirms an import or export that would discard their meaning.

#### Scenario: Import includes an unsupported construct

- **WHEN** an imported document contains a construct outside the declared supported subset
- **THEN** the system presents a compatibility report and does not silently claim full fidelity

#### Scenario: Export would lose content

- **WHEN** exporting would omit or change supported source content
- **THEN** the system reports the known loss before writing the destination file

### Requirement: Preserve safe unsupported source content

The system SHALL preserve unsupported `<mxCell>` fragments for possible round-trip when their content is inert, their internal IDs and references are safe, and they fit within the documented resource limits. Source IDs for mapped cells SHALL be retained so safe fragments can keep their references. Preserved fragments SHALL remain inert and SHALL NOT be rendered or executed by PeerCanvas.

#### Scenario: Preserve an unknown safe fragment

- **WHEN** an unknown fragment is within configured limits and passes safety checks
- **THEN** the system retains it without executing or rendering it as trusted content

### Requirement: Reject unsafe or over-limit files

The system SHALL reject files that exceed 10 MiB encoded size, 10 MiB total decoded XML, a 100:1 page expansion ratio, 250,000 XML nodes, 64 levels of nesting, or 100 pages without partially changing the active document. It SHALL reject DTDs, entity declarations, malformed XML, scripts, embedded HTML/SVG, event handlers, and external resource references. Safe unsupported fragments retained in a document SHALL be limited to 1,000 fragments, 64 KiB per fragment, and 1 MiB total.

#### Scenario: Input exceeds a limit

- **WHEN** the importer detects an unsafe or over-limit input
- **THEN** it stops parsing, reports the limit, and leaves the active document unchanged
