import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/* Vite builds straight into backend/dist — production is served by the single
   Elysia process. The dev proxy forwards server-owned paths (/api, /og, /friends,
   /owner) to the backend on :3000. */
export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        outDir: path.resolve(import.meta.dirname, "../backend/dist"),
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        proxy: {
            "/api": { target: "http://localhost:3000", changeOrigin: true },
            "/og": { target: "http://localhost:3000", changeOrigin: true },
            "/friends": { target: "http://localhost:3000", changeOrigin: true },
            "/owner": { target: "http://localhost:3000", changeOrigin: true },
        },
    },
});
