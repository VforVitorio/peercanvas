// SPDX-License-Identifier: Apache-2.0
// Native smoke diagnostics retain ICE types and states only, never candidate strings or addresses.

export type NativeIceDiagnostic = {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  candidateTypes: string[];
};

const connections: Array<{
  connection: RTCPeerConnection;
  candidateTypes: Set<string>;
}> = [];
let installed = false;

export function installNativeIceDiagnostics(): void {
  if (installed) return;
  const NativeRTCPeerConnection = window.RTCPeerConnection;

  class TrackedRTCPeerConnection extends NativeRTCPeerConnection {
    constructor(configuration?: RTCConfiguration) {
      super(configuration);
      const record = { connection: this, candidateTypes: new Set<string>() };
      connections.push(record);
      this.addEventListener("icecandidate", ({ candidate }) => {
        if (candidate?.type) record.candidateTypes.add(candidate.type);
      });
    }
  }

  window.RTCPeerConnection = TrackedRTCPeerConnection;
  installed = true;
}

export function readNativeIceDiagnostics(): NativeIceDiagnostic[] {
  return connections.map(({ connection, candidateTypes }) => ({
    connectionState: connection.connectionState,
    iceConnectionState: connection.iceConnectionState,
    iceGatheringState: connection.iceGatheringState,
    candidateTypes: [...candidateTypes].sort(),
  }));
}
