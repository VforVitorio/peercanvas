import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn, execFileSync } from "node:child_process";
import console from "node:console";
import { once } from "node:events";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createWsRelayServer } from "@trystero-p2p/ws-relay/server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeEnvironmentKeys = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "XAUTHORITY",
  "LANG",
  "LC_ALL",
  "LD_LIBRARY_PATH",
];
const runtimeEnvironment = Object.fromEntries(
  runtimeEnvironmentKeys.flatMap((key) =>
    process.env[key] === undefined ? [] : [[key, process.env[key]]],
  ),
);

async function assertProductionIsolation(directory) {
  let editorFound = false;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) editorFound = (await assertProductionIsolation(file)) || editorFound;
    else {
      const content = await readFile(file, "utf8");
      editorFound ||=
        content.includes("Diagram canvas") && content.includes("Document file actions");
      assert(
        !content.includes("Engineering scaffold. Diagram editing is not implemented yet."),
        `Stale scaffold in ${file}`,
      );
      assert(!content.includes("__PEERCANVAS_NATIVE_SMOKE__"), `Smoke instrumentation in ${file}`);
      assert(
        !content.includes("__PEERCANVAS_NATIVE_PEER__"),
        `Peer smoke instrumentation in ${file}`,
      );
      assert(
        !content.includes("__PEERCANVAS_NATIVE_INPUT_ISOLATION__"),
        `Smoke isolation in ${file}`,
      );
      assert(!content.includes("native-smoke-peer"), `Peer smoke entry in ${file}`);
      assert(
        !content.includes("pc-yjs-update"),
        `Peer transport leaked into production build in ${file}`,
      );
      assert(!content.includes("Native canvas compatibility probe"), `Smoke entry in ${file}`);
    }
  }
  return editorFound;
}

if (process.argv[2] === "--check-production") {
  assert(
    await assertProductionIsolation(path.join(root, "dist")),
    "Normal application editor missing from build",
  );
  console.log(
    "Normal frontend includes the in-memory editor and excludes native-smoke instrumentation.",
  );
} else {
  const modes = {
    canvas: { runPeers: false, usePublicRelay: false },
    "peers-local": { runPeers: true, usePublicRelay: false },
    "peers-public": { runPeers: true, usePublicRelay: true },
  };
  const mode = process.argv[2] ?? "canvas";
  assert(modes[mode], "Use canvas, peers-local, or peers-public native-smoke mode");
  await runNativeSmoke(modes[mode]);
}

