import { Elysia } from "elysia";

import { getOgImage } from "../controllers/ogController";

/* Generated Open Graph images. Binary responses — no response filter. */
const ogRoutes = new Elysia().get("/og/:file", getOgImage);

export default ogRoutes;
