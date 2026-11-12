# Third-party notices

PeerCanvas is an independent project. References to upstream projects do not imply endorsement or official affiliation.

## Dependency license inventory (2026-11-12)

[`LICENSES/dependency-inventory-2026-11.csv`](LICENSES/dependency-inventory-2026-11.csv) records the locked dependency license expressions, upstream source URLs, and metadata sources. It contains 344 npm entries (8 direct runtime, 19 direct build/test, 317 transitive) and 448 Cargo entries (4 direct runtime, 1 direct build, 1 optional direct, 441 transitive, and the project crate). The inventory includes all locked platform variants; 40 npm entries are not installed on this macOS host (mostly platform-specific packages) but have license metadata in `package-lock.json`. The root package and Cargo crate both identify the project's Apache-2.0 license. All 792 inventory records have license metadata across 34 distinct expressions; no `UNKNOWN` entries remain.

Special license and attribution records:

- **caniuse-lite 1.0.30001823 — CC-BY-4.0.** Its attribution and license text are retained in [`LICENSES/CC-BY-4.0.txt`](LICENSES/CC-BY-4.0.txt); the upstream attribution is **caniuse.com**. The package is part of the CSS/browser-support toolchain. Source: [caniuse-lite](https://github.com/browserslist/caniuse-lite).
- **lightningcss 1.33.0 and platform bindings — MPL-2.0.** The license text is retained in [`LICENSES/MPL-2.0.txt`](LICENSES/MPL-2.0.txt). This npm subtree is in the build toolchain; several Cargo dependencies also declare MPL-2.0. Sources: [Lightning CSS](https://github.com/parcel-bundler/lightningcss) and [`cssparser`](https://github.com/servo/rust-cssparser).
- **ICU4X crates and unicode-ident — Unicode-3.0.** Both copyright notices and permission texts are retained in [`LICENSES/Unicode-3.0.txt`](LICENSES/Unicode-3.0.txt); see the [Unicode license](https://www.unicode.org/license.txt).
- **argparse 2.0.1 — Python-2.0.** This is a transitive development dependency; its package license file is retained at [`LICENSES/Python-2.0.txt`](LICENSES/Python-2.0.txt). Source: [nodeca/argparse](https://github.com/nodeca/argparse).
- **minimatch 10.2.6 and lru-cache 11.5.3 — BlueOak-1.0.0.** The license text is retained at [`LICENSES/BlueOak-1.0.0.txt`](LICENSES/BlueOak-1.0.0.txt), with the [official license](https://blueoakcouncil.org/license/1.0.0) linked for reference.
- **0BSD** appears as one option for adler2 and as the metadata license for a lock-only tslib entry; its zero-clause terms require no additional notice. SPDX `OR` expressions are recorded verbatim in the inventory. For r-efi, PeerCanvas selects the Apache-2.0 option from `MIT OR Apache-2.0 OR LGPL-2.1-or-later`.

The inventory preserves combined expressions rather than flattening them. In particular, brotli uses `BSD-3-Clause AND MIT`, dpi uses `Apache-2.0 AND MIT`, matchit uses `MIT AND BSD-3-Clause`, and unicode-ident combines a permissive option with `Unicode-3.0`. LLVM-exception expressions are recorded for linux-raw-sys, rustix, target-lexicon, wasi, wasip2, and wit-bindgen. Their package versions and metadata sources are listed in the CSV; the release artifact review must carry forward any package-specific copyright or notice files required by the selected expression.

The inventory is based on `package-lock.json` and `cargo metadata --all-features --offline --locked`; it records declared metadata rather than scanning final application binaries. It does not scan package contents for bundled license files or generated/minified payloads. WP-11.3/#50 remains responsible for release-package contents, security findings, and the final binary notice review.

## Shape and branding assets

| Asset                             | Source and version                                                                                                            | License and attribution                             | Rights review                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/shapes/assets/rectangle.svg` | Original PeerCanvas artwork, `asset-v1` / `1.0.0`; SHA-256 `4d6734d996faaac492a34fc2d470bef63a40f9cc417988c8db85dccc944e88e7` | Apache-2.0; original preview created for PeerCanvas | Redistribution, modification, and commercial use permitted; reviewed 2026-11-12 |

The logo, symbol, and app icon PNGs were supplied by the maintainer and are recorded separately in [the brand guide](docs/branding/brand-guide.md). Their rights are separate from the Apache-2.0 project-code license. The shape catalog includes no third-party stencils, logos, fonts, or draw.io library assets.

The local document workflow uses **tauri-plugin-dialog 2.7.3**, dual-licensed MIT or Apache-2.0, for native file selection from Rust commands. It does not expose the filesystem plugin's general JavaScript API. See the [plugin source](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog) and [license metadata](https://crates.io/crates/tauri-plugin-dialog/2.7.3).

## S0 native compatibility probe

The separately invoked native probe uses Weave.js 5.7.1 (Apache-2.0), Konva 10.0.2 (MIT), and Yjs 13.6.27 (MIT). Its fixture and instrumentation are excluded from the normal application entrypoint and production builds. No upstream artwork, font, stencil, or service integration is copied.

`src/native-smoke/NativeSmokeCanvas.tsx` adapts the provider/container composition and a minimal node/plugin selection from these Apache-2.0 sources. It retains the Inditex copyright and SPDX notice and identifies the modification for PeerCanvas:

| Upstream                                                            | Revision                                                       | Source files                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [weavejs-frontend](https://github.com/InditexTech/weavejs-frontend) | `ce3c4b663de1297daa37241a0be9b14a2469bc0c`                     | `code/components/use-cases/standalone/components/image-canvas/image-canvas.weave.tsx`, `code/components/room-components/hooks/use-get-renderer-konva-base.ts`, and the required node/plugin composition from `code/components/use-cases/standalone/weave.ts` |
| [Weave.js](https://github.com/InditexTech/weavejs)                  | tag `5.7.1`, commit `92a8f87917706e31db3ca7bb19b6762df1da170a` | lifecycle composition from `code/packages/react/src/components/provider.tsx`                                                                                                                                                                                 |

The optional test-only Rust dependency [tauri-plugin-wdio-webdriver 1.5.1](https://github.com/webdriverio/desktop-mobile/tree/ba733f664e034976499fd3d43cf940f357f904c4/packages/tauri-plugin-webdriver) is MIT-licensed. Its embedded loopback server is enabled only by the `native-smoke` Cargo feature in debug builds; a release build with that feature is rejected at compile time. The probe does not use the separate WDIO API/mocking plugin or require a paid driver service.

## Isolated UI demonstration

`src/ui-mock/ui/WeaveCanvas.tsx` derives its in-memory provider/container, node registration, and lifecycle composition from the S0 probe and the exact Apache-2.0 upstream revisions listed above. Its header retains the Inditex copyright/SPDX attribution and identifies the PeerCanvas modification. The demo adds a disposable read-only projection, selection reporting, transient zoom, and cleanup; it excludes native WebDriver instrumentation. It uses the same pinned Weave/Konva/Yjs packages and unchanged maintainer-supplied brand symbol. Other demo controls and stroke icons are project code; no third-party stencil, font, chatbot-template source, or new artwork is bundled.

## Project references

- [Weave.js](https://github.com/InditexTech/weavejs) and [weavejs-frontend](https://github.com/InditexTech/weavejs-frontend) supply the bounded test probe described above and remain the planned sources for the product canvas. Both upstream repositories declare Apache-2.0: [Weave.js license](https://github.com/InditexTech/weavejs/blob/5.7.1/LICENSE) and [frontend license](https://github.com/InditexTech/weavejs-frontend/blob/ce3c4b663de1297daa37241a0be9b14a2469bc0c/LICENSE). PeerCanvas is independent and does not imply endorsement by InditexTech.
- [shadcn chatbot template](https://github.com/shadcn-ui/chatbot-template) is the planned source for adapted chat UI components and interaction patterns; its upstream repository declares [MIT](https://github.com/shadcn-ui/chatbot-template/blob/main/LICENSE). PeerCanvas will not adopt its Next.js application routes or Vercel AI SDK backend.
- [OpenPencil](https://github.com/open-pencil/open-pencil) is an architectural reference for peer collaboration, not a code dependency.
- [draw.io](https://github.com/jgraph/drawio) is an interchange target, not an affiliation.
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) supplies the specification workflow.
- Public Codex client repositories listed in [Codex integration research](docs/architecture/codex-integration.md) are implementation references, not official SDKs.

No source code from the shadcn chatbot template or OpenPencil is in the current scaffold. Before adapting further code, record the upstream commit, retain the applicable license and copyright notices, and review notices for any copied component dependencies or assets. Each distributed dependency and asset remains under its own license.
