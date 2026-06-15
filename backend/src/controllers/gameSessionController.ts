import FriendRepository from "../repositories/FriendRepository";
import { signGameToken } from "../utils/gameSession";
import Logger from "../utils/Logger";

/**
 * POST /api/games/start — begin a play and get a one-time score token.
 * Body: { slug, gameId, visitorId }. The returned token must accompany the
 * score submitted to POST /api/scores.
 */
export const startGame = async ({ body, set }: any) => {
    const slug = body?.slug;
    try {
        const { gameId, visitorId } = body ?? {};
        if (!slug || !gameId) {
            set.status = 400;
            return { error: "slug and gameId are required" };
        }
        const friend = FriendRepository.findBySlug(slug);
        if (!friend) {
            set.status = 404;
            return { error: "Unknown friend" };
        }
        if (friend.access.state === "locked" || !friend.gamesEnabled) {
            set.status = 403;
            return { error: "Games are not available" };
        }
        if (!friend.games.some((g) => g.gameId === gameId)) {
            set.status = 400;
            return { error: "Unknown game for this page" };
        }

        const vid = typeof visitorId === "string" ? visitorId : "";
        set.status = 200;
        return { token: signGameToken(slug, gameId, vid) };
    } catch (error) {
        Logger.error("GameSessionController", `startGame error: ${error}`, { slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};
