import { env } from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  root: mode === "native-smoke" ? "src/native-smoke" : undefined,
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: mode === "native-smoke" ? "../../dist" : "dist",
    emptyOutDir: true,
    target: env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !env.TAURI_ENV_DEBUG,
    sourcemap: Boolean(env.TAURI_ENV_DEBUG),
  },
  test: {
    environment: "jsdom",
  },
}));
