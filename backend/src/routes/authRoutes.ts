import { Elysia } from "elysia";

import { telegramLogin, me, logout, authConfig } from "../controllers/authController";

/* Auth endpoints (mounted under /api/auth). Responses are dynamic (depend on the
   session), so no withResponseFilter here. */
const authRoutes = new Elysia()
    .post("/telegram", telegramLogin)
    .get("/me", me)
    .post("/logout", logout)
    .get("/config", authConfig);

export default authRoutes;
