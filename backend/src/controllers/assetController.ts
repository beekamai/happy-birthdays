import path from "node:path";

import FriendRepository from "../repositories/FriendRepository";
import { DIST_DIR } from "../config/constants";
import { assertInside } from "../utils/paths";
import Logger from "../utils/Logger";

/* Avatars are content-addressed by filename and effectively immutable. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** GET /friends/:slug/:file — serve a friend asset (avatar / gift image). */
export const getFriendAsset = async ({ params, set }: any) => {
    try {
        const resolved = FriendRepository.getAvatarPath(params.slug, params.file);
        if (!resolved) {
            set.status = 404;
            return { error: "Not found" };
        }

        set.status = 200;
        set.headers["cache-control"] = CACHE_CONTROL;
        return Bun.file(resolved);
    } catch (error) {
        Logger.error("AssetController", `getFriendAsset error: ${error}`, {
            slug: params?.slug,
            file: params?.file,
        });
        set.status = 404;
        return { error: "Not found" };
    }
};

/** GET /gifts/:file — serve a bundled gift asset (Lottie JSON) from dist/gifts. */
export const getGiftAsset = async ({ params, set }: any) => {
    try {
        const giftsDir = path.join(DIST_DIR, "gifts");
        const resolved = assertInside(giftsDir, params.file);
        const file = Bun.file(resolved);
        if (!(await file.exists())) {
            set.status = 404;
            return { error: "Not found" };
        }

        set.status = 200;
        set.headers["cache-control"] = CACHE_CONTROL;
        return file;
    } catch (error) {
        Logger.error("AssetController", `getGiftAsset error: ${error}`, { file: params?.file });
        set.status = 404;
        return { error: "Not found" };
    }
};

/** GET /owner/:file — serve an owner asset (avatar). */
export const getOwnerAsset = async ({ params, set }: any) => {
    try {
        const resolved = FriendRepository.getOwnerAvatarPath(params.file);
        if (!resolved) {
            set.status = 404;
            return { error: "Not found" };
        }

        set.status = 200;
        set.headers["cache-control"] = CACHE_CONTROL;
        return Bun.file(resolved);
    } catch (error) {
        Logger.error("AssetController", `getOwnerAsset error: ${error}`, { file: params?.file });
        set.status = 404;
        return { error: "Not found" };
    }
};
