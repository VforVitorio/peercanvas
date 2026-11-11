import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/ui-mock", import.meta.url)),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 1430, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./dist-ui-mock", import.meta.url)),
    emptyOutDir: true,
    target: "safari13",
  },
});
