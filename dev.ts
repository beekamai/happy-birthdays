/* Параллельный dev-раннер: backend (Elysia :3000) + frontend (Vite :5173).
   Bun.spawn вместо concurrently — без лишней зависимости. */

const spawnOpts = {
    stdio: ["inherit", "inherit", "inherit"] as const,
};

const procs = [
    Bun.spawn(["bun", "run", "dev"], {
        cwd: "backend",
        env: { ...process.env, NODE_ENV: "development" },
        ...spawnOpts,
    }),
    Bun.spawn(["bun", "run", "dev"], {
        cwd: "frontend",
        env: { ...process.env, NODE_ENV: "development" },
        ...spawnOpts,
    }),
];

const shutdown = () => {
    for (const p of procs) {
        try {
            p.kill();
        } catch {
            /* already gone */
        }
    }
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.all(procs.map((p) => p.exited));
