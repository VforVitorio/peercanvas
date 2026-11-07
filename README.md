<h1 align="center">
  <img src="docs/branding/assets/peercanvas-lockup-color.png" alt="PeerCanvas" width="520">
</h1>

PeerCanvas is a planned local-first desktop editor for architecture, UML, BPMN, network, cloud, database, and process diagrams. The project aims to support Windows, macOS, and Linux, with optional peer-to-peer collaboration and optional Codex/MCP assistance.

PeerCanvas is an independent open-source project. It is not an official project of Weave.js, InditexTech, OpenPencil, draw.io, or OpenAI.

Repository: [VforVitorio/peercanvas](https://github.com/VforVitorio/peercanvas).

## Project status

The repository is in its engineering-foundation phase. The current app is an empty Tauri and React shell. Diagram editing, document persistence, collaboration, draw.io import/export, and AI tools are not implemented.

## Development setup

Use Node.js 24 and a stable Rust toolchain. Native builds require the platform dependencies listed in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run dev
```

To launch the desktop shell:

```sh
npm run tauri -- dev
```

Scaffold checks:

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## Project guidance

- [AGENTS.md](AGENTS.md): repository rules for Codex and other agents.
- [PLANS.md](PLANS.md): work packages, dependencies, sprint sequence, and issue/PR approach.
- [OpenSpec task sub-issues](docs/planning/subissue-map.md): one native child issue for every tracked implementation task.
- [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2): parent WP issues, OpenSpec task sub-issues, and sprint status.
- [GitHub workflow](docs/planning/github-workflow.md): branch flow, protection, CI, and security settings.
- [Product definition](docs/requirements/product-definition.md): actors, scope, requirements, use cases, and traceability.
- [Architecture](docs/architecture/overview.md): proposed components, data boundaries, and validation gates.
- [OpenSpec](openspec/): versioned capability proposals and specifications.
- [Handoff](docs/handoff/START_HERE.md): current state and the next authorized task.

## License

Project code is licensed under Apache-2.0. The first-party brand PNGs are supplied separately by the maintainer; third-party packages and assets retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); no third-party shape catalog assets are bundled in the current scaffold.
