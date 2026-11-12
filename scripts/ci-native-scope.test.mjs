import { describe, expect, it } from "vitest";
import { classifyChangedFiles } from "./ci-native-scope.mjs";

describe("native CI change scope", () => {
  it("skips native builds for documentation, test-only, and history-only changes", () => {
    expect(
      classifyChangedFiles([
        "docs/handoff/START_HERE.md",
        "openspec/changes/change/tasks.md",
        "src/shapes/manifest.test.ts",
        "tests/ci-native-scope.test.mjs",
        "src/ui-mock/ui/App.tsx",
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/workflows/security.yml",
        "scripts/setup-github.sh",
        "scripts/ci-native-scope.mjs",
      ]),
    ).toEqual({ native: false, smoke: false });
    expect(classifyChangedFiles([])).toEqual({ native: false, smoke: false });
  });

  it("keeps native builds for application source without running the S0 probe", () => {
    expect(classifyChangedFiles(["src/shapes/manifest.ts", "src/editor/App.tsx"])).toEqual({
      native: true,
      smoke: false,
    });
  });

  it("defaults unknown non-document files to native validation", () => {
    expect(classifyChangedFiles(["build.rs"])).toEqual({ native: true, smoke: false });
  });

  it("keeps native validation when a native file is moved into documentation", () => {
    expect(classifyChangedFiles(["docs/build.rs", "src-tauri/build.rs"])).toEqual({
      native: true,
      smoke: true,
    });
  });

  it("skips native builds for security, release, and repository-maintenance workflows", () => {
    expect(
      classifyChangedFiles([
        ".github/workflows/security.yml",
        ".github/workflows/release-please.yml",
        "scripts/setup-github.sh",
      ]),
    ).toEqual({ native: false, smoke: false });
  });

  it("runs the native probe for changes to its Tauri, canvas, or harness dependencies", () => {
    for (const path of [
      "src-tauri/src/lib.rs",
      "src/native-smoke/NativeSmokeCanvas.tsx",
      "src/canvas/WeaveCanvas.tsx",
      "scripts/native-smoke.mjs",
      "package-lock.json",
      ".github/workflows/ci.yml",
    ]) {
      expect(classifyChangedFiles([path])).toEqual({ native: true, smoke: true });
    }
  });
});