async function runNativeSmoke({ runPeers, usePublicRelay }) {
  const artifactSuffix = !runPeers ? "" : usePublicRelay ? "-public" : "-peers";
  const artifactPlatform = `${process.platform}${artifactSuffix}`;
  const artifacts = path.join(root, "src-tauri", "target", "native-smoke", artifactPlatform);
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  const portProbe = createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const port = portProbe.address().port;
  await new Promise((resolve, reject) =>
    portProbe.close((error) => (error ? reject(error) : resolve())),
  );

  let relay = null;
  let relayUrl = "public";
  const relayMessageCounts = { subscribe: 0, publish: 0, unsubscribe: 0, malformed: 0, other: 0 };
  const relayTopicActivity = new Map();
  if (runPeers && !usePublicRelay) {
    relay = createWsRelayServer({ host: "127.0.0.1", port: 0 });
    await relay.ready;
    const relayAddress = relay.address();
    const relayPort = typeof relayAddress === "object" && relayAddress ? relayAddress.port : null;
    assert(Number.isInteger(relayPort), "Local WebSocket signaling relay did not bind a port");
    relayUrl = `ws://127.0.0.1:${relayPort}`;
    relay.wss.on("connection", (socket) => {
      socket.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          const type = message?.type;
          const topic = relayTopicActivity.get(message.topic) ?? { subscriptions: 0, publishes: 0 };
          if (type === "subscribe") topic.subscriptions++;
          if (type === "publish") topic.publishes++;
          relayTopicActivity.set(message.topic, topic);
          if (type === "subscribe" || type === "publish" || type === "unsubscribe")
            relayMessageCounts[type]++;
          else relayMessageCounts.other++;
        } catch {
          relayMessageCounts.malformed++;
        }
      });
    });
  }

  const address = `http://127.0.0.1:${port}`;
  const webViewReport = path.join(artifacts, "webview-version.txt");
  const binary = path.join(
    root,
    "src-tauri",
    "target",
    "debug",
    `peer-canvas${process.platform === "win32" ? ".exe" : ""}`,
  );
  const app = spawn(binary, [], {
    cwd: root,
    env: {
      ...runtimeEnvironment,
      TAURI_WEBDRIVER_PORT: String(port),
      PEERCANVAS_NATIVE_SMOKE_ENV_FILE: webViewReport,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  let exited = false;
  let launchError;
  app.stdout.on("data", (data) => {
    logs += data.toString();
  });
  app.stderr.on("data", (data) => {
    logs += data.toString();
  });
  app.on("exit", () => {
    exited = true;
  });
  app.on("error", (error) => {
    launchError = error;
  });
  const terminate = () => app.kill();
  process.once("SIGINT", terminate);
  process.once("SIGTERM", terminate);
  let session;
  const report = {
    status: "failed",
    startedAt: new Date().toISOString(),
    fixture: "two rectangles and one arrow; memory only",
    networkCondition: !runPeers
      ? "The canvas-only native smoke does not start peer networking"
      : usePublicRelay
        ? "Collaboration smoke uses the configured public MQTT signaling allowlist and Trystero's public Google/Cloudflare STUN defaults"
        : "External renderer endpoints denied; collaboration smoke uses an ephemeral loopback WebSocket relay and Trystero's public Google/Cloudflare STUN defaults",
    inputMethod:
      "Embedded WebDriver synthetic pointer/mouse events; trusted host input isolated in the test window",
    checks: [],
  };

  async function request(route, method = "GET", body, timeoutMs = 15000) {
    let response;
    let payload;
    try {
      response = await globalThis.fetch(`${address}${route}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: globalThis.AbortSignal.timeout(timeoutMs),
      });
      payload = await response.json();
    } catch (error) {
      throw new Error(`${method} ${route}: ${error.message}`, { cause: error });
    }
    if (!response.ok) {
      throw new Error(`${method} ${route}: ${JSON.stringify(payload.value ?? payload)}`);
    }
    return payload.value;
  }

  async function executeAsync(expression, args = []) {
    const script = `const done = arguments[arguments.length - 1]; Promise.resolve(${expression}).then(done, error => done({ __nativeSmokeError: error instanceof Error ? error.message : String(error) }));`;
    const value = await request(
      `/session/${session}/execute/async`,
      "POST",
      { script, args },
      90_000,
    );
    if (value?.__nativeSmokeError)
      throw new Error(`Native peer smoke: ${value.__nativeSmokeError}`);
    return value;
  }

  async function assertWebSocketAccess() {
    const state = await executeAsync(
      `new Promise(resolve => {
        const socket = new WebSocket(arguments[0]);
        const timeout = setTimeout(() => { socket.close(); resolve("timeout"); }, 5000);
        socket.addEventListener("open", () => { clearTimeout(timeout); socket.close(); resolve("open"); }, { once: true });
        socket.addEventListener("error", () => { clearTimeout(timeout); resolve("error"); }, { once: true });
      })`,
      [relayUrl],
    );
    assert.equal(state, "open", `Native WebView could not open the loopback relay (${state})`);
    report.checks.push("native WebView reached the ephemeral loopback WebSocket relay");
  }

  async function waitFor(check, description, timeout = 30000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (exited) throw new Error(`Native app exited while waiting for ${description}`);
      const value = await check();
      if (value) return value;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  const snapshot = () =>
    request(`/session/${session}/execute/sync`, "POST", {
      script: "return window.__PEERCANVAS_NATIVE_SMOKE__?.snapshot() ?? null;",
      args: [],
    });
  const hasPixel = (pixels, rgb) =>
    pixels.some((pixel) => rgb.every((value, index) => pixel[index] === value) && pixel[3] > 0);
  async function fixtureWhen(predicate, description) {
    let lastState;
    return waitFor(async () => {
      let state;
      try {
        state = await snapshot();
      } catch (error) {
        if (error.cause?.name === "TimeoutError") return null;
        throw error;
      }
      lastState = state;
      if (state?.error) throw new Error(state.error);
      return state?.ready && predicate(state) ? state : null;
    }, description).catch((error) => {
      if (lastState) {
        report.lastObserved = {
          stage: description,
          nodes: lastState.nodes,
          selection: lastState.selection,
          pixels: lastState.pixels,
          connector: lastState.connector,
          errors: lastState.errors,
          pointerEvents: lastState.pointerEvents,
          inputIsolation: lastState.inputIsolation,
          initialization: lastState.initialization,
        };
        report.inputIsolation = lastState.inputIsolation;
      }
      throw error;
    });
  }
  async function pointer(from, to = from) {
    const point = (position, duration = 0) => ({
      type: "pointerMove",
      origin: "viewport",
      x: Math.round(position.x),
      y: Math.round(position.y),
      duration,
    });
    const actions = [
      point(from),
      { type: "pointerDown", button: 0 },
      { type: "pause", duration: 80 },
    ];
    if (from.x !== to.x || from.y !== to.y) {
      // The embedded driver does not interpolate moves; Konva's proxy needs later move events.
      for (let step = 1; step <= 8; step++) {
        actions.push(
          point(
            {
              x: from.x + ((to.x - from.x) * step) / 8,
              y: from.y + ((to.y - from.y) * step) / 8,
            },
            40,
          ),
        );
      }
      actions.push({ type: "pause", duration: 80 });
    }
    actions.push({ type: "pointerUp", button: 0 });
    await request(`/session/${session}/actions`, "POST", {
      actions: [{ type: "pointer", id: "mouse", parameters: { pointerType: "mouse" }, actions }],
    });
  }
  async function screenshot(name) {
    const png = await request(`/session/${session}/screenshot`);
    await writeFile(path.join(artifacts, name), Buffer.from(png, "base64"));
  }

  try {
    await waitFor(() => request("/status").catch(() => null), "embedded WebDriver startup");
    const created = await waitFor(
      () =>
        request("/session", "POST", {
          capabilities: { alwaysMatch: { "wdio:tauriServiceOptions": { windowLabel: "main" } } },
        }).catch(() => null),
      "native window session",
    );
    session = created.sessionId;
    await request(`/session/${session}/timeouts`, "POST", { script: 90_000 });
    const initial = await fixtureWhen(
      (state) =>
        hasPixel(state.pixels.node, [37, 99, 235]) &&
        hasPixel(state.pixels.connector, [23, 32, 51]),
      "fixture rendering",
    );
    report.initial = initial;
    assert.deepEqual(initial.connector, [310, 200, 490, 200]);
    assert.deepEqual(initial.selection, []);
    assert(
      initial.resources.every(
        (resource) =>
          !/^https?:/.test(resource) ||
          resource.startsWith("http://tauri.localhost/") ||
          resource.startsWith("https://tauri.localhost/"),
      ),
      "Fixture fetched a remote resource",
    );
    await screenshot("initial.png");
    report.checks.push(
      "native launch with external renderer connections denied",
      "two nodes and connector rendered in actual canvas pixels",
    );

    await pointer(initial.targets.node);
    const selected = await fixtureWhen(
      (state) =>
        state.selection.length === 1 && state.selection[0] === "fixture-a" && state.targets.resize,
      "pointer selection",
    );
    report.selected = selected;
    assert.deepEqual(selected.nodes, initial.nodes, "Selection changed fixture geometry");
    report.checks.push("pointer selection without document geometry mutation");

    await pointer(selected.targets.node, {
      x: selected.targets.node.x + 80,
      y: selected.targets.node.y + 40,
    });
    const moved = await fixtureWhen(
      (state) =>
        state.nodes["fixture-a"].x > initial.nodes["fixture-a"].x + 60 &&
        state.nodes["fixture-a"].y > initial.nodes["fixture-a"].y + 20 &&
        hasPixel(state.pixels.node, [37, 99, 235]),
      "store-backed pointer move",
    );
    report.moved = moved;
    assert(Math.abs(moved.nodes["fixture-a"].x - initial.nodes["fixture-a"].x - 80) <= 2);
    assert(Math.abs(moved.nodes["fixture-a"].y - initial.nodes["fixture-a"].y - 40) <= 2);
    report.checks.push("pointer move updates Weave-store position and rendered pixels");

    await pointer(moved.targets.resize, {
      x: moved.targets.resize.x + 40,
      y: moved.targets.resize.y + 30,
    });
    const edited = await fixtureWhen(
      (state) =>
        state.nodes["fixture-a"].width > initial.nodes["fixture-a"].width + 20 &&
        state.nodes["fixture-a"].height > initial.nodes["fixture-a"].height + 15 &&
        hasPixel(state.pixels.node, [37, 99, 235]),
      "store-backed pointer resize",
    );
    report.edited = edited;
    report.inputIsolation = edited.inputIsolation;
    assert.deepEqual(edited.connector, initial.connector);
    assert(hasPixel(edited.pixels.connector, [23, 32, 51]));
    assert.deepEqual(edited.errors, []);
    await screenshot("edited.png");
    report.checks.push(
      "pointer resize updates Weave-store geometry and rendered pixels",
      "connector remains rendered",
      "no uncaught WebView errors",
    );

    if (runPeers && relay) await assertWebSocketAccess();

    if (runPeers) {
      const peerInitial = await executeAsync(
        "window.__PEERCANVAS_NATIVE_SMOKE__?.startPeerTest(arguments[0])",
        [relayUrl],
      );
      assert.equal(
        peerInitial.host.status,
        "ready",
        "Host did not record the initial-sync acknowledgement",
      );
      assert.equal(
        peerInitial.peer.status,
        "ready",
        "Participant became ready before validated sync",
      );
      assert.equal(peerInitial.sameDocument, true, "Initial peer snapshot did not converge");

      const peerEdit = await executeAsync("window.__PEERCANVAS_NATIVE_SMOKE__?.submitPeerEdit()");
      assert.equal(peerEdit.reply.status, "accepted", "Host rejected a valid peer edit");
      assert.equal(peerEdit.sameDocument, true, "Host and participant diverged after a peer edit");

      const peerReconnect = await executeAsync(
        "window.__PEERCANVAS_NATIVE_SMOKE__?.reconnectPeer()",
      );
      assert.equal(
        peerReconnect.peer.status,
        "ready",
        "Reconnected participant did not synchronize",
      );
      assert.equal(peerReconnect.sameDocument, true, "Reconnected participant missed host state");

      const peerHostLoss = await executeAsync("window.__PEERCANVAS_NATIVE_SMOKE__?.stopHost()");
      assert.equal(peerHostLoss.peer.status, "disconnected", "Host loss was not surfaced");
      assert.equal(
        peerHostLoss.retainedDocument,
        true,
        "Host loss changed the participant's last valid snapshot",
      );
      report.peerNetwork = {
        signaling: usePublicRelay
          ? "Trystero MQTT over the configured public broker allowlist"
          : "Trystero WebSocket relay on loopback",
        iceConfiguration: "Trystero public Google/Cloudflare STUN defaults; no TURN credentials",
        initialSync: {
          hostStatus: peerInitial.host.status,
          peerStatus: peerInitial.peer.status,
          converged: peerInitial.sameDocument,
        },
        acceptedCommand: {
          status: peerEdit.reply.status,
          revision: peerEdit.host.revision,
          converged: peerEdit.sameDocument,
          links: peerEdit.hostLinks,
        },
        reconnect: { status: peerReconnect.peer.status, converged: peerReconnect.sameDocument },
        hostLoss: {
          status: peerHostLoss.peer.status,
          retainedSnapshot: peerHostLoss.retainedDocument,
        },
      };
      report.checks.push(
        `two Tauri WebView contexts synchronized through Trystero/Yjs over ${usePublicRelay ? "public MQTT brokers" : "a loopback relay"}`,
        "host-sequenced remote command converged in both canonical models",
        "reconnect restored the current host checkpoint before ready",
        "host loss preserved the participant's validated in-memory snapshot",
      );
      await executeAsync("window.__PEERCANVAS_NATIVE_SMOKE__?.closePeerTest()");
    }

    const nativeWebView = (await readFile(webViewReport, "utf8")).trim();
    assert(nativeWebView && !nativeWebView.startsWith("error:"), "Native WebView version missing");
    const packages = {};
    for (const name of [
      "react",
      "react-dom",
      "@inditextech/weave-sdk",
      "@inditextech/weave-renderer-konva-base",
      "@inditextech/weave-store-standalone",
      "@inditextech/weave-types",
      "konva",
      "yjs",
      "@trystero-p2p/mqtt",
      "@trystero-p2p/ws-relay",
      "ws",
      "@tauri-apps/cli",
    ]) {
      packages[name] = JSON.parse(
        await readFile(path.join(root, "node_modules", name, "package.json"), "utf8"),
      ).version;
    }
    report.environment = {
      platform: process.platform,
      architecture: process.arch,
      productOS:
        process.platform === "darwin"
          ? `macOS ${execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim()} (${execFileSync("sw_vers", ["-buildVersion"], { encoding: "utf8" }).trim()})`
          : process.platform === "linux"
            ? ((await readFile("/etc/os-release", "utf8")).match(
                /^PRETTY_NAME="?([^"\n]+)"?$/m,
              )?.[1] ?? os.version())
            : os.version(),
      osRelease: os.release(),
      nativeWebView,
      node: process.version,
      rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
      packages,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      githubCommit: process.env.GITHUB_SHA ?? null,
      runnerImage: process.env.ImageOS ?? null,
      runnerImageVersion: process.env.ImageVersion ?? null,
    };
    report.status = "passed";
  } catch (error) {
    report.error = error.stack ?? String(error);
    if (relay)
      report.peerRelayDiagnostics = {
        connectedSockets: relay.wss.clients.size,
        subscriptions: relay.getSubscriberCount(),
        messageCounts: relayMessageCounts,
        topicActivity: [...relayTopicActivity.values()].sort(
          (left, right) =>
            left.subscriptions - right.subscriptions || left.publishes - right.publishes,
        ),
      };
    if (session) await screenshot("failure.png").catch(() => {});
    throw error;
  } finally {
    if (session)
      await executeAsync("window.__PEERCANVAS_NATIVE_SMOKE__?.closePeerTest()").catch(() => {});
    if (session) await request(`/session/${session}`, "DELETE").catch(() => {});
    if (!exited) {
      const closing = once(app, "exit").catch(() => {});
      app.kill();
      await Promise.race([closing, delay(3000)]);
      if (!exited) {
        app.kill("SIGKILL");
        await Promise.race([closing, delay(3000)]);
      }
    }
    process.removeListener("SIGINT", terminate);
    process.removeListener("SIGTERM", terminate);
    await relay?.close().catch((error) => {
      report.status = "failed";
      report.cleanupError = `Local signaling relay did not stop cleanly: ${String(error)}`;
      process.exitCode = 1;
    });
    try {
      assert(exited, "Native process did not exit during cleanup");
      await assert.rejects(
        () =>
          globalThis.fetch(`${address}/status`, { signal: globalThis.AbortSignal.timeout(500) }),
        "WebDriver port still open after process cleanup",
      );
      report.checks.push("native process and loopback port cleaned up");
    } catch (error) {
      report.status = "failed";
      report.cleanupError = String(error);
      process.exitCode = 1;
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(artifacts, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.join(artifacts, "native.log"), logs);
    console.log(
      JSON.stringify(
        {
          status: report.status,
          artifacts,
          checks: report.checks,
          error: report.error,
          cleanupError: report.cleanupError,
        },
        null,
        2,
      ),
    );
  }
}
