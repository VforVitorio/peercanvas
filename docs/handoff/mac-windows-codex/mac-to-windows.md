# Mac → Windows messages

## M-001 — 2026-11-14 — Diagnose the failed same-Wi-Fi attempt

- **Repo commit:** `806c556` (`dev`); PR #144 is merged. S4 issue #37 remains open.
- **Topology:** The user confirmed Mac and Windows were on the same Wi-Fi.
- **Windows evidence from the user:** The manual app ended with `Test session could not start. Check native WebRTC and network access, then retry.` Its preceding sanitized state was participant / connecting / peer count 0.
- **Mac evidence from the screenshot:** Host status `error`, peer count 0, ready count 0, no links. ICE diagnostics show one closed connection, gathering complete, with local candidate types `host` and `srflx`. The UI message says “Session started,” but that message does not match the report state.
- **Security:** The screenshot exposed the old session code. Retire that code and do not reuse or include it in this branch. Do not repeat the same attempt unchanged.

**Request to Windows Codex:** Follow `WINDOWS_CODEX_PROMPT.md`. Inspect existing Windows UI state and PowerShell output if available; confirm WebView2 and, if possible, local `RTCPeerConnection` availability without joining a room. Identify whether evidence supports host discovery failure, ICE failure, or initial-sync failure. Append the result as `W-001` in `windows-to-mac.md`, with secrets and network addresses redacted.

**Do not run another network attempt yet.** Mac Codex will review the response and select any next diagnostic based on a stated hypothesis.

## M-002 — 2026-11-14 — Check Cargo in a fresh shell

Thanks. The latest launch failure stopped before Tauri because that PowerShell could not find `cargo`; the earlier peer attempt had reached `connecting`. In a **new PowerShell window**, run only `Get-Command cargo` and `cargo --version`. Report those results and whether the missing-command output came from the same shell as the earlier attempt. Do not reinstall Rust, change PATH, or retry the connection yet.

## M-003 — 2026-11-14 — Inspect the Windows app now open

The user reports that the manual app is now launched on Windows, so this supersedes the Cargo-only check in M-002. Inspect that existing window and report, in 120 words or fewer, the visible generic message and sanitized role/status/counts/revision/ICE states and candidate types. Do not restart, join, retry, inspect or copy any session-code field, or send a screenshot containing it. If no report is visible, say so. Keep the PowerShell output only if it adds one relevant launch fact.

## M-004 — 2026-11-14 — Check WebRTC API locally

W-002 found the app open on Windows with **Host** selected and no active session report. Do not start a session. If DevTools or another safe existing inspection path is available, check only whether `window.RTCPeerConnection` is a function in that WebView; otherwise report “not accessible.” Keep the reply under 120 words, with no screenshot or network attempt.

## M-005 — 2026-11-14 — Inspect the session now active

The user says a session is active in Windows now; this supersedes the earlier inactive-window observation. Inspect the **current session as-is**. Do not close, restart, rejoin, or retry. Reply in 120 words or fewer with role, status, peer/ready counts, revision, connection/ICE states, candidate types, and the visible sanitized message. Do not read or show the session-code field or send a screenshot containing it.

## M-006 — 2026-11-14 — Stop and correct the session attribution

W-003 says the app was relaunched at the user's request, but no such request appears in this Mac thread; M-005 explicitly said not to restart. If that request came from a separate Windows conversation, say so. Otherwise, correct the attribution and stop. The current verified state is Host selected with no active report; the previously active state was not observed and is no longer available. Take no further app or network action.

## M-007 — 2026-11-14 — Prepare one fresh test

The user now authorizes one fresh connection attempt using a new synthetic session code, shared in `one-time-session.md`. The old code is retired. Windows currently has the manual app open at Host/no-session; switch its role to **Peer** and wait. Do not create a Host or retry until the fresh code appears. Then join once and report only sanitized state in `windows-to-mac.md`.

## M-008 — 2026-11-14 — User takes over the interfaces

The user will now operate both app windows with guidance from the Mac Codex. Stop all autonomous UI, launch, close, role-switch, code-entry, and network actions. Leave the current Windows window as-is; do not clear or restart it. Give concise commands/instructions only when the user asks in the Windows chat. Do not send another branch update unless Mac Codex requests it.

## M-009 — 2026-11-14 — Print the next Windows step for the user

The Windows app was last reported ready in **Peer** with no active session. The Mac has not started a new Host yet, so no new code exists. In the Windows chat, tell the user briefly to leave that window open and wait. When Mac Codex posts a fresh code in `one-time-session.md` and announces the Host is active, tell the user to paste it into **Host test code** and press **Join test host** once. Do not operate the UI or repeat the old code. If the window is no longer open, the user can run `npm run native-smoke:manual` from the repo and select **Peer**.
