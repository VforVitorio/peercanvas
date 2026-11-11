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
      editorFound ||= content.includes("Diagram canvas") && content.includes("Unsaved · in memory");
      assert(
        !content.includes("Engineering scaffold. Diagram editing is not implemented yet."),
        `Stale scaffold in ${file}`,
      );
      assert(!content.includes("__PEERCANVAS_NATIVE_SMOKE__"), `Smoke instrumentation in ${file}`);
      assert(
        !content.includes("__PEERCANVAS_NATIVE_INPUT_ISOLATION__"),
        `Smoke isolation in ${file}`,
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
  assert.equal(process.argv.length, 2, "Unknown native-smoke argument");
  await runNativeSmoke();
}

async function runNativeSmoke() {
  const artifacts = path.join(root, "src-tauri", "target", "native-smoke", process.platform);
  await rm(artifacts, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  const portProbe = createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const port = portProbe.address().port;
  await new Promise((resolve, reject) =>
    portProbe.close((error) => (error ? reject(error) : resolve())),
  );

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
    offlineCondition: "Renderer CSP connect-src 'none'; bundled resources only; loopback WebDriver",
    inputMethod:
      "Embedded WebDriver synthetic pointer/mouse events; trusted host input isolated in the test window",
    checks: [],
  };

  async function request(route, method = "GET", body) {
    let response;
    let payload;
    try {
      response = await globalThis.fetch(`${address}${route}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: globalThis.AbortSignal.timeout(15000),
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
      "native launch with renderer connections denied",
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
    if (session) await screenshot("failure.png").catch(() => {});
    throw error;
  } finally {
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
