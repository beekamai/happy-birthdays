import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { jwt } from "@elysiajs/jwt";

import { DIST_DIR, SESSION_SECRET } from "./config/constants";
import { ErrorHandler } from "./handlers/errorHandler";

import apiRoutes from "./routes/apiRoutes";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import shopRoutes from "./routes/shopRoutes";
import ogRoutes from "./routes/ogRoutes";
import assetRoutes from "./routes/assetRoutes";
import pageRoutes from "./routes/pageRoutes";

/*
 * Route registration order is CRITICAL — Elysia resolves the first match:
 *   1. /api/*        — JSON API (concrete prefix)
 *   2. /og/:file     — generated OG images
 *   3. /friends, /owner, /favicon, /robots — disk assets (concrete / 2-seg)
 *   4. /assets/*     — built frontend bundle (static plugin, NO index.html)
 *   5. /:slug and /  — server-rendered pages LAST (catch-all single segment)
 */
const app = new Elysia()
    .onError(ErrorHandler)
    .use(jwt({ name: "jwt", secret: SESSION_SECRET }))
    .group("/api", (group) =>
        group
            .use(apiRoutes)
            .group("/auth", (g) => g.use(authRoutes))
            .group("/admin", (g) => g.use(adminRoutes))
            .group("/shop", (g) => g.use(shopRoutes)),
    )
    .use(ogRoutes)
    .use(assetRoutes)
    .use(
        await staticPlugin({
            assets: `${DIST_DIR}/assets`,
            prefix: "/assets",
            indexHTML: false,
        }),
    )
    .use(pageRoutes);

export default app;
