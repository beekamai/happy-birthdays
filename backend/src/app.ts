import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";

import { DIST_DIR } from "./config/constants";
import { ErrorHandler } from "./handlers/errorHandler";

import apiRoutes from "./routes/apiRoutes";
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
    .group("/api", (group) => group.use(apiRoutes))
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
