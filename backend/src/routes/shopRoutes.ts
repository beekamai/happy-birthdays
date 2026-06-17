import { Elysia } from "elysia";

import { authDerive, authMiddleware } from "../middlewares/authMiddleware";
import {
    getCatalog,
    getShopState,
    buyItem,
    equipItem,
    refundItem,
} from "../controllers/shopController";

/* Shop endpoints (mounted under /api/shop). Reads (catalogue, wallet/state) are
   public; writes (buy/equip/refund) require a session — the guard short-circuits
   401 before the handler. Who-can-edit-which-page (owner or the friend) is a
   per-resource rule, so canEdit stays inside the controllers. */
const shopRoutes = new Elysia()
    .derive(authDerive)
    .get("/catalog", getCatalog)
    .get("/:slug", getShopState)
    .guard({ beforeHandle: [authMiddleware] }, (app) =>
        app
            .post("/:slug/buy", buyItem)
            .post("/:slug/equip", equipItem)
            .post("/:slug/refund", refundItem),
    );

export default shopRoutes;
