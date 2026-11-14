// SPDX-License-Identifier: Apache-2.0
// __PEERCANVAS_NATIVE_MANUAL__: excluded from normal production builds.

import { useEffect, useRef, useState } from "react";
import { PeerDocumentSession } from "../collaboration/peer-document-session";
import { createTrysteroPeerTransport } from "../collaboration/trystero-peer-transport";
import { serializeDocument } from "../document";
import { localDocumentFiles } from "../editor/local-document-files";
import { createSample } from "../editor/sample";
import {
  installNativeIceDiagnostics,
  readNativeIceDiagnostics,
  resetNativeIceDiagnostics,
} from "./ice-diagnostics";
import {
  encodeManualSessionCode,
  parseManualSessionCode,
  type ManualSessionCode,
} from "./manual-session-code";
import "./manual-smoke.css";

type Role = "host" | "participant";
type Report = {
  role: Role;
  status: string;
  peerCount: number;
  readyCount: number;
  revision: number | null;
  sha256: string | null;
  links: Array<{
    connectionState: RTCPeerConnectionState | null;
    iceConnectionState: RTCIceConnectionState | null;
    localCandidateType: string | null;
    remoteCandidateType: string | null;
  }>;
  ice: ReturnType<typeof readNativeIceDiagnostics>;
};

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export default function ManualPeerTest() {
  const [role, setRole] = useState<Role>("host");
  const [codeInput, setCodeInput] = useState("");
  const [hostCode, setHostCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Choose a role. Start only with trusted test participants.",
  );
  const [invalidCode, setInvalidCode] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const session = useRef<PeerDocumentSession | null>(null);
  const transport = useRef<Awaited<ReturnType<typeof createTrysteroPeerTransport>> | null>(null);
  const rejoinCode = useRef<ManualSessionCode | null>(null);
  const savedFixture = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let reading = false;
    const refresh = async () => {
      const current = session.current;
      if (!current || reading) return;
      reading = true;
      try {
        const snapshot = current.getSnapshot();
        const serialized = snapshot.model ? serializeDocument(snapshot.model.document) : null;
        const digest = serialized?.ok
          ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized.value))
          : null;
        const links = (await transport.current?.getNetworkDiagnostics()) ?? [];
        if (mounted.current && session.current === current) {
          setReport({
            role: snapshot.role,
            status: snapshot.status,
            peerCount: snapshot.peerCount,
            readyCount: snapshot.readyPeerCount,
            revision: snapshot.model?.revision ?? null,
            sha256: digest
              ? Array.from(new Uint8Array(digest), (byte) =>
                  byte.toString(16).padStart(2, "0"),
                ).join("")
              : null,
            links: links.map(
              ({
                connectionState,
                iceConnectionState,
                localCandidateType,
                remoteCandidateType,
              }) => ({
                connectionState,
                iceConnectionState,
                localCandidateType,
                remoteCandidateType,
              }),
            ),
            ice: readNativeIceDiagnostics(),
          });
        }
      } catch {
        if (mounted.current) setMessage("Cannot read the sanitized session report.");
      } finally {
        reading = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      void session.current?.close().catch(() => {});
      session.current = null;
      transport.current = null;
      rejoinCode.current = null;
      if (savedFixture.current) void localDocumentFiles.close().catch(() => {});
    };
  }, []);

  async function connect(descriptor?: ManualSessionCode, preserveDiagnostics = false) {
    setBusy(true);
    setInvalidCode(false);
    setReport(null);
    setHostCode("");
    setShowCode(false);
    setMessage(
      role === "host"
        ? "Save the synthetic initial fixture to start."
        : "Connecting to the test host…",
    );
    let nextTransport: Awaited<ReturnType<typeof createTrysteroPeerTransport>> | null = null;
    let hostStarted = false;
    try {
      await session.current?.close();
      session.current = null;
      transport.current = null;
      if (!mounted.current) return;
      setRunning(false);
      const initial = role === "host" ? createSample() : null;
      if (initial) {
        const serialized = serializeDocument(initial.document);
        if (!serialized.ok) throw new Error("Invalid synthetic fixture.");
        const saved = await localDocumentFiles.save(serialized.value, true, "en");
        savedFixture.current = saved !== null;
        if (!mounted.current) return;
        if (!saved || saved.warning) {
          setMessage(
            saved
              ? "The save reported a warning. No session started."
              : "Save cancelled. No session started.",
          );
          return;
        }
      }
      if (role === "participant" && !descriptor) throw new Error("Missing test code.");
      if (!preserveDiagnostics) resetNativeIceDiagnostics();
      installNativeIceDiagnostics();
      const roomId = descriptor?.roomId ?? randomHex(16);
      const password = descriptor?.password ?? randomHex(32);
      nextTransport = await createTrysteroPeerTransport({
        roomId,
        password,
      });
      if (!mounted.current) {
        await nextTransport.close();
        return;
      }
      transport.current = nextTransport;
      const nextSession = initial
        ? new PeerDocumentSession({ role: "host", initialState: initial, transport: nextTransport })
        : new PeerDocumentSession({
            role: "participant",
            hostPeerId: descriptor!.hostPeerId,
            transport: nextTransport,
          });
      session.current = nextSession;
      setRunning(true);
      await nextSession.start();
      if (!mounted.current) return;
      if (initial)
        setHostCode(
          encodeManualSessionCode({
            version: 1,
            roomId,
            password,
            hostPeerId: nextTransport.peerId,
          }),
        );
      setMessage(
        "Session started. Edits stay in memory; compare the revision and SHA-256 on both devices.",
      );
      hostStarted = role === "host";
    } catch {
      if (session.current) await session.current.close().catch(() => {});
      else await nextTransport?.close().catch(() => {});
      session.current = null;
      transport.current = null;
      if (mounted.current) {
        setRunning(false);
        setMessage(
          "Test session could not start. Check native WebRTC and network access, then retry.",
        );
      }
    } finally {
      if (role === "host" && !hostStarted) {
        try {
          await localDocumentFiles.close();
          savedFixture.current = false;
        } catch {
          if (mounted.current)
            setMessage("Cleanup reported a failure. Quit this test process before another run.");
        }
      }
      if (mounted.current) setBusy(false);
    }
  }

  async function join() {
    const parsed = parseManualSessionCode(codeInput);
    if (!parsed.ok) {
      setInvalidCode(true);
      setMessage(parsed.error);
      return;
    }
    rejoinCode.current = parsed.value;
    setCodeInput("");
    await connect(parsed.value);
  }

  async function edit() {
    const current = session.current;
    const state = current?.getSnapshot().model;
    const page = state?.document.pages[0];
    const layer = page?.layers[0];
    const node = layer?.nodes[0];
    if (!current || !page || !layer || !node) return;
    setBusy(true);
    try {
      const reply = await current.submitCommand({
        type: "node.update",
        pageId: page.pageId,
        layerId: layer.layerId,
        node: { ...node, geometry: { ...node.geometry, x: node.geometry.x + 24 } },
      });
      if (mounted.current)
        setMessage(
          reply.status === "accepted"
            ? "Synthetic edit accepted. Compare both reports after synchronization."
            : "Synthetic edit rejected. The canonical validator did not apply it.",
        );
    } catch {
      if (mounted.current) setMessage("Synthetic edit failed. Check the sanitized session status.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      await session.current?.close();
      if (savedFixture.current) await localDocumentFiles.close();
      savedFixture.current = false;
      setMessage("Test session closed. The chosen fixture file was not saved again.");
    } catch {
      setMessage("Cleanup reported a failure. Quit this test process before another run.");
    } finally {
      session.current = null;
      transport.current = null;
      rejoinCode.current = null;
      setHostCode("");
      setCodeInput("");
      setShowCode(false);
      setReport(null);
      setRunning(false);
      setBusy(false);
    }
  }

  return (
    <main
      className="manual-peer-test"
      data-native-manual="__PEERCANVAS_NATIVE_MANUAL__"
      aria-busy={busy}
    >
      <h1>Manual cross-device peer test</h1>
      <aside className="manual-warning" aria-label="Test-only security warning">
        <strong>TEST ONLY — bearer code grants read/edit access.</strong>
        <p>
          Anyone holding the code can read and edit the synthetic in-memory fixture. This is not a
          secure invitation: no S5 admission, roles, or expiry. Use trusted participants and no
          personal documents.
        </p>
        <p>
          Keep the code out of URLs, logs, reports, screenshots, and shared recordings. Only the
          sanitized report below is suitable for evidence.
        </p>
      </aside>
      <label htmlFor="manual-role">Test role</label>
      <select
        id="manual-role"
        value={role}
        disabled={busy || running}
        onChange={(event) => {
          setRole(event.target.value as Role);
          setInvalidCode(false);
        }}
      >
        <option value="host">Host</option>
        <option value="participant">Peer</option>
      </select>
      {role === "host" ? (
        <section aria-label="Host controls">
          <p>
            Save the initial synthetic sample to a test-only .peercanvas file. Hash that file before
            and after the session; session edits are never auto-saved.
          </p>
          <button disabled={busy || running} onClick={() => void connect()}>
            Save fixture and start host
          </button>
          {hostCode && (
            <>
              <button
                disabled={busy}
                aria-expanded={showCode}
                aria-controls="manual-host-code"
                onClick={() => setShowCode(!showCode)}
              >
                {showCode ? "Hide test code" : "Show test code for manual copy"}
              </button>
              {showCode && (
                <div id="manual-host-code">
                  <label htmlFor="manual-code-output">
                    Private test code — select and copy manually
                  </label>
                  <textarea id="manual-code-output" readOnly value={hostCode} spellCheck={false} />
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <section aria-label="Peer controls">
          <label htmlFor="manual-code-input">Host test code</label>
          <textarea
            id="manual-code-input"
            value={codeInput}
            maxLength={1024}
            disabled={busy || running}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalidCode}
            aria-describedby="manual-status"
            onChange={(event) => {
              setCodeInput(event.target.value);
              setInvalidCode(false);
            }}
          />
          <button disabled={busy || running} onClick={() => void join()}>
            Join test host
          </button>
          <button
            disabled={busy || !rejoinCode.current}
            onClick={() => void connect(rejoinCode.current!, true)}
          >
            Leave and rejoin with retained code
          </button>
        </section>
      )}
      <div className="manual-actions">
        <button
          disabled={
            busy ||
            !running ||
            !report?.sha256 ||
            (role === "participant" && report.status !== "ready")
          }
          onClick={() => void edit()}
        >
          Submit one synthetic edit (+24 x)
        </button>
        <button disabled={busy} onClick={() => void close()}>
          Close session and clear code
        </button>
      </div>
      <p id="manual-status" role="status">
        {message}
      </p>
      <section aria-label="Sanitized session report">
        <h2>Sanitized report</h2>
        <p>
          Role/status, counts, canonical revision, SHA-256, ICE types and states only. Refreshes
          every second.
        </p>
        <pre>{report ? JSON.stringify(report, null, 2) : "No active session report."}</pre>
      </section>
    </main>
  );
}
