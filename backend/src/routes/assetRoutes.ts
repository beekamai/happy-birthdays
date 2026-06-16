import { Elysia } from "elysia";

import { getFriendAsset, getOwnerAsset, getGiftAsset } from "../controllers/assetController";
import { serveFavicon, serveFaviconSvg, serveRobots } from "../controllers/pageController";

/*
 * Static-ish asset routes served from disk via the repositories' guarded path
 * resolution. Concrete prefixes / two-segment params, so they win over the
 * single-segment "/:slug" page route in app.ts.
 */
const assetRoutes = new Elysia()
    .get("/friends/:slug/:file", getFriendAsset)
    .get("/owner/:file", getOwnerAsset)
    .get("/gifts/:file", getGiftAsset)
    .get("/favicon.ico", serveFavicon)
    .get("/favicon.svg", serveFaviconSvg)
    .get("/robots.txt", serveRobots);

export default assetRoutes;
