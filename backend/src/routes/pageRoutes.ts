import { Elysia } from "elysia";

import { serveFriendPage, serveLanding } from "../controllers/pageController";

/*
 * Server-rendered HTML pages. Registered LAST in app.ts so concrete asset /
 * api / og routes match first; "/:slug" is the catch-all single segment.
 */
const pageRoutes = new Elysia()
    .get("/", serveLanding)
    /* /admin is the SPA admin app — serve the shell (200), not a 404 page. */
    .get("/admin", serveLanding)
    /* /u/<slug> is the personal profile (SPA shell; data fetched client-side). */
    .get("/u/:slug", serveLanding)
    .get("/:slug", serveFriendPage);

export default pageRoutes;
