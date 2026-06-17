import fs from "node:fs";
import path from "node:path";

import {
    FRIENDS_DIR,
    OWNER_DIR,
    DATA_DIR,
    DEFAULT_ACCENT,
    BASE_URL,
    IS_DEV,
} from "../config/constants";
import type { FriendConfig, PublicFriend, SiteConfig } from "../models/Friend";
import { validateFriendConfig, parseBirthday } from "../schemas/friend.schema";
import { computeAccess } from "../utils/access";
import { assertInside } from "../utils/paths";
import Logger from "../utils/Logger";

/**
 * Data Access Layer for friend & site configs stored as JSON on disk.
 * Static methods only. Every public method is wrapped in try-catch and
 * degrades to null / [] on failure (never throws to callers).
 */
export default class FriendRepository {
    /* Parsed config cache, keyed by slug. Bypassed in dev for live edits. */
    private static cache = new Map<string, FriendConfig>();

    /* ----------------------------------------------------------------- */
    /* Friends                                                            */
    /* ----------------------------------------------------------------- */

    /** Read + validate a friend config and map it to the public shape. */
    static findBySlug(slug: string): PublicFriend | null {
        try {
            const cfg = this.readConfig(slug);
            if (!cfg) return null;
            return this.toPublicFriend(slug, cfg);
        } catch (error) {
            Logger.error("FriendRepository", `findBySlug failed: ${error}`, { slug });
            return null;
        }
    }

    /** Raw on-disk config (unmapped) — used for OG cache hashing. */
    static getRawConfig(slug: string): FriendConfig | null {
        try {
            return this.readConfig(slug);
        } catch (error) {
            Logger.error("FriendRepository", `getRawConfig failed: ${error}`, { slug });
            return null;
        }
    }

