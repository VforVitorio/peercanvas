# Proposal

## Why

The PMV will need concise guidance for users who are new to PeerCanvas, but the tour count and journeys should follow the workflows that actually ship. Planning the accessible overlay and its safety boundary now keeps onboarding separate from document content and provider/network behavior.

## What Changes

- Audit the implemented PMV workflows and approve which journeys deserve a guided tour.
- Add an optional, restartable spotlight-and-callout tour for verified workflows only.
- Support keyboard navigation, Escape/close, focus restoration, small windows, both themes/languages, and reduced motion.
- Isolate the tour preview from the active document and prohibit provider, network, file, and collaboration calls.
- Author English and natural Spanish tour copy after the journey audit.

## Capabilities

### New Capabilities

- `guided-onboarding`: Accessible, isolated guided tours for workflows verified in the PMV.

### Modified Capabilities

None.

## Impact

The production React shell, focus management, localization resources, accessibility tests, product definition, and S10/WP-15 tracking are affected. The DGReform spotlight interaction is a visual reference only; no source code, dependencies, or private assets will be copied. This proposal does not authorize implementation.
