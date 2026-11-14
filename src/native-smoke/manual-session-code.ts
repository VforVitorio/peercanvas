// SPDX-License-Identifier: Apache-2.0
// Test-only bearer descriptor; this is not the WP-08 invitation protocol.

export type ManualSessionCode = {
  version: 1;
  roomId: string;
  password: string;
  hostPeerId: string;
};

export const INVALID_MANUAL_SESSION_CODE = "Invalid test session code.";

export function parseManualSessionCode(
  input: string,
): { ok: true; value: ManualSessionCode } | { ok: false; error: string } {
  const invalid = { ok: false, error: INVALID_MANUAL_SESSION_CODE } as const;
  if (input.length > 1024 || new TextEncoder().encode(input).byteLength > 1024) return invalid;
  try {
    const value: unknown = JSON.parse(input);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 4 ||
      !["version", "roomId", "password", "hostPeerId"].every((key) =>
        Object.prototype.hasOwnProperty.call(record, key),
      ) ||
      record.version !== 1 ||
      typeof record.roomId !== "string" ||
      !/^[a-f0-9]{32}$/.test(record.roomId) ||
      typeof record.password !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.password) ||
      typeof record.hostPeerId !== "string" ||
      record.hostPeerId.trim().length === 0 ||
      record.hostPeerId.length > 128 ||
      Array.from(record.hostPeerId).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || (code >= 127 && code <= 159);
      })
    )
      return invalid;
    return { ok: true, value: record as ManualSessionCode };
  } catch {
    return invalid;
  }
}

export function encodeManualSessionCode(value: ManualSessionCode): string {
  try {
    const code = JSON.stringify(value);
    if (parseManualSessionCode(code).ok) return code;
  } catch {
    // Encoder failures must not expose input through custom serialization errors.
  }
  throw new Error(INVALID_MANUAL_SESSION_CODE);
}
