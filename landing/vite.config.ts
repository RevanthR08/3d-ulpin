// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The VERTICA portal (React SPA) + data API are served by the FastAPI app on :8000
// (portal at /portal/*, everything below is a REST endpoint or a standalone viewer).
// Proxy them so this dev server is the single origin: open http://localhost:3000/ only.
const API = "http://127.0.0.1:8000";
const toApi = ["/portal", "/society", "/building", "/unit", "/units", "/underground",
  "/site-plan", "/geo-site-plan", "/footprints", "/ulpin", "/ingest", "/processing-status",
  "/blender-export", "/viewer3d", "/viewer-map", "/viewer", "/extract"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: Object.fromEntries(
        toApi.map((path) => [path, { target: API, changeOrigin: true }]),
      ),
    },
  },
});
