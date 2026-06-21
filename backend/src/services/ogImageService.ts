import fs from "node:fs";
import path from "node:path";

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import {
    OG_WIDTH,
    OG_HEIGHT,
    FONTS_DIR,
    OG_CACHE_DIR,
    STYLE_VERSION,
    OG_TEMPLATE_VERSION,
    DEFAULT_ACCENT,
} from "../config/constants";
import FriendRepository from "../repositories/FriendRepository";
import type { FriendConfig } from "../models/Friend";
import { parseBirthday } from "../schemas/friend.schema";
import { resolveCurrentGift } from "../utils/gift";
import { shortHash } from "../utils/hash";
import { readAvatarDataUri, fileMtimeMs } from "../utils/avatarAsset";
import { emojiToDataUri } from "../utils/twemoji";
import { formatRuDate } from "../utils/ruDate";
import { buildOgNode, buildProfileOgNode } from "./ogTemplate";
import Logger from "../utils/Logger";

/*
 * Satori font set. STATIC instances with full Cyrillic coverage — variable
 * fonts crash satori. Loaded once at module init. Comfortaa for the title,
 * Nunito (400/700) for body text.
 */
type SatoriFont = {
    name: string;
    data: ArrayBuffer;
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style: "normal" | "italic";
};

const fonts: SatoriFont[] = [
    {
        name: "Comfortaa",
        data: await Bun.file(path.join(FONTS_DIR, "Comfortaa-700.ttf")).arrayBuffer(),
        weight: 700,
        style: "normal",
    },
    {
        name: "Nunito",
        data: await Bun.file(path.join(FONTS_DIR, "Nunito-400.ttf")).arrayBuffer(),
        weight: 400,
        style: "normal",
    },
    {
        name: "Nunito",
        data: await Bun.file(path.join(FONTS_DIR, "Nunito-700.ttf")).arrayBuffer(),
        weight: 700,
        style: "normal",
    },
];

interface OgComputation {
    hash: string;
    cfg: FriendConfig;
    avatarPath: string;
}

/* Remove emoji / pictographs + variation selectors so satori never renders tofu
   boxes for inline emoji (it can only draw emoji supplied as <img> data-URIs). */
function stripEmoji(text: string): string {
    return text
        .replace(
            /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
            "",
        )
        .replace(/\s{2,}/g, " ")
        .trim();
}

/**
 * Open Graph image service. Renders cozy birthday cards with satori + resvg
 * and caches the resulting PNGs on disk keyed by a content hash. All public
 * methods degrade to null on failure (never throw to callers).
 */
export default class OgImageService {
    /*
     * Resolve a friend's config + avatar and derive the cache hash. The hash
     * folds in the raw config, both version constants, and the avatar mtime so
     * any edit invalidates the cached image. Returns null when the friend or
     * avatar is missing.
     */
    private static computeOg(slug: string): OgComputation | null {
        const cfg = FriendRepository.getRawConfig(slug);
        if (!cfg) return null;

        const avatarPath = FriendRepository.getAvatarPath(slug, cfg.avatar);
        if (!avatarPath) return null;

        const mtime = fileMtimeMs(avatarPath);
        const hash = shortHash(
            JSON.stringify(cfg) + STYLE_VERSION + OG_TEMPLATE_VERSION + String(mtime),
        );

        return { hash, cfg, avatarPath };
    }

    /** Content hash for a friend's OG image (used for `?v=` cache-busting). */
    static ogHash(slug: string): string | null {
        try {
            return this.computeOg(slug)?.hash ?? null;
        } catch (error) {
            Logger.error("OgImageService", `ogHash failed: ${error}`, { slug });
            return null;
        }
    }

