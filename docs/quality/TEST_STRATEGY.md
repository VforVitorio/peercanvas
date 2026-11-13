# Quality and verification strategy

Status: acceptance plan. The isolated S0 compatibility probe passed on the hosted runner images in the [platform matrix](../support/platform-matrix.md). Later capability checks require their product behavior to exist.

## Evidence rule

Distinguish planned, automated, manual, and not-yet-tested evidence. A frontend build is not a native desktop smoke test. A GitHub workflow file is not a passing workflow. A mock provider test is not proof of real account authorization. No benchmark result is recorded until it has a named machine, OS/WebView version, fixture, repetition count, and result.

## Test layers

| Layer             | Purpose                                                                   | Planned tools/evidence                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | Model invariants, commands, migrations, serializers, permission checks    | Vitest for TypeScript; Rust unit tests where native logic exists                                                                               |
| Property/fuzz     | IDs, serialization, XML/SVG parser bounds, Yjs updates                    | Property tests and bounded fuzz corpus chosen in relevant WP                                                                                   |
| Integration       | Weave adapter, persistence adapter, MCP boundary, app-server protocol     | Real package boundaries with deterministic fixtures and mock providers                                                                         |
| Native smoke      | Launch, dialogs, file association/deep link, WebView, child process       | Windows/macOS/Linux runner; `cargo test` and production Tauri builds on native-sensitive changes; targeted S0 probe plus manual product checks |
| E2E               | Create/edit/save/reopen, import/export, invite approval, Codex proposal   | Embedded WebDriver for S0 probe; product workflow tests in their WPs                                                                           |
| Visual regression | Canvas rendering and key accessible states                                | Stable diagram fixtures and OS/browser snapshots; review platform diffs                                                                        |
| Network           | Yjs convergence, LAN, STUN/TURN, reconnection, host loss                  | Controlled multi-peer fixtures, not a unit-test substitute                                                                                     |
| Security          | XML/SVG, links, OAuth token boundary, MCP authorization, dependency risks | Malicious fixtures, secret scanning, static analysis, threat-model review                                                                      |
| Accessibility     | Keyboard flows, focus, dialogs, contrast, screen reader semantics         | Automated checks plus manual keyboard/screen-reader review                                                                                     |
| Performance       | Startup, open/save, pan/zoom and large-document behavior                  | NFR fixtures and reference machine agreed in WP-01                                                                                             |

## S0 compatibility gate

WP-01 uses a separately invoked test-only Tauri/WebView probe. The normal app keeps the engineering scaffold, and normal production builds must exclude the probe entrypoint, fixture, and test instrumentation. The probe runs on changes to its Tauri/Weave/canvas harness, native dependencies/build configuration, and through manual dispatch; unrelated application and documentation changes skip the probe. Native production builds and persistence tests still run for application, dependency, and native-workflow changes on Windows, macOS, and Linux. Documentation/history/test-only, UI-mock, and unrelated workflow/settings changes skip those heavy native steps while preserving successful required job contexts. If change classification fails, full native coverage runs. Verify that separation as part of the frontend/native build review.

Use one controlled fixture containing the nodes and connector needed to exercise native launch, renderer mounting, selection, transforms, connector rendering, and one in-memory Weave-store-backed node edit. The probe tests the integrated rendering packages in the native WebView; it does not implement the canonical product model, durable storage, persisted Yjs updates, or user document workflows.

For each declared Windows, macOS, and Linux target, record:

- The tested commit, exact OS and architecture, WebView/runtime version, Rust version, React version, and pinned Weave package versions.
- The commands, fixture revision, and separate results for frontend compilation, native compilation, native launch, and each canvas interaction.
- Logs, screenshots or other retained artifacts sufficient to review the result, plus whether the check was automated or manual.
- Any blocked or failed behavior, its blocking issue, and an explicit fallback decision. Do not turn a missing native interaction result into a passing build result.

The compatibility record for issue #16 is in the [platform matrix](../support/platform-matrix.md) and linked from ADR-0001. A proposed target or an unrun procedure is not a verified support claim. Passing this fixture closes only the bounded S0 gate; product workflows and release accessibility, recovery, performance, and networking acceptance remain in their work packages.

## Required test scenarios by capability

The isolated UI demonstration has shared-core and simulated-service tests, Claude-authored UI tests, and separate browser/visual review. Record their exact results in [demo evidence](../development/ui-mock.md). These checks exercise in-memory commands and fictional outcomes only; they do not replace any production/native/file/network/provider scenario below. The normal build must exclude the demo entry/fixtures/instrumentation, and the demo uses its own output directory.

The canvas-only native smoke runs with `npm run native-smoke` and is used in CI for renderer and pointer-interaction coverage. Optional `npm run native-smoke:peers` and `npm run native-smoke:public` modes add two WebView collaboration tests using the loopback signaling relay or configured public MQTT brokers. Those same-machine modes do not substitute for independent-network/NAT coverage or a TURN test with valid credentials; record their actual candidate states and keep unavailable topologies open.

- Document: schema migration, invalid command, stable serialization, undo/redo, partial mutation rollback.
- Persistence: interrupted save, disk-full/permission error, corrupt snapshot, recovery, old schema migration.
- Catalog: deterministic search, invalid manifest, malicious SVG, attribution display, offline behavior, schema-v0/v1 migration, and stable-reference reopen.
- draw.io: valid XML, compression, source-ID relationships, unsupported feature report, hostile XML, decompression budget, safe-fragment round trips, and lossless supported subset.
- Collaboration: concurrent Yjs updates, initial state, offline edits, reconnection, host disconnect, viewer mutation rejection, malformed peer input.
- Invitation: entropy source, expiry, deep-link parsing, invalid secret, approval/denial, revoke, secret redaction, copied-data limitation.
- AI/MCP: context opt-in, stream failure, cancellation, usage limit, malformed tool payload, preview diff, approve/reject, audit, token redaction.
- Cross-platform: exact OS/WebView target matrix, dialogs, file paths, deep links, native process lifecycle, WebRTC behavior.

## Release quality gates

1. Required CI checks pass on the PR's target branch.
2. Every in-scope requirement maps to an acceptance test or documented manual verification.
3. Security-critical changes include a threat-model update and negative tests.
4. No unreviewed critical/high dependency vulnerability remains without a documented maintainer decision.
5. No unverified third-party asset is shipped.
6. Release notes identify tested OS/WebView combinations and known limitations.
7. The maintainer confirms native smoke tests and manual accessibility checks; these are not inferred from CI.

## Reference targets

Proposed measurable targets are in NFR-002..NFR-011 in the [product definition](../requirements/product-definition.md). WP-01 must name reference hardware and test procedures before the values become release commitments.
