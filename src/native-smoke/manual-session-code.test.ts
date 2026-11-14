import { describe, expect, it } from "vitest";
import {
  encodeManualSessionCode,
  INVALID_MANUAL_SESSION_CODE,
  parseManualSessionCode,
  type ManualSessionCode,
} from "./manual-session-code";

const descriptor: ManualSessionCode = {
  version: 1,
  roomId: "a".repeat(32),
  password: "b".repeat(64),
  hostPeerId: "test-host",
};

describe("manual test session code", () => {
  it("round-trips the bounded versioned descriptor", () => {
    expect(parseManualSessionCode(encodeManualSessionCode(descriptor))).toEqual({
      ok: true,
      value: descriptor,
    });
    expect(
      parseManualSessionCode(JSON.stringify({ ...descriptor, hostPeerId: "x".repeat(128) })).ok,
    ).toBe(true);
  });

  it.each([
    "",
    "not-json",
    "null",
    "[]",
    "1",
    "{}",
    JSON.stringify({ ...descriptor, version: 2 }),
    JSON.stringify({ ...descriptor, extra: true }),
    JSON.stringify({ ...descriptor, roomId: undefined }),
    JSON.stringify({ ...descriptor, roomId: "A".repeat(32) }),
    JSON.stringify({ ...descriptor, roomId: "a".repeat(31) }),
    JSON.stringify({ ...descriptor, password: "b".repeat(63) }),
    JSON.stringify({ ...descriptor, password: "g".repeat(64) }),
    JSON.stringify({ ...descriptor, hostPeerId: "" }),
    JSON.stringify({ ...descriptor, hostPeerId: "  " }),
    JSON.stringify({ ...descriptor, hostPeerId: "x".repeat(129) }),
    JSON.stringify({ ...descriptor, hostPeerId: "host\nprivate" }),
    JSON.stringify({ ...descriptor, hostPeerId: "host\u007fprivate" }),
    JSON.stringify({ ...descriptor, hostPeerId: "host\u0085private" }),
    JSON.stringify({ ...descriptor, hostPeerId: 123 }),
    " ".repeat(1025),
    "界".repeat(350),
  ])("rejects invalid input without echoing secrets (case %#)", (input) => {
    expect(parseManualSessionCode(input)).toEqual({
      ok: false,
      error: INVALID_MANUAL_SESSION_CODE,
    });
  });

  it("accepts exactly 1024 bytes, rejects the next byte, and redacts encoder errors", () => {
    const code = encodeManualSessionCode(descriptor);
    const bounded = code + " ".repeat(1024 - new TextEncoder().encode(code).byteLength);
    expect(parseManualSessionCode(bounded).ok).toBe(true);
    expect(parseManualSessionCode(bounded + " ")).toEqual({
      ok: false,
      error: INVALID_MANUAL_SESSION_CODE,
    });
    expect(() => encodeManualSessionCode({ ...descriptor, password: "PRIVATE-INPUT" })).toThrow(
      new Error(INVALID_MANUAL_SESSION_CODE),
    );
    const hostile = {
      ...descriptor,
      toJSON() {
        throw new Error("PRIVATE-INPUT");
      },
    };
    expect(() => encodeManualSessionCode(hostile)).toThrow(new Error(INVALID_MANUAL_SESSION_CODE));
  });
});
