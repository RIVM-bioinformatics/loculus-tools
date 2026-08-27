import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the MSA engine test harness.
// The WASM pkg is built by `wasm-pack` into ./wasm and treated as a local
// dependency (no optimizeDeps interception needed — it ships ESM).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // COOP/COEP headers enable SharedArrayBuffer if we later want it; harmless
    // otherwise and keeps the door open for zero-copy SAB-based viewports.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es",
  },
});
