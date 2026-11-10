# PeerCanvas brand assets

These original PNGs were supplied by the project maintainer for repository and product branding and are preserved unchanged in this directory.

The maintainer identified the source bundle as `PeerCanvas_Branding_PNG_2026-11-07.zip`. The bundle date is the asset snapshot version; no separate artwork license was supplied.

## Asset inventory

| File                               |  Dimensions | Intended use                                |
| ---------------------------------- | ----------: | ------------------------------------------- |
| assets/peercanvas-brand-board.png  |  1774 × 887 | Brand reference board                       |
| assets/peercanvas-symbol-color.png | 1024 × 1024 | Standalone mark in docs and app surfaces    |
| assets/peercanvas-app-icon.png     | 1024 × 1024 | Tauri app icon source                       |
| assets/peercanvas-lockup-color.png |  1492 × 349 | Primary README and light-surface lockup     |
| assets/peercanvas-lockup-mono.png  |   575 × 140 | Monochrome lockup when color cannot be used |

Use these original assets without tracing, recoloring, or stretching. Preserve their aspect ratio and transparent backgrounds.

`src-tauri/icons/icon.ico` is generated from the supplied app icon with the Tauri icon command so Windows can embed its required application resource. It is a format derivative of the same maintainer-provided artwork.

## Visual direction for the first interface pass

The product surface is an editor people operate. The canvas will be the primary working area; the brand mark supports navigation and identity without turning the editor into a marketing page. The supplied artwork establishes an ink, cobalt-blue, and mint-green identity with open interlocking corner forms. Use that vocabulary to guide spacing and accent placement.

The app interface must be designed around the real Weave.js canvas integration rather than a decorative screenshot or a second custom drawing surface. Do not implement or imply canvas interactions until the corresponding work package is approved and verified. The reviewable [editor-shell direction](editor-shell-direction.md) records the proposed hierarchy, accessibility constraints, and current placeholder boundary for WP-00.3.

Exact CSS color values and UI typefaces are not specified in these PNGs. Sample and validate them from the original artwork before defining reusable design tokens. The UI shell remains a placeholder until a separate visual implementation change is approved.

## Rights

Provenance and attribution are recorded as maintainer-supplied PeerCanvas branding. The authorized project uses are repository documentation, the native app icon, and PeerCanvas product surfaces. Their usage is separate from the Apache-2.0 license for project code; no independent artwork redistribution or reuse permission is recorded for third parties.

The stored brand board and PNG dimensions were inspected on 2026-11-10 for the direction brief. The inventory records the supplied files and intended uses; it does not establish additional artwork rights.
