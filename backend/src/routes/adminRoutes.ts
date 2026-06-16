import { Elysia } from "elysia";

import {
    listFriends,
    getFriendConfig,
    updateFriend,
    createFriend,
    uploadAvatar,
    translate,
} from "../controllers/adminController";
import { buyItem, equipItem } from "../controllers/shopController";

/* Admin endpoints (mounted under /api/admin). Each controller checks the
   session + permission (owner vs the friend themselves). */
const adminRoutes = new Elysia()
    .get("/friends", listFriends)
    .post("/friends", createFriend)
    .get("/friend/:slug", getFriendConfig)
    .put("/friend/:slug", updateFriend)
    .post("/friend/:slug/avatar", uploadAvatar)
    .post("/translate", translate)
    .post("/shop/:slug/buy", buyItem)
    .post("/shop/:slug/equip", equipItem);

export default adminRoutes;
