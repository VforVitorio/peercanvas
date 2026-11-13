// SPDX-License-Identifier: Apache-2.0
// Native smoke diagnostics retain ICE and data-channel state only, never payloads or addresses.

export type NativeIceDiagnostic = {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  candidateTypes: string[];
  dataChannels: NativeDataChannelDiagnostic[];
};

export type NativeDataChannelDiagnostic = {
  readyState: RTCDataChannelState;
  opened: boolean;
  closed: boolean;
  sendObserved: boolean;
  sendAttempts: number;
  synchronousSendErrors: number;
  lastSynchronousSendError: string | null;
  channelErrors: number;
  lastChannelError: string | null;
  onopenHandlerAssigned: boolean | null;
  openConnectionState: RTCPeerConnectionState | null;
  openIceConnectionState: RTCIceConnectionState | null;
  openSignalingState: RTCSignalingState | null;
  openRemoteDescriptionType: RTCSdpType | null;
  messageCount: number;
  samples: Array<{
    isArrayBuffer: boolean;
    isArrayBufferView: boolean;
    tag: string;
    byteLength: number | null;
  }>;
};

const MAX_TRACKED_DATA_CHANNELS = 16;
const MAX_MESSAGE_SAMPLES_PER_CHANNEL = 8;

const connections: Array<{
  connection: RTCPeerConnection;
  candidateTypes: Set<string>;
  dataChannels: Array<{ channel: RTCDataChannel; diagnostic: NativeDataChannelDiagnostic }>;
}> = [];
let trackedDataChannelCount = 0;
let installed = false;

function trackDataChannel(connection: (typeof connections)[number], channel: RTCDataChannel): void {
  if (trackedDataChannelCount >= MAX_TRACKED_DATA_CHANNELS) return;
  trackedDataChannelCount += 1;

  const diagnostic: NativeDataChannelDiagnostic = {
    readyState: channel.readyState,
    opened: channel.readyState === "open",
    closed: channel.readyState === "closed",
    sendObserved: false,
    sendAttempts: 0,
    synchronousSendErrors: 0,
    lastSynchronousSendError: null,
    channelErrors: 0,
    lastChannelError: null,
    onopenHandlerAssigned: null,
    openConnectionState: null,
    openIceConnectionState: null,
    openSignalingState: null,
    openRemoteDescriptionType: null,
    messageCount: 0,
    samples: [],
  };
  connection.dataChannels.push({ channel, diagnostic });
  try {
    const send = channel.send;
    channel.send = (data) => {
      diagnostic.sendAttempts += 1;
      try {
        Reflect.apply(send, channel, [data]);
      } catch (error) {
        diagnostic.synchronousSendErrors += 1;
        diagnostic.lastSynchronousSendError = error instanceof Error ? error.name : "UnknownError";
        throw error;
      }
    };
    diagnostic.sendObserved = true;
  } catch {
    diagnostic.sendObserved = false;
  }
  channel.addEventListener("open", () => {
    diagnostic.opened = true;
    diagnostic.onopenHandlerAssigned = typeof channel.onopen === "function";
    diagnostic.openConnectionState = connection.connection.connectionState;
    diagnostic.openIceConnectionState = connection.connection.iceConnectionState;
    diagnostic.openSignalingState = connection.connection.signalingState;
    diagnostic.openRemoteDescriptionType = connection.connection.remoteDescription?.type ?? null;
  });
  channel.addEventListener("close", () => {
    diagnostic.closed = true;
  });
  channel.addEventListener("error", (event) => {
    diagnostic.channelErrors += 1;
    diagnostic.lastChannelError = (event as RTCErrorEvent).error?.name ?? "RTCDataChannelError";
  });
  channel.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
    diagnostic.messageCount += 1;
    if (diagnostic.samples.length >= MAX_MESSAGE_SAMPLES_PER_CHANNEL) return;
    const isArrayBuffer = data instanceof ArrayBuffer;
    const isArrayBufferView = ArrayBuffer.isView(data);
    const byteLength =
      typeof data === "object" &&
      data !== null &&
      "byteLength" in data &&
      typeof data.byteLength === "number"
        ? data.byteLength
        : null;
    diagnostic.samples.push({
      isArrayBuffer,
      isArrayBufferView,
      tag: Object.prototype.toString.call(data),
      byteLength,
    });
  });
}

export function installNativeIceDiagnostics(): void {
  if (installed) return;
  const NativeRTCPeerConnection = window.RTCPeerConnection;
  if (typeof NativeRTCPeerConnection !== "function") {
    throw new Error("RTCPeerConnection is unavailable in this native WebView.");
  }

  class TrackedRTCPeerConnection extends NativeRTCPeerConnection {
    private readonly diagnosticRecord: (typeof connections)[number];

    constructor(configuration?: RTCConfiguration) {
      super(configuration);
      const record = {
        connection: this,
        candidateTypes: new Set<string>(),
        dataChannels: [],
      };
      this.diagnosticRecord = record;
      connections.push(record);
      this.addEventListener("icecandidate", ({ candidate }) => {
        if (candidate?.type) record.candidateTypes.add(candidate.type);
      });
      this.addEventListener("datachannel", ({ channel }) => trackDataChannel(record, channel));
    }

    createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
      const channel = super.createDataChannel(label, options);
      trackDataChannel(this.diagnosticRecord, channel);
      return channel;
    }
  }

  window.RTCPeerConnection = TrackedRTCPeerConnection;
  installed = true;
}

export function readNativeIceDiagnostics(): NativeIceDiagnostic[] {
  return connections.map(({ connection, candidateTypes, dataChannels }) => ({
    connectionState: connection.connectionState,
    iceConnectionState: connection.iceConnectionState,
    iceGatheringState: connection.iceGatheringState,
    candidateTypes: [...candidateTypes].sort(),
    dataChannels: dataChannels.map(({ channel, diagnostic }) => ({
      ...diagnostic,
      readyState: channel.readyState,
      samples: [...diagnostic.samples],
    })),
  }));
}
