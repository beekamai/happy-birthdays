import { Elysia } from "elysia";

import {
    getCatalog,
    getShopState,
    buyItem,
    equipItem,
    refundItem,
} from "../controllers/shopController";

/* Shop endpoints (mounted under /api/shop). Reads (catalogue, wallet/state) are
   public; writes (buy/equip/refund) are auth-gated INSIDE the controller
   (readUser + canEdit — the page owner or the friend themselves), so they live
   here under /api/shop rather than under /api/admin (these are friend-facing
   actions, not owner-only administration). */
const shopRoutes = new Elysia()
    .get("/catalog", getCatalog)
    .get("/:slug", getShopState)
    .post("/:slug/buy", buyItem)
    .post("/:slug/equip", equipItem)
    .post("/:slug/refund", refundItem);

export default shopRoutes;
