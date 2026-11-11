# Editor-shell direction

Status: proposed design brief for [WP-00.3 / issue #18](https://github.com/furancho-labs/Peer2Canvas/issues/18), reviewed on 2026-11-10. This document adds no application controls.

## Purpose and current surface

PeerCanvas is a desktop diagram workspace. The canvas should occupy the main working area, with document context and contextual controls supporting the task around it. The [brand guide](brand-guide.md) records the maintainer-supplied assets, source snapshot, permitted project uses, and rights boundary.

At this revision, [App.tsx](../../src/App.tsx) renders the title and the text “Engineering scaffold. Diagram editing is not implemented yet.” No editor, document storage, collaboration, import/export, AI, or MCP workflow is available. WP-01 is an isolated test-only compatibility probe excluded from normal production builds; a successful fixture does not establish the later editor workflows.

## Brand expression

- Use the supplied small symbol to identify the app within the workspace. Reserve the full lockup for documentation and surfaces with enough room to preserve its aspect ratio.
- Follow the artwork's ink, cobalt-blue, and mint-green vocabulary. Use accents to communicate a meaningful action or state, with a second visual or text cue.
- Preserve the supplied marks without stretching, tracing, or recoloring. The Tauri ICO remains a format derivative of the supplied app icon.
- Keep exact UI color tokens and typeface choice open until they have been sampled, checked for contrast, and reviewed in real interface states. A logo image does not define a complete accessible UI palette.

## Proposed workspace hierarchy

1. A compact top area identifies the document and its actual state. Display a saved state only after persistence is implemented and verified.
2. The central Weave canvas is the primary workspace. Supporting tools and contextual properties should leave it enough room to operate the diagram.
3. Place selection and transform affordances with the canvas they affect. Keep selection and overlays transient; they must not become a second document model.
4. Reveal supporting panels for an implemented task and keep optional collaboration and assistant surfaces secondary to local editing.

The intended implementation hierarchy is Tauri window, React shell, Weave adapter, then the Weave renderer and interaction overlays. Adopt the required components from the official `weavejs-frontend` within the existing Tauri/Vite runtime. Record the upstream commit, copied files, and Apache-2.0 notices before distribution. The example application's TanStack Start shell is outside this adaptation.

## Accessibility constraints

The later editor must meet [NFR-010](../requirements/product-definition.md#non-functional-requirements): keyboard-operable essential create/edit/save/open flows and WCAG 2.2 AA for in-scope controls and dialogs. The design must provide:

- Visible focus, a predictable focus order, and a keyboard path to essential canvas operations.
- Accessible names for icon controls, clear action labels, and text feedback for selection and operation results.
- Non-color indicators for selection, errors, permissions, and connection state.
- Legible text, contrast-checked controls and focus indicators, and usable layouts when text is enlarged.
- A documented approach to exposing diagram structure and selection to assistive technology; a painted canvas alone is not sufficient evidence.

These are design and later acceptance constraints, not a claim that the scaffold or the WP-01 fixture has passed an accessibility audit.

## Placeholder and review boundary

Keep the normal app's current scaffold message honest until a product implementation change is approved and verified. The separate compatibility probe may expose only its test fixture and must identify itself as experimental. Do not add decorative save, sharing, import/export, or assistant controls that imply unavailable workflows.

The brief review used the stored brand board and verified the PNG dimensions recorded in the brand guide. It did not review an implemented editor layout, UI contrast, or native assistive-technology behavior. Review those states against this brief when the corresponding work package is implemented.