    /**
     * Render (or read from cache) the OG PNG for a friend. Returns the PNG
     * bytes and the content hash, or null when the friend / avatar is missing
     * or rendering fails.
     */
    static async renderOgPng(slug: string): Promise<{ png: Buffer; hash: string } | null> {
        try {
            const computed = this.computeOg(slug);
            if (!computed) return null;

            const { hash, cfg, avatarPath } = computed;
            const cacheFile = path.join(OG_CACHE_DIR, `${slug}-${hash}.png`);

            /* Cache hit. */
            if (fs.existsSync(cacheFile)) {
                return { png: fs.readFileSync(cacheFile), hash };
            }

            const avatarDataUri = readAvatarDataUri(avatarPath);
            if (!avatarDataUri) {
                Logger.error("OgImageService", "avatar read failed", { slug, avatarPath });
                return null;
            }

            const currentGift = resolveCurrentGift(cfg);
            const giftEmojiDataUri = currentGift?.emoji ? emojiToDataUri(currentGift.emoji) : null;
            const dateText = formatRuDate(parseBirthday(cfg.birthday));
            const accent = cfg.accent ?? DEFAULT_ACCENT;

            const node = buildOgNode({
                displayName: cfg.displayName,
                username: cfg.username,
                dateText,
                avatarDataUri,
                giftEmojiDataUri,
                accent,
            });

            /* satori's typings expect a ReactNode; our plain node tree is valid. */
            const svg = await satori(node as never, {
                width: OG_WIDTH,
                height: OG_HEIGHT,
                fonts: fonts as never,
            });

            const png = new Resvg(svg, {
                fitTo: { mode: "width", value: OG_WIDTH },
            })
                .render()
                .asPng();

            this.writeCacheAtomic(cacheFile, png);
            return { png, hash };
        } catch (error) {
            Logger.error("OgImageService", `renderOgPng failed: ${error}`, { slug });
            return null;
        }
    }

    /* Profile OG hash — folds in the bio + a "profile" discriminator so it never
       collides with the birthday image cache for the same slug. */
    private static computeProfile(slug: string): { hash: string; cfg: FriendConfig; avatarPath: string } | null {
        const cfg = FriendRepository.getRawConfig(slug);
        if (!cfg) return null;
        const avatarPath = FriendRepository.getAvatarPath(slug, cfg.avatar);
        if (!avatarPath) return null;
        const mtime = fileMtimeMs(avatarPath);
        const hash = shortHash(
            "profile" + JSON.stringify(cfg) + STYLE_VERSION + OG_TEMPLATE_VERSION + String(mtime),
        );
        return { hash, cfg, avatarPath };
    }

    /** Content hash for a friend's profile OG image (for `?v=` cache-busting). */
    static profileOgHash(slug: string): string | null {
        try {
            return this.computeProfile(slug)?.hash ?? null;
        } catch (error) {
            Logger.error("OgImageService", `profileOgHash failed: ${error}`, { slug });
            return null;
        }
    }

    /** Render (or read from cache) the profile OG PNG: avatar + name + bio. */
    static async renderProfileOgPng(slug: string): Promise<{ png: Buffer; hash: string } | null> {
        try {
            const computed = this.computeProfile(slug);
            if (!computed) return null;

            const { hash, cfg, avatarPath } = computed;
            const cacheFile = path.join(OG_CACHE_DIR, `${slug}-profile-${hash}.png`);
            if (fs.existsSync(cacheFile)) {
                return { png: fs.readFileSync(cacheFile), hash };
            }

            const avatarDataUri = readAvatarDataUri(avatarPath);
            if (!avatarDataUri) {
                Logger.error("OgImageService", "avatar read failed", { slug, avatarPath });
                return null;
            }

            const node = buildProfileOgNode({
                displayName: stripEmoji(cfg.displayName),
                username: cfg.username,
                /* satori can't draw inline emoji (only <img> data-URIs), so strip
                   them from the bio to avoid tofu boxes. */
                bio: stripEmoji(cfg.bio ?? "").slice(0, 140),
                avatarDataUri,
                accent: cfg.accent ?? DEFAULT_ACCENT,
            });

            const svg = await satori(node as never, {
                width: OG_WIDTH,
                height: OG_HEIGHT,
                fonts: fonts as never,
            });
            const png = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } })
                .render()
                .asPng();

            this.writeCacheAtomic(cacheFile, png);
            return { png, hash };
        } catch (error) {
            Logger.error("OgImageService", `renderProfileOgPng failed: ${error}`, { slug });
            return null;
        }
    }

    /* Write the PNG to a temp file then rename into place (atomic-ish). */
    private static writeCacheAtomic(cacheFile: string, png: Buffer): void {
        try {
            fs.mkdirSync(OG_CACHE_DIR, { recursive: true });
            const tmp = `${cacheFile}.${process.pid}.tmp`;
            fs.writeFileSync(tmp, png);
            fs.renameSync(tmp, cacheFile);
        } catch (error) {
            /* Cache write failure is non-fatal — the PNG was still produced. */
            Logger.warn("OgImageService", `cache write failed: ${error}`, { cacheFile });
        }
    }
}
