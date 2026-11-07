# ADR-0001: Desktop shell and rendering baseline

- **Status:** Proposed, gated on WP-01.
- **Date:** 2026-11-07.

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

WP-01 must adapt only the required frontend components, mount the renderer, exercise selection/transforms/connectors, and check React peer dependencies on Windows, macOS, and Linux. If integration fails, record a fallback decision before replacing the selected engine.

## Sources

- [Weave.js 5.7.1 release](https://github.com/InditexTech/weavejs/releases/tag/5.7.1)
- [Weave React package manifest](https://github.com/InditexTech/weavejs/blob/5.7.1/code/packages/react/package.json)
- [weavejs-frontend example application](https://github.com/InditexTech/weavejs-frontend)
- [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/)
