# S0 platform compatibility matrix

**Status:** The isolated S0 Tauri/Weave probe passed on the three GitHub-hosted runner images below. These results describe the tested images; they do not set minimum supported operating-system versions or prove the product editor workflows.

## Evidence

The matrix comes from [Actions run 42824270374](https://github.com/VforVitorio/peercanvas/actions/runs/42824270374) for PR [#71](https://github.com/VforVitorio/peercanvas/pull/71), tested merge ref `b8853f82599fb1e6f7a178fa2739ee2c15b088c8` and PR head `c29007b2235070fe25e881d8c677eff8af28996f`. The run uploaded `native-smoke-Linux`, `native-smoke-macOS`, and `native-smoke-Windows` artifacts. Each contains a result record, initial and edited screenshots, logs, and the native WebView version.

| GitHub-hosted runner image        | Operating system and architecture                | Native WebView reported by Tauri | Result and artifact            |
| --------------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------ |
| `ubuntu26` / `20261101.186.1`     | Ubuntu 26.04.1 LTS, kernel 7.0.0-1019-azure, x64 | WebKit/WebView 2.52.6            | Passed; `native-smoke-Linux`   |
| `macos26` / `20261102.0473.1`     | macOS 26.7.2 (25G332, Darwin 25.6.0), arm64      | WKWebView/WebKit 21624.5.1.11.3  | Passed; `native-smoke-macOS`   |
| `win25-vs2026` / `20261103.298.1` | Windows Server 2025 Datacenter (10.0.26100), x64 | WebView2 156.0.4314.58           | Passed; `native-smoke-Windows` |

The three runs used Rust 1.99.1, Node.js 24.22.2, React/ReactDOM 18.3.1, Tauri CLI/API 2.12.4, and the Tauri Rust crate 2.12.5. The test-only fixture pinned `@inditextech/weave-sdk`, `weave-types`, `weave-store-standalone`, and `weave-renderer-konva-base` to 5.7.1, Konva to 10.0.2, and Yjs to 13.6.27. The optional embedded test server was `tauri-plugin-wdio-webdriver` 1.5.1.

## Smoke coverage

The test-only Tauri probe launched with a bundled fixture containing two rectangles and one connector. It verified rendered canvas pixels, pointer selection without geometry changes, pointer movement by 80 × 40 units, pointer resize by 40 × 30 units, the resulting in-memory Weave-store geometry, unchanged connector points, absence of WebView errors, and process/loopback-port cleanup. Each platform passed all eight checks. The probe kept renderer `connect-src` blocked, used bundled fixture resources, and allowed only the loopback WebDriver connection. The GitHub runner still had network access for checkout and dependency installation; this is not a claim that the host network adapter was disconnected.

The normal application remains the engineering scaffold. The probe did not select durable storage, persist Yjs updates, implement the canonical product document model, or test save/open, peer collaboration, import/export, AI/MCP, or release accessibility workflows. Those remain in their work packages and release checks.

## Limits

GitHub runner labels move over time. Re-run the probe and update this table when a runner image or pinned renderer package changes. The table records compatibility on the listed images only; WP-11 still needs the release support floor, manual accessibility review, and native user-workflow checks.
