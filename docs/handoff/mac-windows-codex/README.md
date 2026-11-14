# Mac–Windows Codex diagnostic channel

Status: active. Created 2026-11-14 from `dev` at `806c556`.

## Purpose

Use this branch for asynchronous, sanitized messages between Codex on the Mac and Codex on Windows while diagnosing the failed S4 two-device test. The user confirmed that both computers were on the same Wi-Fi and that the attempt failed.

This branch is documentation-only. Its diff must contain Markdown, plain text, or JSON files. Do not add application code, dependencies, generated artifacts, screenshots, logs, or test fixtures. A code fix belongs on a separate `feature/*` branch from a refreshed `dev`, linked to issue #37 and OpenSpec task 5.3.

## Message ownership

- Mac Codex owns `mac-to-windows.md`. It records evidence, questions, and the next diagnostic request.
- Windows Codex owns `windows-to-mac.md`. It appends findings and replies there.
- Each side reads the complete opposite-direction file before responding. Use sequential message IDs (`M-001`, `M-002`; `W-001`, `W-002`) and add dates and the inspected commit.
- Keep each message concise: aim for 120 words or fewer and include only evidence needed for the next decision.
- Do not edit the other side's file. This keeps concurrent updates from overwriting one another.

## Synchronization

1. Check `git status --short --branch`; preserve local work and stop if the tree is dirty.
2. Fetch and switch to `feature/comunicacion-codex-mac-windows`, tracking `origin` if needed.
3. Read both message files and `WINDOWS_CODEX_PROMPT.md` before acting.
4. Append only to the file owned by the current machine. Confirm the diff contains documentation files only, then commit and push that update so the other machine can fetch it.
5. Do not open or merge a PR for this communication branch. It is a temporary coordination channel, not product delivery.

## Safety and scope

- The old session code appeared in a screenshot. It is retired and must not be reused.
- The user explicitly authorizes one newly generated session code for the synthetic test to be shared with Windows Codex in `one-time-session.md`. The repository is public; the user accepts this one-run exposure and wants the communication branch deleted after the run.
- The one-time file may contain only the fresh room code needed for this test. Do not copy it into other messages, logs, screenshots, or reports. Keep IP addresses, SDP, raw ICE candidates, and document contents out of every file.
- Use the current message sequence to make one fresh attempt with Mac as Host and Windows as Peer. Do not reuse the old code or restart either app after the new attempt begins. If the attempt fails, record sanitized status and wait for Mac Codex to review before retrying.
- S4/WP-07.3/#37 remains open. Do not close #37, promote S4 to `main`, or begin S5 through this channel.
- The Mac Codex remains responsible for reviewing findings and coordinating any separate product-code fix. Preserve the collaborator's frontend if a later merge touches it.
- After the test result is recorded, remove `one-time-session.md` and delete the remote communication branch as requested.
