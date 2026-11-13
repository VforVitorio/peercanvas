# S0 platform compatibility matrix

**Status:** The isolated S0 Tauri/Weave probe passed on the three GitHub-hosted runner images below. These results describe the tested images; they do not set minimum supported operating-system versions or prove the product editor workflows.

## Evidence

The matrix comes from [Actions run 42824270374](https://github.com/furancho-labs/Peer2Canvas/actions/runs/42824270374) for PR [#71](https://github.com/furancho-labs/Peer2Canvas/pull/71), tested merge ref `b8853f82599fb1e6f7a178fa2739ee2c15b088c8` and PR head `c29007b2235070fe25e881d8c677eff8af28996f`. The run uploaded `native-smoke-Linux`, `native-smoke-macOS`, and `native-smoke-Windows` artifacts. Each contains a result record, initial and edited screenshots, logs, and the native WebView version.

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

## Peer WebRTC evidence (WP-07.3)

Manual run [43426758968](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43426758968) passed the iframe peer smoke on GitHub macOS and Windows runners; the selected ICE candidates were `host`/`host`. On the Linux runner, WebKitGTK 2.52.6 did not expose `RTCPeerConnection`. Setting `WebKitSettings.enable-webrtc` in the smoke-only binary did not add the API in run [43429007418](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43429007418). WebKitGTK 2.54.2 disables WebRTC in its stable build while replacing the backend ([release notes](https://webkitgtk.org/2026/09/16/webkitgtk-2.54-highlights.html)).

Repeat run [43442798805](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43442798805) passed the same-WebView iframe smoke again on macOS 26.7.2 / WKWebView 21624.5.1.11.3 and Windows Server 2025 / WebView2 156.0.4314.58, with host/host candidates. A test-only Linux WebRTC shim spike exposed the missing API on WebKitGTK 2.52.6 and gathered candidates, but the Trystero smoke established no peer and received no DataChannel messages. It is not production integration evidence.

The macOS job in run [43445382066](https://github.com/furancho-labs/Peer2Canvas/actions/runs/43445382066) passed an opt-in forced TURN smoke using coturn 4.18.0 bound to `127.0.0.1`, temporary credentials, and `iceTransportPolicy: "relay"`. Both WebView contexts reported a connected relay/relay pair and synchronized through initial state, edit, reconnect, and graceful host loss; the process and temporary configuration were cleaned up. The Linux and Windows jobs in the overall run also passed native build/canvas checks, but did not run the peer smoke. This proves a controlled local TURN path on the tested WKWebView, not independent-network NAT traversal or a selected production provider.

The peer smoke runs two JavaScript contexts in one Tauri WebView, not two app processes or devices. It does not establish support across Linux distributions, separate networks, NAT/firewalls, STUN failure, TURN, or host crashes. Linux peer support and the other #37 scenarios remain unverified; this runner matrix is not a product support declaration.
