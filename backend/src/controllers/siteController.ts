import FriendRepository from "../repositories/FriendRepository";
import Logger from "../utils/Logger";

/** GET /api/site — site-level public config, 404 when site.json is absent. */
export const getSite = async ({ set }: any) => {
    try {
        const site = FriendRepository.getSite();
        if (!site) {
            set.status = 404;
            return { error: "Site config not found" };
        }

        set.status = 200;
        return site;
    } catch (error) {
        Logger.error("SiteController", `getSite error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};
