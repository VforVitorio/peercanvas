import { describe, expect, it } from "vitest";
import { isNativeMessage } from "./contracts";

describe("native message contract", () => {
  it("accepts only stable codes and string or finite-number parameters", () => {
    expect(isNativeMessage({ code: "document.sizeLimit", params: { limit: 10 } })).toBe(true);
    expect(isNativeMessage({ code: "", params: {} })).toBe(false);
    expect(isNativeMessage({ code: "failure", params: { secret: false } })).toBe(false);
    expect(isNativeMessage({ code: "failure", params: { count: Number.NaN } })).toBe(false);
    expect(isNativeMessage({ code: "failure", params: [] })).toBe(false);
  });
});
