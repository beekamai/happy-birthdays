import FriendRepository from "../repositories/FriendRepository";
import Logger from "../utils/Logger";

/** GET /api/stats — public site stats: count of published birthday pages. */
export const getStats = async ({ set }: any) => {
    try {
        const pages = FriendRepository.listSlugs().length;
        set.status = 200;
        return { pages };
    } catch (error) {
        Logger.error("StatsController", `getStats error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};
