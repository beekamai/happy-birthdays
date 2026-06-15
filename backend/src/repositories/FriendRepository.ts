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
    private static toPublicFriend(slug: string, cfg: FriendConfig): PublicFriend {
        const birthday = parseBirthday(cfg.birthday);
        const access = computeAccess(birthday.month, birthday.day);

        /* Locked pages expose only identity + countdown — no greeting, gift or
           games (the celebration is hidden until the birthday window). */
        if (access.state === "locked") {
            return {
                slug,
                username: cfg.username,
                displayName: cfg.displayName,
                birthday,
                message: "",
                accent: cfg.accent ?? DEFAULT_ACCENT,
                games: [],
                avatarUrl: `/friends/${slug}/${cfg.avatar}`,
                access,
            };
        }

        const friend: PublicFriend = {
            slug,
            username: cfg.username,
            displayName: cfg.displayName,
            birthday,
            message: cfg.message,
            accent: cfg.accent ?? DEFAULT_ACCENT,
            games: cfg.games,
            avatarUrl: `/friends/${slug}/${cfg.avatar}`,
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
