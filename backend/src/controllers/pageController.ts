import fs from "node:fs";
import path from "node:path";

import { DIST_DIR } from "../config/constants";
import PageRenderService from "../services/pageRenderService";
import Logger from "../utils/Logger";

const HTML_TYPE = "text/html; charset=utf-8";

/**
 * GET /:slug — server-rendered friend page with injected OG meta + bootstrap
 * data. Slugs containing "." (asset-like) or starting with "_" (reserved) are
 * treated as not-found.
 */
export const serveFriendPage = async ({ params, set }: any) => {
    try {
        const slug: string = params.slug ?? "";

        if (slug.includes(".") || slug.startsWith("_")) {
            const nf = PageRenderService.renderNotFound();
            set.status = nf.status;
            set.headers["content-type"] = HTML_TYPE;
            return nf.html;
        }

        const result = PageRenderService.renderFriendPage(slug);
        set.status = result.status;
        set.headers["content-type"] = HTML_TYPE;
        return result.html;
    } catch (error) {
        Logger.error("PageController", `serveFriendPage error: ${error}`, { slug: params?.slug });
        const nf = PageRenderService.renderNotFound();
        set.status = nf.status;
        set.headers["content-type"] = HTML_TYPE;
        return nf.html;
    }
};

/**
 * GET /u/:slug — server-rendered personal profile with nick title + profile OG.
 * Unknown / asset-like slugs render the not-found page.
 */
export const serveProfilePage = async ({ params, set }: any) => {
    try {
        const slug: string = params.slug ?? "";
        if (slug.includes(".") || slug.startsWith("_")) {
            const nf = PageRenderService.renderNotFound();
            set.status = nf.status;
            set.headers["content-type"] = HTML_TYPE;
            return nf.html;
        }

        const result = PageRenderService.renderProfilePage(slug);
        set.status = result.status;
        set.headers["content-type"] = HTML_TYPE;
        return result.html;
    } catch (error) {
        Logger.error("PageController", `serveProfilePage error: ${error}`, { slug: params?.slug });
        const nf = PageRenderService.renderNotFound();
        set.status = nf.status;
        set.headers["content-type"] = HTML_TYPE;
        return nf.html;
    }
};

/** GET / — server-rendered landing page. */
export const serveLanding = async ({ set }: any) => {
    try {
        const result = PageRenderService.renderLanding();
        set.status = result.status;
        set.headers["content-type"] = HTML_TYPE;
        return result.html;
    } catch (error) {
        Logger.error("PageController", `serveLanding error: ${error}`);
        set.status = 500;
        set.headers["content-type"] = HTML_TYPE;
        return PageRenderService.renderNotFound().html;
    }
};

/** GET /favicon.ico — serve the built favicon, or 204 when absent. */
export const serveFavicon = async ({ set }: any) => {
    try {
        const file = path.join(DIST_DIR, "favicon.ico");
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            set.status = 200;
            return Bun.file(file);
        }
        set.status = 204;
        return null;
    } catch (error) {
        Logger.error("PageController", `serveFavicon error: ${error}`);
        set.status = 204;
        return null;
    }
};

/** GET /favicon.svg — the cozy ramen-bowl site icon (copied to dist by Vite). */
export const serveFaviconSvg = async ({ set }: any) => {
    try {
        const file = path.join(DIST_DIR, "favicon.svg");
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            set.status = 200;
            set.headers["content-type"] = "image/svg+xml";
            set.headers["cache-control"] = "public, max-age=86400";
            return Bun.file(file);
        }
        set.status = 404;
        return null;
    } catch (error) {
        Logger.error("PageController", `serveFaviconSvg error: ${error}`);
        set.status = 404;
        return null;
    }
};

/** GET /robots.txt — index public pages, keep admin/auth/API out of search. */
export const serveRobots = async ({ set }: any) => {
    set.status = 200;
    set.headers["content-type"] = "text/plain; charset=utf-8";
    return [
        "User-agent: *",
        "Allow: /",
        "Disallow: /account",
        "Disallow: /admin",
        "Disallow: /api/",
        "",
    ].join("\n");
};
