import { Elysia } from "elysia";

import { rateLimit } from "../middlewares/rateLimit";
import {
    getGames,
    getCasinoState,
    placeBet,
    claimBonus,
    donatePoints,
} from "../controllers/casinoController";

/* Casino endpoints (mounted under /api/casino). Like /api/scores these are
   anonymous and keyed by the client's `visitorId`, so there is no auth guard —
   a caller can only move points that visitor earned. `/games` is concrete and
   MUST stay above the `/:slug` parameter route, which would otherwise swallow
   it (same rule as app.ts, one level down).

   Writes are rate-limited per IP: a real player needs a second or two between
   spins, and donating is a once-in-a-while gesture. */
const casinoRoutes = new Elysia()
    .get("/games", getGames)
    .get("/:slug", getCasinoState)
    .guard(
        { beforeHandle: [rateLimit({ tag: "casino-bet", limit: 90, windowMs: 60_000 })] },
        (app) => app.post("/:slug/bet", placeBet),
    )
    .guard(
        { beforeHandle: [rateLimit({ tag: "casino-gift", limit: 20, windowMs: 60_000 })] },
        (app) =>
            app.post("/:slug/bonus", claimBonus).post("/:slug/donate", donatePoints),
    );

export default casinoRoutes;
