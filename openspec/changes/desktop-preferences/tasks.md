# Tasks

## 1. Contracts and defaults

- [x] 1.1 Add FR-050, FR-051, and UC-11 to the product definition; review the two capability specs and record the supported-locale fallback and preference separation in the docs. Verify the OpenSpec change and requirement/issue links agree. — GitHub Issue [#96](https://github.com/furancho-labs/Peer2Canvas/issues/96)

## 2. Appearance preference

- [x] 2.1 Add the persistent light/dark control and theme tokens for production application chrome. Verify preference persistence, keyboard and accessible labels, paper/styled-diagram invariance, and reduced-motion behavior. — GitHub Issue [#95](https://github.com/furancho-labs/Peer2Canvas/issues/95)

## 3. English and Spanish resources

- [ ] 3.1 Add complete English and Spanish resource files for implemented UI domains, wire them to the locale preference, and review Spanish copy for natural phrasing. Verify key/parameter parity, accessible labels, errors, formatting, and fallback behavior. — GitHub Issue [#100](https://github.com/furancho-labs/Peer2Canvas/issues/100)

## 4. Platform integration

- [ ] 4.1 Verify preference restore and switching across Windows, macOS, and Linux. Confirm that theme and language changes do not mutate document bytes, revision, dirty state, or undo history; record native and automated evidence separately. — GitHub Issue [#101](https://github.com/furancho-labs/Peer2Canvas/issues/101)

## Workflow follow-up

- The maintainer approved implementation and final corrections on 2026-11-13, then separately authorized focused commits and a feature-branch push. Merges and releases remain outside that authorization.
- Task 3.1 implementation and automated resource/copy checks are complete; fluent human Spanish sign-off required by #100 remains open.
- Task 4.1 remains open: local macOS Rust tests and native compilation/launch do not prove native preference restart/dialog behavior on Windows, macOS, or Linux.
- Archive the change only after implementation, review, and acceptance evidence are complete.
