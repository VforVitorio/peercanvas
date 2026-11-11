# Design

## Context

See [proposal.md](proposal.md) and [the guided-onboarding spec](specs/guided-onboarding/spec.md). UC-01..UC-10 currently describe ten user workflows, but they are candidates for an audit, not a promise to create ten tours. The final inventory depends on which S3-S6 capabilities and local workflows are implemented for the PMV.

## Goals / Non-Goals

**Goals:**

- Reuse one accessible spotlight-and-callout shell for the small number of tours approved by WP-15.1.
- Keep tour steps isolated from the user's active diagram, route, and draft.
- Localize all tour content with the shared English/Spanish resources.
- Make the spotlight track stable interface targets and recover when a target disappears.

**Non-Goals:**

- Build a tour for every use case or every button.
- Navigate the user's real document or make sample edits while explaining the product.
- Call file, network, collaboration, Codex, or MCP operations from the tutorial.
- Copy DGReform source code, dependencies, assets, or internal names.

## Decisions

### Audit journeys before authoring tours

WP-15.1 reviews the complete implemented PMV and maps each candidate tour to an available, stable workflow and actionable UI targets. Combine related steps where useful and defer capabilities that are not implemented. Do not decide the final tour count in advance.

**Alternative considered:** create ten tours for UC-01..UC-10. Rejected because several listed capabilities are future work and some journeys can share an introduction.

### Use an inert local preview and an overlay shell

Render the tutorial against a bounded local preview fixture that is separate from the active document. Surround a spotlight target with four dimmed regions and place a callout beside it. Target geometry is refreshed after step changes, scrolling, and window resize; a missing target produces a useful fallback step.

**Alternative considered:** spotlight controls in the live workspace. Rejected because tours can navigate, submit, or alter user work and may fail when current state differs from the tutorial's expected state.

### Manage focus and input explicitly

Give the tour dialog an accessible name, keyboard navigation, Escape/close behavior, and focus restoration to its starter control. The preview is inert. The spotlight and callout remain usable in small windows and with reduced motion.

**Alternative considered:** pointer-only walkthroughs or a full-page animation. Rejected because these limit access and can obscure the interface.

### Depend on existing localization and theme behavior

Store tour copy in the English/Spanish resources from WP-13. Preserve both editor themes and the reduced-motion preference. The onboarding shell does not create another theme or locale store.

## Risks / Trade-offs

- **A target changes between releases** → test each step against the current UI, use unique target identifiers, and provide a fallback instead of leaving a stale spotlight.
- **A preview leaks behavior into the active editor** → keep the preview inert and separate from active model state; assert document, route, history, selection, and drafts remain unchanged.
- **A callout covers the target in a small window** → constrain placement to the viewport and allow the callout to scroll or reposition.
- **An unimplemented capability is described as available** → author tours only from the WP-15.1 approved inventory and verify claims against the released UI.

## Migration Plan

No document migration is needed. Add the tour shell after the PMV journey inventory and localization are approved. If a tour is removed or its target becomes invalid, keep Help usable and omit or replace that tour without changing user diagrams.

## Open Questions

None block the task sequence. WP-15.1 resolves tour count, titles, entry points, and the final workflow mapping before tour content is authored.
