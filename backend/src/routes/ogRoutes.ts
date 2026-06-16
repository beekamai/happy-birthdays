import { Elysia } from "elysia";

import { getOgImage, getProfileOgImage } from "../controllers/ogController";

/* Generated Open Graph images. Binary responses — no response filter. The more
   specific /og/u/:file (profile cards) is registered before the catch-all. */
const ogRoutes = new Elysia()
    .get("/og/u/:file", getProfileOgImage)
    .get("/og/:file", getOgImage);

export default ogRoutes;
