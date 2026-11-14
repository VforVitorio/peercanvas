import { describe, expect, it } from "vitest";
import {
  installNativeIceDiagnostics,
  readNativeIceDiagnostics,
  resetNativeIceDiagnostics,
} from "./ice-diagnostics";

describe("native ICE diagnostics", () => {
  it("clears connections from a previous manual run", () => {
    class MockRTCPeerConnection extends EventTarget {
      connectionState: RTCPeerConnectionState = "new";
      iceConnectionState: RTCIceConnectionState = "new";
      iceGatheringState: RTCIceGatheringState = "new";
    }
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      writable: true,
      value: MockRTCPeerConnection as unknown as typeof window.RTCPeerConnection,
    });

    installNativeIceDiagnostics();
    new window.RTCPeerConnection();
    expect(readNativeIceDiagnostics()).toHaveLength(1);

    resetNativeIceDiagnostics();
    expect(readNativeIceDiagnostics()).toEqual([]);
  });
});
