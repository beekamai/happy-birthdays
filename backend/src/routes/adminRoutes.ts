import { Elysia } from "elysia";

import { authDerive, authMiddleware, ownerMiddleware } from "../middlewares/authMiddleware";
import {
    listFriends,
    myPages,
    getFriendConfig,
    updateFriend,
    createFriend,
    deleteFriend,
    uploadAvatar,
    uploadGiftAnimation,
    translate,
    getPageOrder,
    savePageOrder,
} from "../controllers/adminController";

/* Admin endpoints (mounted under /api/admin). Auth is declared HERE, not in the
   controllers: authDerive puts the session user in context, then the guard blocks
   gate by session (authMiddleware → 401) or ownership (ownerMiddleware → 403).
   The first block is owner-only administration; the second only needs a session,
   with the per-resource owner-or-that-friend rule (canEdit) staying in the
   controller since it depends on the target page's config. */
const adminRoutes = new Elysia()
    .derive(authDerive)
    .guard({ beforeHandle: [authMiddleware, ownerMiddleware] }, (app) =>
        app
            .get("/friends", listFriends)
            .post("/friends", createFriend)
            .delete("/friend/:slug", deleteFriend)
            /* The gift is owner-given content (excluded from FRIEND_EDITABLE and
               hidden from the friend's editor), so its animation upload is
               owner-only — a friend may change their own avatar, not the gift. */
            .post("/friend/:slug/gift-animation", uploadGiftAnimation)
            .get("/order", getPageOrder)
            .put("/order", savePageOrder),
    )
    .guard({ beforeHandle: [authMiddleware] }, (app) =>
        app
            .get("/mine", myPages)
            .get("/friend/:slug", getFriendConfig)
            .put("/friend/:slug", updateFriend)
            .post("/friend/:slug/avatar", uploadAvatar)
            .post("/translate", translate),
    );

export default adminRoutes;
