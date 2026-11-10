# ADR-0001: Desktop shell and rendering baseline

- **Status:** Proposed, gated on WP-01.
- **Date:** 2026-11-07.
- **Acceptance review:** 2026-11-10.

## Context

PeerCanvas must be a Windows/macOS/Linux desktop app with a professional diagram canvas. The user specified Tauri 2, React, TypeScript, Vite, and Weave.js. Weave's React renderer currently targets React 18; the generated Tauri template originally selected React 19, so the scaffold was aligned to React 18.3.1.

## Options

1. Tauri 2 + React 18 + Vite + Weave.js.
2. A custom canvas/editor stack.
3. A browser-only or Next.js application.

## Decision

Use Tauri 2 + React 18.3.1 + TypeScript + Vite 8 as the foundation, with Weave.js 5.7.1 as the canvas engine. Reuse the official `weavejs-frontend` selectively as the starting point for canvas UI components, adapting those components to the existing Tauri/Vite shell instead of importing its TanStack Start application runtime. Keep native packaging format undecided.

## Rationale and consequences

This honors the specified stack and reuses the upstream renderer and frontend capabilities rather than rebuilding them. The example frontend is an adaptation source, not a second application shell. The existing app does not yet include that source or prove Weave works in each Tauri WebView. OS WebViews differ, so browser compatibility must be verified against actual runner/runtime versions. Preserve Apache-2.0 notices for any upstream code that is adopted.

## Risks and validation

WP-01 is the bounded compatibility gate in S0. Use a separately invoked test-only Tauri/WebView probe, adapt only the required frontend composition, and exercise one controlled fixture to verify native launch, renderer mounting, selection, transforms, connector rendering, and one in-memory Weave-store-backed node edit on Windows, macOS, and Linux. Exclude the probe and its instrumentation from normal production builds; the normal app retains the engineering scaffold.

Follow the [S0 evidence procedure](../../quality/TEST_STRATEGY.md#s0-compatibility-gate). Record the exact OS, WebView, Rust, React, and Weave versions, the source commit and files adopted from upstream, and their license notices. The completed record will live in `docs/support/platform-matrix.md`; add its links only when actual evidence exists.

Report frontend compilation, native compilation, and native interaction evidence separately. A successful build is not a passed canvas smoke test. If a required native behavior fails or cannot be verified, record a blocking issue and explicit fallback decision before claiming the gate passed or replacing the selected engine.

The fixture uses temporary state only. WP-01 does not choose a durable store, persist Yjs updates, or implement user save/open/recovery workflows; those decisions and tests remain in WP-03.

## Sources

- [Weave.js 5.7.1 release](https://github.com/InditexTech/weavejs/releases/tag/5.7.1)
- [Weave React package manifest](https://github.com/InditexTech/weavejs/blob/5.7.1/code/packages/react/package.json)
- [weavejs-frontend example application](https://github.com/InditexTech/weavejs-frontend)
- [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/)
