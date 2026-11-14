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
- A session code was visible in the screenshot. It is retired and must not be reused. The user now explicitly authorizes one newly generated code for the synthetic test to be read from `one-time-session.md`; the repo is public and the user accepts this temporary exposure. Do not place the code in messages, logs, screenshots, or reports.
- The app's failure text is generic. Static code paths include host discovery (`waitForHost`) and initial synchronization (`syncFromHost`); distinguish them using actual Windows evidence instead of guessing.
- Both repositories should be at `dev` commit `806c556` before any later approved run. PR #144's CI passed on Linux, macOS, and Windows, but that does not prove the user's Windows WebView or this two-device route works.

## Task

Prepare Windows for one fresh, user-authorized Mac–Windows attempt with a newly generated code. The old code and old session are retired. This is a new attempt, not a replay of the old room.

1. Inspect the current or retained Windows harness state, if available. Record only role, status, peer/ready counts, revision, connection/ICE states, and candidate **types**. If the failed handler cleared the report, say so.
2. Inspect the PowerShell window used for `npm run native-smoke:manual`. Report relevant output around the failure, after checking that no session code, peer ID, IP, SDP, or raw candidate appears. Do not paste unredacted output into the communication file.
3. Confirm the checked-out commit and record the Windows version/build and Microsoft Edge WebView2 Runtime version using a read-only method.
4. If possible, check whether `RTCPeerConnection` exists in the already-open manual app without joining a room or contacting a peer. State the exact method and result. Do not fabricate a result if the runtime cannot be inspected safely.
5. Trace the observed error against `PeerDocumentSession.start`, `waitForHost`, `syncFromHost`, and Trystero's sanitized join-error mapping. State the supported failure phase, evidence, alternative explanations, and remaining uncertainty.
6. Switch the existing manual harness window to **Peer** and leave it ready. Do not start another Host. When Mac Codex publishes the new code in `one-time-session.md`, enter it once and join once. Do not restart either app or reuse the code.
7. Append a concise `W-005` result to `windows-to-mac.md`: role, status, peer/ready counts, revision, ICE states/types, and success/failure. Do not include the session code or a screenshot that shows it. If the attempt fails, stop; do not retry without Mac Codex review.
8. Confirm that the changed-file list contains only Markdown in this communication directory. Commit and push only your response file so Mac Codex can read it.

Do not run additional network probes, install software, change router/firewall settings, provision TURN, or modify application files. The user authorizes only this fresh synthetic-session test and public one-time-code exchange. After the result is recorded, remove the one-time file and delete the communication branch.

Respond to the user in Spanish. Keep the explanation simple and separate confirmed evidence, inference, and unknowns.

Keep follow-up messages to Mac under 120 words. Follow the newest `M-###` instruction and preserve the live test state once the fresh session starts.

---
