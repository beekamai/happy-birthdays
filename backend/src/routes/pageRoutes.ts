import { Elysia } from "elysia";

import { serveFriendPage, serveProfilePage, serveLanding } from "../controllers/pageController";

/*
 * Server-rendered HTML pages. Registered LAST in app.ts so concrete asset /
 * api / og routes match first; "/:slug" is the catch-all single segment.
 */
const pageRoutes = new Elysia()
    .get("/", serveLanding)
    /* /account (and the legacy /admin alias) is the personal cabinet SPA —
       serve the shell (200), not a 404 page. */
    .get("/account", serveLanding)
    .get("/admin", serveLanding)
    /* /about is the public "about this project" SPA page — serve the shell;
       the page pulls its data (stats) client-side. */
    .get("/about", serveLanding)
    /* /u/<slug> is the personal profile — nick title + profile OG injection. */
    .get("/u/:slug", serveProfilePage)
    .get("/:slug", serveFriendPage);

export default pageRoutes;
