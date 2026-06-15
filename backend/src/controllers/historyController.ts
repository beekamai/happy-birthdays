import HistoryRepository from "../repositories/HistoryRepository";
import Logger from "../utils/Logger";

/**
 * GET /api/history/:slug — gift history + profile change log for a friend.
 */
export const getHistory = async ({ params, set }: any) => {
    try {
        const { slug } = params;
        set.status = 200;
        return {
            gifts: HistoryRepository.listGifts(slug),
            changes: HistoryRepository.listChanges(slug),
        };
    } catch (error) {
        Logger.error("HistoryController", `getHistory error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};
