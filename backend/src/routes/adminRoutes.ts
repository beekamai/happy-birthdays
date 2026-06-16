import { Elysia } from "elysia";

import {
    listFriends,
    myPages,
    getFriendConfig,
    updateFriend,
    createFriend,
    deleteFriend,
    uploadAvatar,
    translate,
    getPageOrder,
    savePageOrder,
} from "../controllers/adminController";
import { buyItem, equipItem, refundItem } from "../controllers/shopController";

/* Admin endpoints (mounted under /api/admin). Each controller checks the
   session + permission (owner vs the friend themselves). */
const adminRoutes = new Elysia()
    .get("/friends", listFriends)
    .get("/mine", myPages)
    .post("/friends", createFriend)
    .get("/order", getPageOrder)
    .put("/order", savePageOrder)
    .get("/friend/:slug", getFriendConfig)
    .put("/friend/:slug", updateFriend)
    .delete("/friend/:slug", deleteFriend)
    .post("/friend/:slug/avatar", uploadAvatar)
    .post("/translate", translate)
    .post("/shop/:slug/buy", buyItem)
    .post("/shop/:slug/equip", equipItem)
    .post("/shop/:slug/refund", refundItem);

export default adminRoutes;
