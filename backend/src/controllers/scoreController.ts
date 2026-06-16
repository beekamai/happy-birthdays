import ScoreRepository from "../repositories/ScoreRepository";
import FriendRepository from "../repositories/FriendRepository";
import { verifyGameToken, consumeNonce } from "../utils/gameSession";
import { computeScore, validatePlay } from "../services/gameScoring";
import Logger from "../utils/Logger";

/* Behind a reverse proxy the real client IP is in X-Forwarded-For. Used only
   to tag rows (grouping / anti-abuse), never for scoring — scoring keys on the
   visitor id the client sends. */
function clientIp(headers: Record<string, string | undefined>): string {
    const xff = headers["x-forwarded-for"];
    if (xff) return xff.split(",")[0]!.trim();
    return headers["x-real-ip"] ?? "";
}

/**
 * POST /api/scores — record a game score for a visitor.
 * Body: { slug, visitorId, gameId, token, durationMs, meta }. The client sends
 * raw play metrics, never a score: the server validates the play, computes the
 * score itself, and returns it alongside authoritative aggregates (the visitor's
 * personal totals AND the page-wide global totals), so the client only ever
 * shows server numbers.
 */
export const postScore = async ({ body, headers, set }: any) => {
    const slug = body?.slug;
    try {
        const { visitorId, gameId, durationMs, meta, token } = body ?? {};

        if (!slug || !gameId) {
            set.status = 400;
            return { error: "slug and gameId are required" };
        }
        const friend = FriendRepository.findBySlug(slug);
        if (!friend) {
            set.status = 404;
            return { error: "Unknown friend" };
        }
        /* No scoring while the page is locked (outside the birthday window). */
        if (friend.access.state === "locked") {
            set.status = 403;
            return { error: "Page is locked" };
        }

        const vid = typeof visitorId === "string" ? visitorId : "";
        const numDuration = Number(durationMs) || 0;
        const metrics =
            meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};

        /* Anti-cheat: a valid one-time token from /games/start must match this
           submission. */
        const payload = verifyGameToken(token);
        if (
            !payload ||
            payload.slug !== slug ||
            payload.gameId !== gameId ||
            payload.visitorId !== vid
        ) {
            set.status = 403;
            return { error: "Invalid or missing game token" };
        }
        /* The play must be realistic: duration in-bounds, not longer than the
           wall-clock since the token was issued, metrics not absurd. */
        const elapsedMs = Date.now() - payload.iat;
        if (!validatePlay(gameId, numDuration, elapsedMs, metrics)) {
            set.status = 422;
            return { error: "Implausible play" };
        }
        /* Consume the one-time token only once the play is accepted. */
        if (!consumeNonce(payload.nonce)) {
            set.status = 409;
            return { error: "Token already used" };
        }

        /* Score is server-computed from the raw metrics, never trusted from the
           client. */
        const score = computeScore(gameId, numDuration, metrics);

        ScoreRepository.insertScore({
            slug,
            visitorId: vid,
            gameId,
            score,
            durationMs: numDuration,
            ip: clientIp(headers ?? {}),
        });

        set.status = 200;
        return {
            ok: true,
            score,
            gameBest: ScoreRepository.bestScore(slug, gameId, vid),
            personal: ScoreRepository.personalTotals(slug, vid),
            global: ScoreRepository.globalTotals(slug),
        };
    } catch (error) {
        Logger.error("ScoreController", `postScore error: ${error}`, { slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/**
 * GET /api/scores/:slug?visitorId=... — authoritative totals for the page.
 * Returns { personal, global }; personal is zeroed when no visitorId is given.
 */
export const getTotals = async ({ params, query, set }: any) => {
    try {
        const { slug } = params;
        const vid = typeof query?.visitorId === "string" ? query.visitorId : "";
        set.status = 200;
        return {
            personal: vid
                ? ScoreRepository.personalTotals(slug, vid)
                : { total: 0, games: [] },
            global: ScoreRepository.globalTotals(slug),
        };
    } catch (error) {
        Logger.error("ScoreController", `getTotals error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/**
 * GET /api/scores/:slug/:gameId — leaderboard for a single game, highest first.
 * Query: { limit? }. Returns { scores }.
 */
export const getScores = async ({ params, query, set }: any) => {
    try {
        const { slug, gameId } = params;
        const parsed = query?.limit ? parseInt(query.limit, 10) : NaN;
        const scores = Number.isFinite(parsed)
            ? ScoreRepository.topScores(slug, gameId, parsed)
            : ScoreRepository.topScores(slug, gameId);

        set.status = 200;
        return { scores };
    } catch (error) {
        Logger.error("ScoreController", `getScores error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};
