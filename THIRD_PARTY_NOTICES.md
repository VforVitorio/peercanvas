# Third-party notices

PeerCanvas is an independent project. References to upstream projects do not imply endorsement or official affiliation.

## Current scaffold

An initial metadata scan covered 254 installed npm packages and found license metadata for all of them. It identified these additional notice obligations in the current dependency tree:

- **caniuse-lite 1.0.30001823**, used through Browserslist/Autoprefixer for browser support data, is licensed under CC BY 4.0. See its [package repository](https://github.com/browserslist/caniuse-lite) and [license text](LICENSES/CC-BY-4.0.txt).
- **lightningcss 1.33.0** and its installed macOS native package are licensed under MPL-2.0. See the [upstream repository](https://github.com/parcel-bundler/lightningcss) and [license text](LICENSES/MPL-2.0.txt).

This is not a complete transitive dependency or binary-content audit. Cargo/Rust licenses, packaged runtime contents, and all direct/transitive notice obligations must be reviewed before a public release; produce a versioned SBOM and record required notices at that point.

The logo, symbol, and app icon PNGs are first-party brand assets supplied by the maintainer and recorded in [the brand guide](docs/branding/brand-guide.md). Their rights are separate from the Apache-2.0 project-code license. No third-party stencil or shape catalog assets are bundled in the current scaffold; the future catalog must keep per-asset provenance and license records.

## Project references

- [Weave.js](https://github.com/InditexTech/weavejs) is the planned canvas foundation. PeerCanvas is independent and does not imply endorsement by InditexTech.
- [OpenPencil](https://github.com/open-pencil/open-pencil) is an architectural reference for peer collaboration, not a code dependency.
- [draw.io](https://github.com/jgraph/drawio) is an interchange target, not an affiliation.
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) supplies the specification workflow.
- Public Codex client repositories listed in [Codex integration research](docs/architecture/codex-integration.md) are implementation references, not official SDKs.

Each distributed dependency and asset remains under its own license. Required notices will be added before redistribution.
