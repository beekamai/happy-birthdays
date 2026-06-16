import { Elysia } from "elysia";

import { getCatalog, getShopState } from "../controllers/shopController";

/* Public shop endpoints (mounted under /api/shop): the catalogue and a friend's
   wallet/owned/equipped state. Buying + equipping live under /api/admin/shop
   (auth-gated) in adminRoutes. */
const shopRoutes = new Elysia()
    .get("/catalog", getCatalog)
    .get("/:slug", getShopState);

export default shopRoutes;
