import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/* Vite билдит фронт прямо в backend/dist — прод обслуживается одним процессом Elysia.
   Dev-proxy уводит серверные пути (/api,/og,/friends,/owner) на бэк :3000. */
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
