import OgImageService from "../services/ogImageService";
import Logger from "../utils/Logger";

/* One immutable year — generated images are content-hashed via `?v=`. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * GET /og/:file — serve a friend's generated Open Graph PNG. `file` must end in
 * ".png"; the slug is the stem. Returns a 404 JSON body on miss, never 500.
 */
export const getOgImage = async ({ params, set }: any) => {
    try {
        const file: string = params.file ?? "";
        if (!file.toLowerCase().endsWith(".png")) {
            set.status = 404;
            return { error: "Not found" };
        }

        const slug = file.slice(0, -".png".length);
        const result = await OgImageService.renderOgPng(slug);
        if (!result) {
            set.status = 404;
            return { error: "Not found" };
        }

        set.headers["content-type"] = "image/png";
        set.headers["cache-control"] = CACHE_CONTROL;
        set.headers["etag"] = `"${result.hash}"`;
        set.status = 200;
        return new Response(result.png as unknown as Uint8Array, {
            headers: {
                "content-type": "image/png",
                "cache-control": CACHE_CONTROL,
                etag: `"${result.hash}"`,
            },
        });
    } catch (error) {
        Logger.error("OgController", `getOgImage error: ${error}`);
        set.status = 404;
        return { error: "Not found" };
    }
};

/**
 * GET /og/u/:file — serve a friend's personal-profile OG PNG (avatar + name +
 * bio). `file` must end in ".png"; the slug is the stem.
 */
export const getProfileOgImage = async ({ params, set }: any) => {
    try {
        const file: string = params.file ?? "";
        if (!file.toLowerCase().endsWith(".png")) {
            set.status = 404;
            return { error: "Not found" };
        }

        const slug = file.slice(0, -".png".length);
        const result = await OgImageService.renderProfileOgPng(slug);
        if (!result) {
            set.status = 404;
            return { error: "Not found" };
        }

        set.status = 200;
        return new Response(result.png as unknown as Uint8Array, {
            headers: {
                "content-type": "image/png",
                "cache-control": CACHE_CONTROL,
                etag: `"${result.hash}"`,
            },
        });
    } catch (error) {
        Logger.error("OgController", `getProfileOgImage error: ${error}`);
        set.status = 404;
        return { error: "Not found" };
    }
};