    /** All friends that have a valid config, mapped to public shape. */
    static findAll(): PublicFriend[] {
        try {
            if (!fs.existsSync(FRIENDS_DIR)) return [];
            const entries = fs.readdirSync(FRIENDS_DIR, { withFileTypes: true });
            const out: PublicFriend[] = [];
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const friend = this.findBySlug(entry.name);
                if (friend) out.push(friend);
            }
            return out;
        } catch (error) {
            Logger.error("FriendRepository", `findAll failed: ${error}`);
            return [];
        }
    }

    /** True when a friend directory contains a readable, valid config. */
    static exists(slug: string): boolean {
        return this.findBySlug(slug) !== null;
    }

    /**
     * Resolve an avatar/asset file path for a friend, guarded against traversal.
     * Only files actually referenced by the config (avatar, puzzleAvatar,
     * gift.imagePath) are served. Returns an absolute path or null.
     */
    static getAvatarPath(slug: string, file: string): string | null {
        try {
            const cfg = this.readConfig(slug);
            if (!cfg) return null;

            const allowed = new Set<string>([cfg.avatar]);
            if (cfg.puzzleAvatar) allowed.add(cfg.puzzleAvatar);
            if (cfg.gift?.imagePath) allowed.add(cfg.gift.imagePath);
            /* Gift animations (current + every history entry) live in the friend
               dir too; whitelist their basenames so saved Lottie/TGS uploads are
               servable while older gifts' files stay reachable forever. */
            for (const g of [cfg.gift, ...(cfg.giftHistory ?? [])]) {
                if (g?.lottie) allowed.add(g.lottie.split("/").pop()!);
            }
            if (!allowed.has(file)) return null;

            const dir = this.friendDir(slug);
            const resolved = assertInside(dir, file);
            if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
                return null;
            }
            return resolved;
        } catch (error) {
            Logger.error("FriendRepository", `getAvatarPath failed: ${error}`, { slug, file });
            return null;
        }
    }

    /* ----------------------------------------------------------------- */
    /* Site                                                               */
    /* ----------------------------------------------------------------- */

    /** Read site-level config; maps owner avatar filename to a public URL. */
    static getSite(): SiteConfig | null {
        try {
            const file = assertInside(DATA_DIR, "site.json");
            if (!fs.existsSync(file)) return null;

            const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
            const owner = raw?.owner ?? {};
            const displayName = typeof owner.displayName === "string" ? owner.displayName : "";
            const avatarFile = typeof owner.avatar === "string" ? owner.avatar : "";
            const baseUrl = typeof raw?.baseUrl === "string" && raw.baseUrl ? raw.baseUrl : BASE_URL;

            return {
                owner: {
                    displayName,
                    avatarUrl: avatarFile ? `/owner/${avatarFile}` : "",
                },
                baseUrl,
            };
        } catch (error) {
            Logger.error("FriendRepository", `getSite failed: ${error}`);
            return null;
        }
    }

    /** Resolve an owner avatar file path, guarded inside data/owner. */
    static getOwnerAvatarPath(file: string): string | null {
        try {
            const resolved = assertInside(OWNER_DIR, file);
            if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
                return null;
            }
            return resolved;
        } catch (error) {
            Logger.error("FriendRepository", `getOwnerAvatarPath failed: ${error}`, { file });
            return null;
        }
    }

    /* ----------------------------------------------------------------- */
    /* Admin writes                                                       */
    /* ----------------------------------------------------------------- */

    /** All friend slugs (directory names with a valid config). */
    static listSlugs(): string[] {
        try {
            if (!fs.existsSync(FRIENDS_DIR)) return [];
            return fs
                .readdirSync(FRIENDS_DIR, { withFileTypes: true })
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
                .filter((slug) => fs.existsSync(path.join(this.friendDir(slug), "config.json")));
        } catch (error) {
            Logger.error("FriendRepository", `listSlugs failed: ${error}`);
            return [];
        }
    }

    /**
     * Validate + write a friend config to disk, then bust the cache so the next
     * read reflects it. Returns the parsed config or null on failure.
     */
    static writeConfig(slug: string, raw: unknown): FriendConfig | null {
        try {
            if (!/^[a-z0-9-]+$/.test(slug)) {
                Logger.warn("FriendRepository", "writeConfig rejected bad slug", { slug });
                return null;
            }
            const cfg = validateFriendConfig(raw);
            const dir = this.friendDir(slug);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, "config.json");
            fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
            this.cache.delete(slug);
            return cfg;
        } catch (error) {
            Logger.error("FriendRepository", `writeConfig failed: ${error}`, { slug });
            return null;
        }
    }

    /** Create a new friend (fails if the slug already exists). */
    static createFriend(slug: string, raw: unknown): FriendConfig | null {
        try {
            const dir = this.friendDir(slug);
            if (fs.existsSync(path.join(dir, "config.json"))) {
                Logger.warn("FriendRepository", "createFriend: slug exists", { slug });
                return null;
            }
            return this.writeConfig(slug, raw);
        } catch (error) {
            Logger.error("FriendRepository", `createFriend failed: ${error}`, { slug });
            return null;
        }
    }

    /**
     * Delete a friend directory (data/friends/<slug>) and everything in it.
     * Guarded against traversal: the slug must match /^[a-z0-9-]+$/ and the
     * resolved path must stay inside FRIENDS_DIR. Busts the cache. Returns true
     * only when an existing page was actually removed.
     */
    static deleteFriend(slug: string): boolean {
        try {
            if (!/^[a-z0-9-]+$/.test(slug)) {
                Logger.warn("FriendRepository", "deleteFriend rejected bad slug", { slug });
                return false;
            }
            const dir = assertInside(FRIENDS_DIR, slug);
            /* Belt-and-braces: never delete the FRIENDS_DIR root itself. */
            if (dir === path.resolve(FRIENDS_DIR)) return false;
            if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;

            fs.rmSync(dir, { recursive: true, force: true });
            this.cache.delete(slug);
            return true;
        } catch (error) {
            Logger.error("FriendRepository", `deleteFriend failed: ${error}`, { slug });
            return false;
        }
    }

    /** Absolute path to a friend's directory (for avatar uploads). */
    static friendDirPath(slug: string): string | null {
        try {
            return this.friendDir(slug);
        } catch {
            return null;
        }
    }

    /* ----------------------------------------------------------------- */
    /* Internals                                                          */
    /* ----------------------------------------------------------------- */

    /* Validated friend directory path. */
    private static friendDir(slug: string): string {
        return assertInside(FRIENDS_DIR, slug);
    }

    /* Read & validate config.json for a slug, with dev-aware caching. */
    private static readConfig(slug: string): FriendConfig | null {
        if (!IS_DEV && this.cache.has(slug)) {
            return this.cache.get(slug)!;
        }

        const dir = this.friendDir(slug);
        const file = path.join(dir, "config.json");
        if (!fs.existsSync(file)) return null;

        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        const cfg = validateFriendConfig(raw);

        if (!IS_DEV) this.cache.set(slug, cfg);
        return cfg;
    }

    /*
     * THE single source of truth mapping FriendConfig -> PublicFriend.
     * Both the API and server-side page injection must go through here.
     */
    /* Map config gift history → public shape, sorted by date ascending. */
    private static buildGiftHistory(slug: string, cfg: FriendConfig) {
        return (cfg.giftHistory ?? [])
            .map((g) => ({
                name: g.name,
                ...(g.emoji ? { emoji: g.emoji } : {}),
                ...(g.lottie ? { lottie: g.lottie } : {}),
                ...(g.link ? { link: g.link } : {}),
                ...(g.imagePath ? { imageUrl: `/friends/${slug}/${g.imagePath}` } : {}),
                ...(g.date ? { date: g.date } : {}),
            }))
            .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    }

    /* Build the public translations map. On locked pages the greeting is hidden,
       so its translated variants are dropped too (keeping parity with `message`). */
    private static buildTranslations(cfg: FriendConfig, hideMessage: boolean) {
        if (!cfg.translations) return undefined;
        const out: NonNullable<FriendConfig["translations"]> = {};
        for (const lang of ["ru", "en"] as const) {
            const tr = cfg.translations[lang];
            if (!tr) continue;
            const fields = { ...tr };
            if (hideMessage) delete fields.message;
            if (Object.keys(fields).length > 0) out[lang] = fields;
        }
        return Object.keys(out).length > 0 ? out : undefined;
    }

    private static toPublicFriend(slug: string, cfg: FriendConfig): PublicFriend {
        const birthday = parseBirthday(cfg.birthday);
        const access = computeAccess(birthday.month, birthday.day);
        const giftHistory = this.buildGiftHistory(slug, cfg);
        const gamesEnabled = cfg.gamesEnabled ?? true;
        const giftDisplay = cfg.giftDisplay ?? "current";
        const giftLayout = cfg.giftLayout ?? "blocks";
        const lang = cfg.lang ?? "ru";
        const theme = cfg.theme ?? "light";

        /* Locked pages expose identity + countdown + the gift history list — but
           no greeting or games (the celebration itself stays hidden). */
        if (access.state === "locked") {
            const translations = this.buildTranslations(cfg, true);
            return {
                slug,
                username: cfg.username,
                displayName: cfg.displayName,
                birthday,
                message: "",
                accent: cfg.accent ?? DEFAULT_ACCENT,
                games: [],
                avatarUrl: `/friends/${slug}/${cfg.avatar}`,
                ...(giftHistory.length ? { giftHistory } : {}),
                gamesEnabled,
                giftDisplay,
                giftLayout,
                lang,
                theme,
                ...(cfg.bio ? { bio: cfg.bio } : {}),
                ...(cfg.socials?.length ? { socials: cfg.socials } : {}),
                ...(cfg.socialStyle ? { socialStyle: cfg.socialStyle } : {}),
                ...(cfg.decor ? { decor: cfg.decor } : {}),
                ...(translations ? { translations } : {}),
                access,
            };
        }

        const translations = this.buildTranslations(cfg, false);
        const friend: PublicFriend = {
            slug,
            username: cfg.username,
            displayName: cfg.displayName,
            birthday,
            message: cfg.message,
            accent: cfg.accent ?? DEFAULT_ACCENT,
            games: gamesEnabled ? cfg.games : [],
            avatarUrl: `/friends/${slug}/${cfg.avatar}`,
            ...(giftHistory.length ? { giftHistory } : {}),
            gamesEnabled,
            giftDisplay,
            giftLayout,
            lang,
            theme,
            ...(cfg.bio ? { bio: cfg.bio } : {}),
            ...(cfg.socials?.length ? { socials: cfg.socials } : {}),
            ...(cfg.socialStyle ? { socialStyle: cfg.socialStyle } : {}),
            ...(cfg.decor ? { decor: cfg.decor } : {}),
            ...(translations ? { translations } : {}),
            access,
        };

        if (cfg.puzzleAvatar) {
            friend.puzzleAvatarUrl = `/friends/${slug}/${cfg.puzzleAvatar}`;
        }

        if (cfg.gift) {
            friend.gift = {
                name: cfg.gift.name,
                emoji: cfg.gift.emoji,
                ...(cfg.gift.lottie ? { lottie: cfg.gift.lottie } : {}),
                ...(cfg.gift.imagePath
                    ? { imageUrl: `/friends/${slug}/${cfg.gift.imagePath}` }
                    : {}),
                ...(cfg.gift.link ? { link: cfg.gift.link } : {}),
            };
        }

        return friend;
    }
}
