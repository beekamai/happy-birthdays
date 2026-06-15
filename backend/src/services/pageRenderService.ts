import fs from "node:fs";
import path from "node:path";

import { DIST_DIR, BASE_URL } from "../config/constants";
import type { PublicFriend, SiteConfig } from "../models/Friend";
import FriendRepository from "../repositories/FriendRepository";
import OgImageService from "./ogImageService";
import Logger from "../utils/Logger";

interface RenderResult {
    html: string;
    status: number;
}

/* Minimal valid HTML shell used when dist/index.html is unavailable. */
const FALLBACK_SHELL = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Happy Birthdays</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- frontend bundle not built; backend is serving OG + API only -->
  </body>
</html>`;

/* Line/paragraph separators that are valid JSON but break inline <script>. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Server-side HTML rendering: loads the built SPA shell once, then injects
 * per-friend Open Graph meta tags and a bootstrap data script before serving.
 * Degrades gracefully to a minimal shell when the frontend bundle is absent,
 * so the backend can still boot and serve OG images / the API.
 */
export default class PageRenderService {
    private static shell = FALLBACK_SHELL;
    private static htmlAvailable = false;

    /** Load dist/index.html into memory. Safe to call once at startup. */
    static async init(): Promise<void> {
        try {
            const indexPath = path.join(DIST_DIR, "index.html");
            if (fs.existsSync(indexPath)) {
                this.shell = fs.readFileSync(indexPath, "utf-8");
                this.htmlAvailable = true;
            } else {
                this.htmlAvailable = false;
                Logger.warn(
                    "PageRenderService",
                    "dist/index.html not found — serving fallback shell",
                    { indexPath },
                );
            }
        } catch (error) {
            this.htmlAvailable = false;
            Logger.warn("PageRenderService", `init failed: ${error}`);
        }
    }

    /** Whether the real frontend bundle was loaded (vs. the fallback shell). */
    static isHtmlAvailable(): boolean {
        return this.htmlAvailable;
    }

    /* ----------------------------------------------------------------- */
    /* Public render entry points                                         */
    /* ----------------------------------------------------------------- */

    /** Render a friend's page, or the not-found page when the slug is unknown. */
    static renderFriendPage(slug: string): RenderResult {
        try {
            const friend = FriendRepository.findBySlug(slug);
            if (!friend) return this.renderNotFound();

            const site = this.resolveSite();
            const hash = OgImageService.ogHash(slug);

            let html = this.shell;
            html = this.injectData(html, friend, site);
            html = this.injectHead(html, this.buildOgMeta(friend, site, hash));
            html = this.setTitle(html, `С днём рождения, ${friend.displayName}! 🎂`);

            return { html, status: 200 };
        } catch (error) {
            Logger.error("PageRenderService", `renderFriendPage failed: ${error}`, { slug });
            return this.renderNotFound();
        }
    }

    /** Render the generic 404 page (no friend data injected). */
    static renderNotFound(): RenderResult {
        const meta = [
            `<meta property="og:type" content="website" />`,
            `<meta property="og:title" content="Поздравление не найдено" />`,
            `<meta property="og:description" content="Такой страницы нет — но день рождения всё равно где-то рядом." />`,
            `<meta name="twitter:card" content="summary" />`,
        ].join("\n    ");

        let html = this.shell;
        html = this.injectHead(html, `<script>window.__BIRTHDAY__=null</script>`);
        html = this.injectHead(html, meta);
        html = this.setTitle(html, "Поздравление не найдено");

        return { html, status: 404 };
    }

    /** Render the landing page (no friend injection — frontend shows landing). */
    static renderLanding(): RenderResult {
        const meta = [
            `<meta property="og:type" content="website" />`,
            `<meta property="og:title" content="Happy Birthdays ✨" />`,
            `<meta property="og:description" content="Тёплые открытки ко дню рождения для самых близких." />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
        ].join("\n    ");

        let html = this.shell;
        html = this.injectHead(html, meta);
        html = this.setTitle(html, "Happy Birthdays ✨");

        return { html, status: 200 };
    }

    /* ----------------------------------------------------------------- */
    /* Internals                                                          */
    /* ----------------------------------------------------------------- */

    /* Site config with a safe default when site.json is absent. */
    private static resolveSite(): SiteConfig {
        return (
            FriendRepository.getSite() ?? {
                owner: { displayName: "", avatarUrl: "" },
                baseUrl: BASE_URL,
            }
        );
    }

    /* Insert markup immediately before the closing </head> tag. */
    private static injectHead(html: string, headExtra: string): string {
        const idx = html.indexOf("</head>");
        if (idx === -1) return html + headExtra;
        return `${html.slice(0, idx)}    ${headExtra}\n  ${html.slice(idx)}`;
    }

    /* Build per-friend Open Graph + Twitter meta tags (all attrs escaped). */
    private static buildOgMeta(
        friend: PublicFriend,
        site: SiteConfig,
        hash: string | null,
    ): string {
        const url = `${site.baseUrl}/${friend.slug}`;
        const title = `С днём рождения, ${friend.displayName}! 🎂`;
        const description = friend.message.trim().slice(0, 150);
        const image = `${site.baseUrl}/og/${friend.slug}.png${hash ? `?v=${hash}` : ""}`;

        const tags = [
            `<meta property="og:type" content="website" />`,
            `<meta property="og:url" content="${escapeAttr(url)}" />`,
            `<meta property="og:title" content="${escapeAttr(title)}" />`,
            `<meta property="og:description" content="${escapeAttr(description)}" />`,
            `<meta property="og:image" content="${escapeAttr(image)}" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
            `<meta property="og:image:type" content="image/png" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
            `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
            `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
        ];
        return tags.join("\n    ");
    }

    /* Inject the bootstrap data script (friend + site) before </head>. */
    private static injectData(
        html: string,
        friend: PublicFriend,
        site: SiteConfig,
    ): string {
        const friendJson = jsonForScript(friend);
        const siteJson = jsonForScript(site);
        const script = `<script>window.__BIRTHDAY__=${friendJson};window.__SITE__=${siteJson}</script>`;
        return this.injectHead(html, script);
    }

    /* Replace the <title> contents, or inject one if absent. */
    private static setTitle(html: string, title: string): string {
        const escaped = escapeText(title);
        if (/<title>[\s\S]*?<\/title>/.test(html)) {
            return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escaped}</title>`);
        }
        return this.injectHead(html, `<title>${escaped}</title>`);
    }
}

/* ---------------------------------------------------------------------- */
/* Escaping helpers                                                        */
/* ---------------------------------------------------------------------- */

/* Escape a value destined for a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* Escape text content (e.g. inside <title>). */
function escapeText(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/*
 * Serialise a value for inline <script> embedding. JSON.stringify already
 * escapes quotes; we additionally break up "</" and the U+2028 / U+2029
 * separators so the payload can never terminate the script tag or break the
 * surrounding JS parse.
 */
function jsonForScript(value: unknown): string {
    return JSON.stringify(value)
        .split("</")
        .join("<\\/")
        .split(LINE_SEPARATOR)
        .join("\\u2028")
        .split(PARAGRAPH_SEPARATOR)
        .join("\\u2029");
}
