# Third-party notices

PeerCanvas is an independent project. References to upstream projects do not imply endorsement or official affiliation.

## Current scaffold

An initial metadata scan covered 254 installed npm packages and found license metadata for all of them. It identified these additional notice obligations in the current dependency tree:

- **caniuse-lite 1.0.30001823**, used through Browserslist/Autoprefixer for browser support data, is licensed under CC BY 4.0. See its [package repository](https://github.com/browserslist/caniuse-lite) and [license text](LICENSES/CC-BY-4.0.txt).
- **lightningcss 1.33.0** and its installed macOS native package are licensed under MPL-2.0. See the [upstream repository](https://github.com/parcel-bundler/lightningcss) and [license text](LICENSES/MPL-2.0.txt).

This is not a complete transitive dependency or binary-content audit. Cargo/Rust licenses, packaged runtime contents, and all direct/transitive notice obligations must be reviewed before a public release; produce a versioned SBOM and record required notices at that point.

The local document workflow uses **tauri-plugin-dialog 2.7.3**, dual-licensed MIT or Apache-2.0, for native file selection from Rust commands. It does not expose the filesystem plugin's general JavaScript API. See the [plugin source](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog) and [license metadata](https://crates.io/crates/tauri-plugin-dialog/2.7.3).

The logo, symbol, and app icon PNGs are first-party brand assets supplied by the maintainer and recorded in [the brand guide](docs/branding/brand-guide.md). Their rights are separate from the Apache-2.0 project-code license. No third-party stencil or shape catalog assets are bundled in the current scaffold; the future catalog must keep per-asset provenance and license records.

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
