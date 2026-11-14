# Windows Codex handoff: S4 network verification

Last checked: 2026-11-14. This guide is a prompt and test-preparation note, not an implementation request.

## Start by refreshing context

1. Read the active Windows `AGENTS.md`. Use its existing shared-memory checkout; on this Windows machine it is currently `~/.claude`. Do not clone another memory repository.
2. Read the PeerCanvas project-memory index under `~/.claude/projects/*/memory/MEMORY.md`, the cross-project index at `~/.claude/projects/C--Users-victo/memory/MEMORY.md`, and `SKILLS_MAP.md` plus `CODEX_SUBAGENT_ROUTING.md` from `~/.claude`.
3. Refresh `main`, `dev`, recent PRs, #8, #35–#37, the S4 milestone, and the Project Board. The last checked refs were `main=3940a07` and `dev=3704fa8`; verify them again.
4. Read repository `AGENTS.md`, `README.md`, `PLANS.md`, `docs/handoff/START_HERE.md`, `docs/quality/TEST_STRATEGY.md`, `docs/support/platform-matrix.md`, `docs/architecture/decisions/ADR-0002-document-and-collaboration-model.md`, `docs/security/sharing-threat-model.md`, issue #37, `scripts/native-smoke.mjs`, and `.github/workflows/ci.yml`.

Then explain the remaining S4 work in plain Spanish, defining unfamiliar terms. Do not start S5, change production code, close #37, or claim S4 is complete.

## What the current smoke can test

The normal editor has no share/join controls. The existing `native-smoke:public` test creates a host and peer iframe **inside one Tauri WebView**. It can test a platform's WebView, public signaling, synchronization, reconnect, and graceful host loss. It is not a two-computer or two-network test.

On Windows, the available one-computer smoke commands are:

```powershell
npm ci
npm run native-smoke:build
npm run native-smoke:public
```

Use the project's documented Node.js 24, stable Rust, and [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/). Verify these commands still match the current checkout before giving them to the user. The smoke uses synthetic data, but it needs internet access to reach the configured public signaling/STUN services.

If the user wants to test with a colleague on a second computer, first check whether the current repository has a test harness that can connect separate host and peer processes using the same test session. Do not invent flags, room-sharing steps, or normal-app buttons. If no such harness exists, explain the gap and propose the smallest test-only harness needed under #37; wait for approval before implementing it.

## Why two networks matter

Two devices on the same Wi-Fi test a local path. A Mac on one internet connection and a Windows PC on another (for example, one on home Wi-Fi and one on a mobile hotspot) test whether routers and firewalls allow a connection across networks. Different networks are important evidence for #37, but a failed direct connection is possible and should be recorded accurately.

- **NAT:** a router shares one public internet address among devices and can block incoming connections.
- **STUN:** helps a device discover how it appears from outside its router.
- **TURN:** relays traffic when devices cannot connect directly. PeerCanvas has not selected a production TURN provider.
- **ICE:** the connection process that tries available network paths.
- **DataChannel:** the WebRTC channel that carries peer data.

When a separate-device harness is available, explain and guide the user through the agreed matrix: same-LAN baseline, then independent networks; initial sync; one validated edit and convergence; network loss/reconnect; graceful host exit and abrupt host loss; preservation of the host's saved `.peercanvas` file. Record the commit, OS/WebView, topology class, signaling/ICE path, peer count, repetitions, result, timing/bytes if available, and before/after file hash.

Never record IP addresses, SDP, room or invitation secrets, TURN credentials, or diagram contents. Do not provision paid relay services or change router/firewall settings without the user's approval. If only the one-WebView smoke can be run, report exactly that limitation and leave #37 open.
