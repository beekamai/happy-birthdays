import { Elysia } from "elysia";

import {
    listFriends,
    getFriendConfig,
    updateFriend,
    createFriend,
    uploadAvatar,
} from "../controllers/adminController";

/* Admin endpoints (mounted under /api/admin). Each controller checks the
   session + permission (owner vs the friend themselves). */
const adminRoutes = new Elysia()
    .get("/friends", listFriends)
    .post("/friends", createFriend)
    .get("/friend/:slug", getFriendConfig)
    .put("/friend/:slug", updateFriend)
    .post("/friend/:slug/avatar", uploadAvatar);

export default adminRoutes;
