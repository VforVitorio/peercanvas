# Initial risk register

Status: planning baseline reviewed on 2026-11-10 after the S0 compatibility probe. Likelihood and impact remain qualitative ratings, not measured probabilities.

| ID   | Risk                                                                      | Likelihood / impact | Mitigation and closure evidence                                                                                                                               | WP          |
| ---- | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| R-01 | Weave React renderer is incompatible with a target Tauri WebView          | Medium / High       | Test-only probe passes on the current [runner matrix](../support/platform-matrix.md); verify product integration and minimum OS/WebView floors before release | WP-01/WP-11 |
| R-02 | Local persistence loses or corrupts the last valid document               | Medium / Critical   | Compare storage options; atomic writes, snapshots, fault injection and recovery test                                                                          | WP-03       |
| R-03 | WebRTC cannot establish a direct connection through NAT/firewalls         | High / Medium       | LAN/STUN/TURN matrix, visible failure/retry, replaceable transport, document service needs                                                                    | WP-07       |
| R-04 | Invite secret leaks through URL handling, logs, history, or crash reports | Medium / Critical   | URL fragment, redaction, expiry, host approval, link-handling tests                                                                                           | WP-08       |
| R-05 | Viewer or malicious peer bypasses UI restrictions                         | Medium / Critical   | Enforce permissions at command boundary; negative tests for every mutation path                                                                               | WP-08       |
| R-06 | Revocation is overstated despite a peer already copying document data     | Medium / High       | State limit clearly in UX/docs; design only promises prevention of future session access                                                                      | WP-08       |
| R-07 | Hostile XML/SVG causes script execution or resource exhaustion            | Medium / High       | Bounded parser, no external entities/fetch, sanitizer, malicious fixtures                                                                                     | WP-06       |
| R-08 | AI/MCP proposal alters or exposes content without user understanding      | Medium / High       | Explicit context selection, structured tools, preview, approval, audit and bounded reads                                                                      | WP-09/WP-10 |
| R-09 | ChatGPT plan usage preview changes or is unavailable to the app           | Medium / High       | Recheck registration/terms/eligibility at WP-09; local editor and provider abstraction remain usable                                                          | WP-09       |
| R-10 | Third-party icons/stencils are redistributed without sufficient rights    | Medium / High       | Per-asset source/license/trademark review; no unverified asset bundles                                                                                        | WP-05       |
| R-11 | Cross-platform CI gives false confidence about native behavior            | High / Medium       | Distinguish test-only fixture evidence from product workflows; record manual release smoke and accessibility checks                                           | WP-00/WP-11 |
| R-12 | Work-package estimates exceed available solo/community capacity           | High / Medium       | Use person-day ranges, no velocity assumption, split/carry packages between two-week boxes                                                                    | All         |

Review this register when the corresponding experiment runs or a new failure mode appears. Do not lower a rating without evidence.

## Current dependency alerts

As of 2026-11-10, GitHub reports seven open Dependabot alerts: one high, five medium, and one low. The high Vite alert and the remaining findings are tracked under WP-11.3, issue [#50](https://github.com/VforVitorio/peercanvas/issues/50). S0 does not remediate these pre-existing alerts or establish release readiness; resolve them or record a separate maintainer disposition before release.
