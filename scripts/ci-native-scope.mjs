import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const NON_NATIVE_WORKFLOWS = [
  ".github/workflows/security.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/labeler.yml",
  ".github/workflows/release-please.yml",
];
const NON_NATIVE_SCRIPTS = [
  "scripts/setup-github.sh",
  "scripts/ci-native-scope.mjs",
  "scripts/ci-native-scope.test.mjs",
];

const isNonNativeChange = (file) =>
  file.startsWith("docs/") ||
  file.startsWith("openspec/") ||
  file.startsWith("tests/") ||
  file.startsWith("src/ui-mock/") ||
  file.startsWith(".github/ISSUE_TEMPLATE/") ||
  file.startsWith(".github/PULL_REQUEST_TEMPLATE/") ||
  NON_NATIVE_WORKFLOWS.includes(file) ||
  NON_NATIVE_SCRIPTS.includes(file) ||
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  /\.mdx?$/.test(file) ||
  ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES"].includes(file);

const isSmokePath = (file) =>
  file.startsWith("src-tauri/") ||
  file.startsWith("src/native-smoke/") ||
  file.startsWith("src/canvas/") ||
  [
    "scripts/native-smoke.mjs",
    "package.json",
    "package-lock.json",
    ".nvmrc",
    "rust-toolchain.toml",
    "vite.config.ts",
    ".github/workflows/ci.yml",
  ].includes(file);

export function classifyChangedFiles(files) {
  const normalized = files.map((file) => file.replaceAll("\\", "/"));
  // Unknown non-document paths stay native-sensitive so new build inputs get full checks by default.
  const nativeFiles = normalized.filter((file) => !isNonNativeChange(file));
  return { native: nativeFiles.length > 0, smoke: nativeFiles.some(isSmokePath) };
}

function changedFiles(eventName, event) {
  if (eventName === "pull_request") {
    const base = event.pull_request?.base?.sha;
    if (!base) throw new Error("Pull request base SHA is unavailable.");
    return execFileSync("git", ["diff", "--no-renames", "--name-only", `${base}...HEAD`], {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
  }

  if (eventName === "push") {
    const { before, after } = event;
    if (!before || !after || /^0+$/.test(before)) return null;
    return execFileSync("git", ["diff", "--no-renames", "--name-only", before, after], {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
  }

  return null;
}

function writeScope(scope) {
  const output = `native=${scope.native}\nsmoke=${scope.smoke}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
}

function main() {
  let scope;
  try {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventName || !eventPath) throw new Error("GitHub event context is unavailable.");
    const event = JSON.parse(readFileSync(eventPath, "utf8"));
    const files = changedFiles(eventName, event);
    scope = files === null ? { native: true, smoke: true } : classifyChangedFiles(files);
  } catch (error) {
    console.error(`Could not classify CI changes; running full native checks: ${error.message}`);
    scope = { native: true, smoke: true };
  }

  writeScope(scope);
  console.log(`Native checks: ${scope.native}; compatibility smoke: ${scope.smoke}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
