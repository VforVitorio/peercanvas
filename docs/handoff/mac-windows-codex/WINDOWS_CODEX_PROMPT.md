# Initial prompt for Windows Codex

Paste the following prompt into Codex on Windows after fetching `feature/comunicacion-codex-mac-windows`.

---

You are the Windows-side diagnostic agent for PeerCanvas S4. The user asked Mac and Windows Codex to coordinate through the Markdown files in `docs/handoff/mac-windows-codex/` until the cross-device issue is understood.

## Read first

1. Read the active Windows `AGENTS.md` and follow its shared-memory path. Read the PeerCanvas project-memory index and the global `SKILLS_MAP.md` and `CODEX_SUBAGENT_ROUTING.md`.
2. Read repository `AGENTS.md`, `docs/handoff/START_HERE.md`, `docs/handoff/windows-s4-network-test.md`, `docs/handoff/mac-windows-codex/README.md`, and both message files.
3. Refresh `main`, `dev`, issue #37, PR #144, the S4 milestone, and the Project Board. Preserve any local work; do not reset, stash, or overwrite it.

## Current evidence

- Both computers were on the same Wi-Fi. The Mac–Windows attempt failed. The user explicitly does not want the identical attempt repeated.
- The Windows manual harness displayed: `Test session could not start. Check native WebRTC and network access, then retry.` Before that, its sanitized report showed `role=participant`, `status=connecting`, and `peerCount=0`.
- The Mac screenshot showed `role=host`, `status=error`, `peerCount=0`, `readyCount=0`, `links=[]`, and one closed ICE connection with `iceGatheringState=complete` and candidate types `host` and `srflx`. The visible session-start message may be stale; use the sanitized status report as evidence.
- A session code was visible in the screenshot. It is compromised and must not be reused, quoted, copied into these files, or requested from the user. The synthetic file hash is not needed for this diagnosis.
- The app's failure text is generic. Static code paths include host discovery (`waitForHost`) and initial synchronization (`syncFromHost`); distinguish them using actual Windows evidence instead of guessing.
- Both repositories should be at `dev` commit `806c556` before any later approved run. PR #144's CI passed on Linux, macOS, and Windows, but that does not prove the user's Windows WebView or this two-device route works.

## Task

Diagnose the existing Windows-side failure without running the same Mac–Windows connection attempt again and without changing application code.

1. Inspect the current or retained Windows harness state, if available. Record only role, status, peer/ready counts, revision, connection/ICE states, and candidate **types**. If the failed handler cleared the report, say so.
2. Inspect the PowerShell window used for `npm run native-smoke:manual`. Report relevant output around the failure, after checking that no session code, peer ID, IP, SDP, or raw candidate appears. Do not paste unredacted output into the communication file.
3. Confirm the checked-out commit and record the Windows version/build and Microsoft Edge WebView2 Runtime version using a read-only method.
4. If possible, check whether `RTCPeerConnection` exists in the already-open manual app without joining a room or contacting a peer. State the exact method and result. Do not fabricate a result if the runtime cannot be inspected safely.
5. Trace the observed error against `PeerDocumentSession.start`, `waitForHost`, `syncFromHost`, and Trystero's sanitized join-error mapping. State the supported failure phase, evidence, alternative explanations, and remaining uncertainty.
6. Append a `W-001` response to `windows-to-mac.md`, following its template. Include the commit, commands actually run, and exact evidence. Do not edit `mac-to-windows.md`.
7. Confirm the changed-file list contains only Markdown in this communication directory. Commit and push only that documentation update to `feature/comunicacion-codex-mac-windows` so Mac Codex can read it.

Do not run a network probe, retry the same Wi-Fi test, install software, change router/firewall settings, provision TURN, expose the session code, or modify application files. If a different, narrowly targeted experiment is needed, write its hypothesis and expected distinguishing result in the message for Mac Codex to review before asking the user to run it.

Respond to the user in Spanish. Keep the explanation simple and separate confirmed evidence, inference, and unknowns.

---
