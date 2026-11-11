# Tasks

## 1. Journey audit

- [ ] 1.1 Audit the implemented PMV and review UC-01..UC-10; document the final tour count, purpose, entry point, target map, fallback, and deferred journeys. Verify that every proposed step maps to a stable, available workflow and obtain maintainer review before tour authoring. — GitHub Issue [#102](https://github.com/furancho-labs/Peer2Canvas/issues/102)

## 2. Accessible tour shell

- [ ] 2.1 Implement an isolated spotlight-and-callout shell with keyboard navigation, Escape/close, focus restoration, target remeasurement, and a missing-target fallback. Verify these behaviors and add tests for small windows and reduced motion. — GitHub Issue [#103](https://github.com/furancho-labs/Peer2Canvas/issues/103)

## 3. Localized tour content

- [ ] 3.1 Author English and natural Spanish steps for the reviewed tour inventory using the shared localization resources. Verify key/parameter parity, target labels, and copy claims against the current UI. — GitHub Issue [#97](https://github.com/furancho-labs/Peer2Canvas/issues/97)

## 4. End-to-end onboarding verification

- [ ] 4.1 Verify tour isolation, focus, layout, localization, theme, and reduced-motion behavior in the native app. Confirm that starting, advancing, and closing a tour leave document bytes/revision, selection, history, route, and drafts unchanged and make no file/network/provider/collaboration calls. — GitHub Issue [#94](https://github.com/furancho-labs/Peer2Canvas/issues/94)

## Workflow follow-up

- Obtain maintainer approval of the journey inventory and complete OpenSpec change before implementation begins.
- Archive the change only after implementation and acceptance evidence are complete.
