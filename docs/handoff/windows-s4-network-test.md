# Windows Codex handoff: S4 two-device network test

Last updated: 2026-11-14. This guide is for the test-only manual host/peer harness. It does not authorize S5 work or mark S4 complete.

## Start by refreshing context

1. Read the active Windows `AGENTS.md`. Use its existing shared-memory checkout; on this Windows machine it is currently `~/.claude`. Do not clone another memory repository.
2. Read the PeerCanvas project-memory index under `~/.claude/projects/*/memory/MEMORY.md`, the cross-project index at `~/.claude/projects/C--Users-victo/memory/MEMORY.md`, and `SKILLS_MAP.md` plus `CODEX_SUBAGENT_ROUTING.md` from `~/.claude`. Do not copy private memory into the public repo or an issue.
3. Refresh `main`, `dev`, recent PRs, #8, #35–#37, S4/S5 milestones, and Project Board. Preserve any local changes; do not reset or overwrite the user's checkout.
4. Read repository `AGENTS.md`, `README.md`, `PLANS.md`, `docs/handoff/START_HERE.md`, `docs/quality/TEST_STRATEGY.md`, `docs/support/platform-matrix.md`, `docs/architecture/decisions/ADR-0002-document-and-collaboration-model.md`, `docs/security/sharing-threat-model.md`, issue #37, `scripts/native-smoke.mjs`, `.github/workflows/ci.yml`, and the manual harness source under `src/native-smoke/`.

Explain the plan and terms in simple Spanish before the user starts. Do not run the network test without the user's go-ahead. Do not edit product code, start S5, close #37, or claim S4 is complete.

## What each test means

The regular editor still has no share/join controls. The existing `native-smoke:public` test creates a host and peer iframe inside one Tauri WebView; it is useful for a Windows WebView smoke but does not test two computers.

The test-only manual harness is launched separately on **both** computers:

```powershell
npm ci
npm run native-smoke:manual
```

Use the project's documented Node.js 24, stable Rust, and [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/). In PowerShell, inspect the working tree first. Continue only if it is clean; otherwise preserve the changes and resolve them before switching branches.

```powershell
git status --short --branch
git fetch origin
git switch dev
git pull --ff-only origin dev
npm ci
npm run native-smoke:manual
```

On the host computer, choose **Host**, save the generated synthetic `.peercanvas` fixture to a new test-only folder, then start the session. Record the path and its SHA-256 hash. Reveal the temporary test code only when ready to share it. On the second computer, choose **Peer**, paste the code, and join. The code contains a room id, a random password, and the host peer id; it grants anyone who has it read/edit access to this synthetic fixture. It is not a secure invitation: S5 admission, roles, and expiry are not implemented.

Share the code manually with the trusted test partner over a private channel. Do not paste it into this Codex chat, an issue, a PR, logs, screenshots, or recordings. The harness keeps it in memory and does not put it in a URL or local storage. Close both test sessions after the run.

## Suggested first run

1. Put both computers on the same Wi-Fi as a baseline. Start Host and Peer and wait for both reports to show `ready`; compare the document revision and in-memory SHA-256.
2. Have the Peer use **Submit one synthetic edit**. Confirm that the Host accepts it and both reports converge to the same revision/hash. The harness routes this through the normal host-side `executeCommand` validator.
3. Use **Leave and rejoin** on the Peer. Confirm it resynchronizes and converges again.
4. Close the Host session and confirm that the Peer reports a disconnect while retaining its last in-memory snapshot.
5. Hash the Host's saved synthetic file again and compare it with the pre-test value. Session edits are not auto-saved. On Windows, run `Get-FileHash "C:\path\to\PeerCanvas-S4-Test.peercanvas" -Algorithm SHA256`; on macOS, run `shasum -a 256 "/path/to/PeerCanvas-S4-Test.peercanvas"`.
6. Close and relaunch the manual test app on both computers before the next topology run. This clears per-process ICE diagnostics from the previous run. Put the computers on **different internet connections**, such as home Wi-Fi and a mobile hotspot, then generate a fresh test code. Record a failed direct path as evidence too; it may reflect router/NAT limits rather than a regression.

Different networks matter because they test whether routers allow a direct path between peers. NAT is the router behavior that shares a public address among local devices and can block incoming connections. STUN helps peers discover their internet-facing route. ICE tries the available connection paths. TURN relays traffic when direct connections fail; PeerCanvas has not selected a production TURN provider.

The current manual harness uses the configured public MQTT signaling brokers and public Google/Cloudflare STUN defaults. A successful same-Wi-Fi run is not cross-network evidence. A failed cross-network run is useful if its topology and sanitized status are recorded. Do not change router/firewall settings or provision paid TURN without explicit approval.

## Evidence and limits

For each run, record the commit, host and peer OS/WebView, topology class (same LAN or separate networks), signaling mode, peer count, ready/disconnected states, candidate **types** (not addresses), initial sync, accepted edit, reconnect result, host-loss result, elapsed times/bytes if available, and before/after SHA-256 of the synthetic host file.

Never record IP addresses, SDP, room codes/passwords, invitation secrets, raw candidate strings, or document contents. The current harness prepares the initial connection, one edit, rejoin, graceful host-session close, and file-hash comparison. #37 also requires the remaining signaling/STUN failure, network-change, peer-limit, abrupt-process-loss, and TURN cases. Keep #37 open until the acceptance matrix is satisfied and evidence is added to ADR-0002.
