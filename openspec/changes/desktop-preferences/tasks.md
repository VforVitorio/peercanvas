# Tasks

## 1. Contracts and defaults

- [x] 1.1 Add FR-050, FR-051, and UC-11 to the product definition; review the two capability specs and record the supported-locale fallback and preference separation in the docs. Verify the OpenSpec change and requirement/issue links agree. — GitHub Issue [#96](https://github.com/furancho-labs/Peer2Canvas/issues/96)

## 2. Appearance preference

- [x] 2.1 Implement the persistent System/Light/Dark control and theme tokens for production application chrome. Automated checks cover keyboard access, accessible labels, paper/styled-diagram invariance, and reduced-motion behavior; native restore and immediate-quit evidence remains in task 4.1. — GitHub Issue [#95](https://github.com/furancho-labs/Peer2Canvas/issues/95)

## 3. English and Spanish resources

- [x] 3.1 Add complete English and Spanish resource files for implemented UI domains and wire them to the locale preference. Automated checks cover key/parameter parity, accessible labels, errors, formatting, and fallback behavior. — GitHub Issue [#100](https://github.com/furancho-labs/Peer2Canvas/issues/100)
- [ ] 3.2 Have a fluent Spanish reviewer assess the shipped copy for natural phrasing and consistency against the glossary; record the reviewer and outcome. — GitHub Issue [#100](https://github.com/furancho-labs/Peer2Canvas/issues/100)

## 4. Platform integration

- [ ] 4.1 Verify preference restore and switching across Windows, macOS, and Linux. Confirm that theme and language changes do not mutate document bytes, revision, dirty state, or undo history; verify an immediate app exit drains queued preference writes or reports a failed save, and that a successful retry clears stale durability warnings; record native and automated evidence separately. — GitHub Issue [#101](https://github.com/furancho-labs/Peer2Canvas/issues/101)

## Workflow follow-up

- PR [#132](https://github.com/furancho-labs/Peer2Canvas/pull/132) merged these implementation changes into `dev` as `07a0662` on 2026-11-13; all 15 checks passed on the updated head. `main` was not changed.
- Tasks 1.1, 2.1, and 3.1 are implemented. Keep #95 open until native restore and immediate-quit persistence are verified through task 4.1/#101; keep #100 open until task 3.2 receives fluent human Spanish sign-off.
- Task 4.1 remains open: local tests and native compilation/launch do not verify preference restart/dialog behavior on Windows, macOS, or Linux. Static review found an immediate-quit race and a durability warning that may remain after a successful retry; track both here.
- Archive the change only after implementation, review, and acceptance evidence are complete.
