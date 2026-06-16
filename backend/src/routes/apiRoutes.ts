import { Elysia } from "elysia";

import { withResponseFilter } from "../handlers/responseFilter";
import { getFriend } from "../controllers/friendController";
import { getSite } from "../controllers/siteController";
import { postScore, getTotals, getScores } from "../controllers/scoreController";
import { startGame } from "../controllers/gameSessionController";
import { getBirthdays } from "../controllers/birthdayController";
import { getHistory } from "../controllers/historyController";
import { getStats } from "../controllers/statsController";
import {
    getFriend_Request_Schema,
    getSite_Request_Schema,
    postScore_Request_Schema,
    startGame_Request_Schema,
    getTotals_Request_Schema,
    getScores_Request_Schema,
    getBirthdays_Request_Schema,
    getHistory_Request_Schema,
} from "../schemas/friend.schema";

/*
 * JSON API. Mounted under "/api" in app.ts, so paths here are relative:
 *   GET  /friend/:slug
 *   GET  /site
 *   POST /scores                (body: { slug, gameId, score, durationMs })
 *   GET  /scores/:slug          (authoritative totals)
 *   GET  /scores/:slug/:gameId  (leaderboard)
 */
const apiRoutes = new Elysia()
    .get("/friend/:slug", getFriend, withResponseFilter(getFriend_Request_Schema))
    .get("/site", getSite, withResponseFilter(getSite_Request_Schema))
    .get("/stats", getStats)
    .get("/birthdays", getBirthdays, withResponseFilter(getBirthdays_Request_Schema))
    .get("/history/:slug", getHistory, withResponseFilter(getHistory_Request_Schema))
    .post("/games/start", startGame, withResponseFilter(startGame_Request_Schema))
    .post("/scores", postScore, withResponseFilter(postScore_Request_Schema))
    .get("/scores/:slug", getTotals, withResponseFilter(getTotals_Request_Schema))
    .get(
        "/scores/:slug/:gameId",
        getScores,
        withResponseFilter(getScores_Request_Schema),
    );

export default apiRoutes;
