<h1 align="center">
  <img src="docs/branding/assets/peercanvas-lockup-color.png" alt="PeerCanvas" width="520">
</h1>

<p align="center">A local-first desktop workspace for diagrams and collaborative thinking.</p>

<p align="center">
  <a href="https://github.com/VforVitorio/peercanvas">GitHub repository</a>
  ·
  <a href="docs/branding/brand-guide.md">Brand guide</a>
  ·
  <a href="docs/handoff/START_HERE.md">Project handoff</a>
</p>

PeerCanvas is an independent open-source project for creating architecture, UML, BPMN, network, cloud, database, process, and workflow diagrams. The goal is a capable desktop editor that works locally, with optional peer collaboration, draw.io interchange, and Codex/MCP assistance.

PeerCanvas is not an official project of Weave.js, InditexTech, OpenPencil, draw.io, or OpenAI.

## Project status

PeerCanvas is in its engineering-foundation stage. The current application is a minimal Tauri/React shell. Diagram editing, durable document storage, collaboration, import/export, and AI tools are not implemented.

| Capability | Status |
|---|---|
| Tauri desktop shell | Minimal shell builds on macOS; Windows and Linux CI builds are configured |
| Weave.js canvas | Selected candidate; native compatibility spike is planned |
| Local diagram editing and persistence | Specified; not implemented |
| draw.io import/export | Compatibility subset planned; no support claimed yet |
| Peer-to-peer sessions | Yjs and Trystero/WebRTC proposed; network behavior not verified |
| Codex and MCP | Optional integration researched; not implemented |

The project plan tracks 13 working-package parent issues, 41 task sub-issues, and eight sprint milestones on the [PeerCanvas Workflow Board](https://github.com/users/VforVitorio/projects/4/views/2). No product feature should be treated as complete until its issue acceptance criteria and verification evidence are recorded.

## Architecture direction

The planned desktop stack is Tauri 2, React 18, TypeScript, Vite, and Weave.js. Weave.js is the proposed canvas engine; its integration with the Tauri webviews still needs a Windows/macOS/Linux compatibility check.

The document model will be local-first. Optional collaboration is planned around Yjs with a replaceable Trystero/WebRTC transport. Connections may require signaling relays or TURN depending on network conditions; direct connectivity is not guaranteed.

The Codex assistant is optional. OpenAI documents a Sign in with ChatGPT OAuth path for eligible open-source and locally hosted apps, but it is a preview with feature and usage limits. PeerCanvas will require explicit user consent, keep the local editor usable without AI, and apply proposed document changes only after user approval. See [Codex integration research](docs/architecture/codex-integration.md).

## Development setup

Use Node.js 24 and the stable Rust toolchain. Native development also requires the platform dependencies in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

~~~sh
npm ci
npm run dev
~~~

Run the desktop shell:

~~~sh
npm run tauri -- dev
~~~

Build the native shell without creating an installer:

~~~sh
npm run tauri -- build --no-bundle
~~~

## Checks

~~~sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
~~~

The GitHub Actions workflows run frontend checks and native builds on Ubuntu, macOS, and Windows. A successful frontend build does not prove that a native webview, deep link, or peer network path works.

## Project workflow

- Use short-lived feature branches from dev and open focused pull requests to dev.
- Promote reviewed sprint batches from dev to main by pull request. Main is the stable default branch.
- Each working package has a parent issue; each OpenSpec implementation task has a native child issue. Pull requests close the child issue and reference the parent work package.
- Keep product behavior in OpenSpec, engineering work in GitHub Issues, and sprint sequencing in PLANS.md.
- Read AGENTS.md and CONTRIBUTING.md before making changes. Agents commit or push only when the user explicitly authorizes it for that task; merges remain maintainer-owned.

## Project documents

- [Product requirements and use cases](docs/requirements/product-definition.md)
- [Architecture and provisional decisions](docs/architecture/overview.md)
- [Working packages, sprints, and parent issues](PLANS.md)
- [OpenSpec baseline proposal and capability specifications](openspec/changes/peer-canvas-foundation/)
- [Issue-to-task traceability](docs/planning/subissue-map.md)
- [GitHub branch, CI, and security workflow](docs/planning/github-workflow.md)
- [Risk register](docs/security/RISK_REGISTER.md)
- [Quality and verification plan](docs/quality/TEST_STRATEGY.md)
- [Brand assets and visual direction](docs/branding/brand-guide.md)
- [Next-session handoff](docs/handoff/START_HERE.md)

## Acknowledgments and references

PeerCanvas is independently developed. These projects informed the proposed technology choices, format support, workflows, or interface research; they do not endorse PeerCanvas. No source code has been copied from the listed reference applications.

| Project or documentation | How it informed the plan |
|---|---|
| [Tauri](https://v2.tauri.app/) | Cross-platform desktop shell and native integration |
| [Weave.js](https://github.com/InditexTech/weavejs) | Proposed diagram rendering and editing engine |
| [OpenPencil](https://github.com/open-pencil/open-pencil) | Peer-collaboration architecture reference |
| [Yjs](https://docs.yjs.dev/) and [Trystero](https://trystero.dev/) | Proposed document synchronization and WebRTC transport |
| [draw.io](https://github.com/jgraph/drawio) | Document interchange target and file-format reference |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Spec-driven change workflow |
| [shadcn chatbot template](https://github.com/shadcn-ui/chatbot-template) | Chat interaction and visual-pattern reference; its Next.js architecture is not adopted |
| [OpenAI Sign in with ChatGPT and Codex app-server docs](https://developers.openai.com/siwc/token-sharing-open-source) | Optional subscription-authentication research |
| [t3code](https://github.com/pingdotgg/t3code), [CodexMonitor](https://github.com/Dimillian/CodexMonitor), and [CodexGui](https://github.com/wieslawsoltes/CodexGui) | Public examples reviewed for Codex app-server integration patterns |

## License

Project source code is licensed under Apache-2.0. The PeerCanvas brand artwork is maintainer-supplied and is not covered by the source-code license. Third-party packages retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
