import FriendRepository from "../repositories/FriendRepository";
import Logger from "../utils/Logger";

/** GET /api/friend/:slug — public friend payload, 404 when unknown. */
export const getFriend = async ({ params, set }: any) => {
    try {
        const friend = FriendRepository.findBySlug(params.slug);
        if (!friend) {
            set.status = 404;
            return { error: "Friend not found" };
        }

        set.status = 200;
        return friend;
    } catch (error) {
        Logger.error("FriendController", `getFriend error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};
