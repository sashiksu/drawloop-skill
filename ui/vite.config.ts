import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = process.env.DRAWLOOP_SERVER_PORT ?? "8787";

export default defineConfig({
  // Local server mounts the UI at "/"; the GitHub Pages demo serves it from
  // "/drawloop-skill/". The Pages workflow sets VITE_BASE="/drawloop-skill/" at build
  // time so asset URLs in index.html resolve correctly under the subpath.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: `http://localhost:${SERVER_PORT}`, changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
