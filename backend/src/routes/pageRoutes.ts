import { Elysia } from "elysia";

import { serveFriendPage, serveLanding } from "../controllers/pageController";

/*
 * Server-rendered HTML pages. Registered LAST in app.ts so concrete asset /
 * api / og routes match first; "/:slug" is the catch-all single segment.
 */
const pageRoutes = new Elysia()
    .get("/", serveLanding)
    .get("/:slug", serveFriendPage);

export default pageRoutes;
