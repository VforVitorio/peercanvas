# Tasks

Unchecked tasks below are future implementation work. Repository setup tasks may be marked complete when their acceptance checks pass; this does not authorize product feature implementation. Estimates, sprint placement, and Issues are tracked in PLANS.md and GitHub.

S0 comprises tasks 1.1–1.5 and 8.2. Its compatibility probe is test-only and excluded from normal production builds; the normal app retains the scaffold. The fixture uses temporary in-memory state; durable persistence remains in WP-03.

## 1. Engineering foundation and compatibility gate (WP-00, WP-01)

- [x] 1.1 Confirm the proposal, all capability specs, architecture, ADRs, and work-package links agree; verify with openspec validate and a traceability review. — GitHub Issue [#14](https://github.com/VforVitorio/peercanvas/issues/14)
- [x] 1.2 Adapt the required composition from the official weavejs-frontend into an isolated test-only Tauri/WebView probe with the pinned Weave renderer on Windows, macOS, and Linux; verify each platform with a recorded native canvas smoke test for render, selection, transforms, connector rendering, and one in-memory Weave-store-backed node edit. Exclude probe instrumentation from normal production builds. Record adopted source and notices; document any blocked behavior with an explicit fallback decision. — GitHub Issue [#15](https://github.com/VforVitorio/peercanvas/issues/15)
- [x] 1.3 Record the actual OS, WebView, Rust, React, and Weave compatibility matrix; verify it is linked from the support documentation and ADR-0001. — GitHub Issue [#16](https://github.com/VforVitorio/peercanvas/issues/16)
- [x] 1.4 Review native CI, required check names, GitHub branch flow, and security settings; verify CI check runs are successful before applying branch protection. — GitHub Issue [#17](https://github.com/VforVitorio/peercanvas/issues/17)
- [x] 1.5 Prepare the branded editor-shell direction from the maintainer-supplied assets; verify brand provenance, Weave.js canvas hierarchy, accessibility constraints, and the honest placeholder state in docs/branding/editor-shell-direction.md without implementing editor controls. — GitHub Issue [#18](https://github.com/VforVitorio/peercanvas/issues/18)

## 2. Canonical document and local persistence (WP-02, WP-03)

- [ ] 2.1 Define the versioned document schema and typed command outcomes; verify schema, stable IDs, and invalid-command behavior with unit/property tests. — GitHub Issue [#19](https://github.com/VforVitorio/peercanvas/issues/19)
- [ ] 2.2 Implement node, connection, page, and layer invariants at one command boundary; verify rejected mutations leave the document unchanged. — GitHub Issue [#20](https://github.com/VforVitorio/peercanvas/issues/20)
- [ ] 2.3 Compare SQLite, Tauri storage, and browser/Yjs persistence using representative documents and failure cases; record the selected single source of truth in ADR-0003. — GitHub Issue [#21](https://github.com/VforVitorio/peercanvas/issues/21)
- [ ] 2.4 Implement local create/open/save/rename/close against the selected store; verify supported document fields survive round trips. — GitHub Issue [#22](https://github.com/VforVitorio/peercanvas/issues/22)
- [ ] 2.5 Implement migrations and non-destructive recovery; verify interrupted writes, disk errors, corrupt snapshots, and unsupported versions with integration tests. — GitHub Issue [#23](https://github.com/VforVitorio/peercanvas/issues/23)
- [ ] 2.6 Document the stored schema and recovery behavior; verify examples and migration policy match the implemented model. — GitHub Issue [#24](https://github.com/VforVitorio/peercanvas/issues/24)

## 3. Canvas editing and shape catalog (WP-04, WP-05)

- [ ] 3.1 Implement model-backed selection, movement, resizing, and deletion; verify pointer and keyboard workflows and model assertions. — GitHub Issue [#25](https://github.com/VforVitorio/peercanvas/issues/25)
- [ ] 3.2 Implement connectors, property inspection, pages/layers, and undo/redo; verify each operation through integration tests and a reopen fixture. — GitHub Issue [#26](https://github.com/VforVitorio/peercanvas/issues/26)
- [ ] 3.3 Define a shape manifest with source, version, license, attribution, and review fields; verify invalid and unreviewed entries are excluded. — GitHub Issue [#27](https://github.com/VforVitorio/peercanvas/issues/27)
- [ ] 3.4 Implement offline catalog browse/search and safe SVG handling; verify deterministic search and malicious SVG rejection fixtures. — GitHub Issue [#28](https://github.com/VforVitorio/peercanvas/issues/28)
- [ ] 3.5 Document bundled shape provenance and run a direct/transitive license and asset-rights review; verify the release inventory contains no unreviewed asset. — GitHub Issue [#29](https://github.com/VforVitorio/peercanvas/issues/29)

## 4. draw.io interchange (WP-06)

- [ ] 4.1 Build a versioned draw.io fixture corpus and compatibility matrix; verify each fixture records source, permission, supported semantics, and expected loss report. — GitHub Issue [#30](https://github.com/VforVitorio/peercanvas/issues/30)
- [ ] 4.2 Implement bounded draw.io parsing into temporary state; verify XML, compressed inputs, malicious entities, decompression limits, and malformed-file cases. — GitHub Issue [#31](https://github.com/VforVitorio/peercanvas/issues/31)
- [ ] 4.3 Implement import mappings and loss reporting for the declared subset; verify supported semantic fields against golden fixtures. — GitHub Issue [#32](https://github.com/VforVitorio/peercanvas/issues/32)
- [ ] 4.4 Implement export to a new destination with overwrite confirmation; verify round-trip fixtures and that cancellation/failure preserves existing files. — GitHub Issue [#33](https://github.com/VforVitorio/peercanvas/issues/33)
- [ ] 4.5 Document unsupported features and safe preservation behavior; verify the user-facing compatibility note matches the fixture results. — GitHub Issue [#34](https://github.com/VforVitorio/peercanvas/issues/34)

## 5. Peer collaboration, invitations, and presence (WP-07, WP-08)

- [ ] 5.1 Define how validated model changes map to Yjs state and local durability; verify consistency with the document and persistence contracts. — GitHub Issue [#35](https://github.com/VforVitorio/peercanvas/issues/35)
- [ ] 5.2 Implement initial sync and a replaceable peer transport; verify deterministic two-peer convergence and initial-state completion tests. — GitHub Issue [#36](https://github.com/VforVitorio/peercanvas/issues/36)
- [ ] 5.3 Exercise LAN, NAT, signaling, STUN, TURN, reconnect, and host-loss scenarios; record actual results and service/credential requirements in ADR-0002. — GitHub Issue [#37](https://github.com/VforVitorio/peercanvas/issues/37)
- [ ] 5.4 Review and implement the invitation cryptographic protocol, URL/deep-link handling, expiry, admission, and secret redaction; verify entropy, leakage, and invalid/expired link tests. — GitHub Issue [#38](https://github.com/VforVitorio/peercanvas/issues/38)
- [ ] 5.5 Enforce viewer/editor roles for UI, remote, import, and MCP mutation paths; verify unauthorized changes are rejected in negative tests. — GitHub Issue [#39](https://github.com/VforVitorio/peercanvas/issues/39)
- [ ] 5.6 Implement participant presence and cursor awareness separately from persisted documents; verify disconnect cleanup and absence from saved files. — GitHub Issue [#40](https://github.com/VforVitorio/peercanvas/issues/40)
- [ ] 5.7 Update the sharing threat model and public privacy notes; verify stated relay visibility and revocation limits against protocol tests. — GitHub Issue [#41](https://github.com/VforVitorio/peercanvas/issues/41)

## 6. Optional Codex and MCP (WP-09, WP-10)

- [ ] 6.1 Recheck current Sign in with ChatGPT eligibility, registration, terms, supported models, preview limits, callback flow, and token refresh; verify the decision with official docs and a documented auth test plan. — GitHub Issue [#42](https://github.com/VforVitorio/peercanvas/issues/42)
- [ ] 6.2 Implement native credential storage and Codex app-server lifecycle only if the auth gate passes; verify token redaction, refresh, sign-out, and child-process isolation without exposing credentials to the renderer. — GitHub Issue [#43](https://github.com/VforVitorio/peercanvas/issues/43)
- [ ] 6.3 Adapt the shadcn chatbot template's UI and interaction patterns for PeerCanvas, then implement optional chat streaming, cancellation, local conversation history, and explicit context selection without importing its Next.js routes or Vercel AI SDK backend; verify with a mock provider and disabled/offline flows. — GitHub Issue [#44](https://github.com/VforVitorio/peercanvas/issues/44)
- [ ] 6.4 Implement validated MCP read/search tools scoped to an explicitly selected document; verify schema, scope, and bounded-output tests. — GitHub Issue [#45](https://github.com/VforVitorio/peercanvas/issues/45)
- [ ] 6.5 Implement MCP mutation proposals with preview, approval, denial, cancellation, and audit outcomes; verify approval and rejection do not bypass the command boundary. — GitHub Issue [#46](https://github.com/VforVitorio/peercanvas/issues/46)
- [ ] 6.6 Document provider data flow, limits, permissions, and alternatives; verify the user-facing privacy notice agrees with the current auth behavior. — GitHub Issue [#47](https://github.com/VforVitorio/peercanvas/issues/47)

## 7. Hardening and user-facing skills (WP-11, WP-12)

- [ ] 7.1 Add accessibility, performance, security, and recovery fixtures for each implemented capability; verify targets on named machines and declared OS/WebView versions. — GitHub Issue [#48](https://github.com/VforVitorio/peercanvas/issues/48)
- [ ] 7.2 Complete native smoke checks and release evidence for Windows, macOS, and Linux; verify the release matrix distinguishes automated builds from manual tests. — GitHub Issue [#49](https://github.com/VforVitorio/peercanvas/issues/49)
- [ ] 7.3 Resolve critical/high dependency and secret findings and review third-party notices; verify the release record contains maintainer dispositions for remaining risks. — GitHub Issue [#50](https://github.com/VforVitorio/peercanvas/issues/50)
- [ ] 7.4 Create user-facing Codex skills only for verified MCP tools; validate manifests, examples, installation/removal, and permission disclosures with current official OpenAI tooling. — GitHub Issue [#51](https://github.com/VforVitorio/peercanvas/issues/51)

## 8. Integration and release review

- [ ] 8.1 Run the full CI suite and cross-capability acceptance matrix; verify every released requirement has automated or documented manual evidence. — GitHub Issue [#52](https://github.com/VforVitorio/peercanvas/issues/52)
- [x] 8.2 Reconcile OpenSpec specs, FR/UC traceability, ADRs, risks, PLANS.md, and GitHub Issues; verify there are no stale or contradictory contracts. — GitHub Issue [#53](https://github.com/VforVitorio/peercanvas/issues/53)
- [ ] 8.3 Prepare release notes and support limitations; verify all platform, interoperability, networking, AI, security, and asset claims are backed by recorded evidence. — GitHub Issue [#54](https://github.com/VforVitorio/peercanvas/issues/54)

## Workflow follow-up

- After implementation and maintainer review, archive this OpenSpec change and verify that the resulting main specifications preserve the accepted requirements.
- Update PLANS.md, GitHub Issues, sprint milestones, and docs/handoff/START_HERE.md with the verified implementation state.
