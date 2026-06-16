import path from "node:path";

import FriendRepository from "../repositories/FriendRepository";
import BirthdayRepository from "../repositories/BirthdayRepository";
import HistoryRepository from "../repositories/HistoryRepository";
import { readUser } from "./authController";
import type { AuthUser } from "../models/Auth";
import type { FriendConfig } from "../models/Friend";
import { translateContent, type Lang, type TranslatableContent } from "../services/translateService";
import { assertInside } from "../utils/paths";
import Logger from "../utils/Logger";

/* Fields a non-owner friend may change on their OWN page. The owner may write
   the full config. */
const FRIEND_EDITABLE = [
    "displayName",
    "birthday",
    "accent",
    "gamesEnabled",
    "giftDisplay",
    "giftLayout",
    "bio",
    "socials",
    "theme",
    "lang",
    "translations",
] as const;

const OTHER_LANG: Record<Lang, Lang> = { ru: "en", en: "ru" };

/* Auto-fill the other-language translation for any user field left blank,
   preserving manual overrides already present. The editor owns re-translation
   when a source field changes; this is a safety net for blank/absent variants.
   Network/key failures leave translations untouched (never blocks a save). */
async function autofillTranslations(cfg: FriendConfig): Promise<void> {
    const from = (cfg.lang ?? "ru") as Lang;
    const to = OTHER_LANG[from];
    const existing = cfg.translations?.[to] ?? {};
    const need: TranslatableContent = {};
    if (!existing.displayName?.trim() && cfg.displayName?.trim()) need.displayName = cfg.displayName;
    if (!existing.message?.trim() && cfg.message?.trim()) need.message = cfg.message;
    if (!existing.giftName?.trim() && cfg.gift?.name?.trim()) need.giftName = cfg.gift.name;
    if (!existing.bio?.trim() && cfg.bio?.trim()) need.bio = cfg.bio;
    if (Object.keys(need).length === 0) return;

    const translated = await translateContent(need, from, to);
    if (!translated) return;
    cfg.translations = {
        ...cfg.translations,
        [to]: { ...existing, ...translated },
    };
}

function canEdit(user: AuthUser, cfgUsername?: string): boolean {
    if (user.isOwner) return true;
    if (!cfgUsername) return false;
    return user.username === cfgUsername.replace(/^@/, "").toLowerCase();
}

/* Re-sync derived DBs (birthdays + history) after a config write so the change
   (e.g. a renamed friend) is recorded immediately. */
function resync(slug: string): void {
    const friend = FriendRepository.findBySlug(slug);
    if (friend) BirthdayRepository.syncFromFriends([friend]);
    const cfg = FriendRepository.getRawConfig(slug);
    if (!cfg) return;
    HistoryRepository.syncProfile(slug, {
        displayName: cfg.displayName,
        username: cfg.username,
        avatar: cfg.avatar,
    });
    HistoryRepository.syncGifts(slug, [...(cfg.gift ? [cfg.gift] : []), ...(cfg.giftHistory ?? [])]);
}

/** GET /api/admin/friends — owner-only list of all pages (summary). */
export const listFriends = async ({ jwt, cookie, set }: any) => {
    const user = await readUser(jwt, cookie);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!user.isOwner) { set.status = 403; return { error: "Owner only" }; }

    const friends = FriendRepository.listSlugs().map((slug) => {
        const f = FriendRepository.findBySlug(slug);
        return f
            ? {
                  slug: f.slug,
                  displayName: f.displayName,
                  username: f.username,
                  birthday: f.birthday,
                  state: f.access.state,
                  avatarUrl: f.avatarUrl,
              }
            : null;
    });
    set.status = 200;
    return { friends: friends.filter(Boolean) };
};

/** GET /api/admin/mine — pages the logged-in user may edit. Owner: all pages;
    a friend: the page(s) whose username matches theirs — so they find their own
    page even when its slug differs from their Telegram handle. */
export const myPages = async ({ jwt, cookie, set }: any) => {
    const user = await readUser(jwt, cookie);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }

    const pages = FriendRepository.listSlugs()
        .map((slug) => {
            const cfg = FriendRepository.getRawConfig(slug);
            if (!cfg || !canEdit(user, cfg.username)) return null;
            return {
                slug,
                displayName: cfg.displayName,
                username: cfg.username,
                avatarUrl: `/friends/${slug}/${cfg.avatar}`,
            };
        })
        .filter(Boolean);

    set.status = 200;
    return { pages, isOwner: user.isOwner };
};

/** GET /api/admin/friend/:slug — raw config for editing (owner or that friend). */
export const getFriendConfig = async ({ params, jwt, cookie, set }: any) => {
    const user = await readUser(jwt, cookie);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    const cfg = FriendRepository.getRawConfig(params.slug);
    if (!cfg) { set.status = 404; return { error: "Not found" }; }
    if (!canEdit(user, cfg.username)) { set.status = 403; return { error: "Forbidden" }; }
    set.status = 200;
    return { slug: params.slug, config: cfg, isOwner: user.isOwner };
};

/** PUT /api/admin/friend/:slug — owner writes full config; friend writes a subset. */
export const updateFriend = async ({ params, body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }
        const current = FriendRepository.getRawConfig(params.slug);
        if (!current) { set.status = 404; return { error: "Not found" }; }
        if (!canEdit(user, current.username)) { set.status = 403; return { error: "Forbidden" }; }

        let next: unknown;
        if (user.isOwner) {
            next = body;
        } else {
            const merged: Record<string, unknown> = { ...current };
            for (const k of FRIEND_EDITABLE) {
                if (body?.[k] !== undefined) merged[k] = body[k];
            }
            next = merged;
        }

        const saved = FriendRepository.writeConfig(params.slug, next);
        if (!saved) { set.status = 400; return { error: "Invalid config" }; }
        /* Fill any missing other-language variants, then persist again. */
        await autofillTranslations(saved);
        FriendRepository.writeConfig(params.slug, saved);
        resync(params.slug);
        set.status = 200;
        return { ok: true, friend: FriendRepository.findBySlug(params.slug) };
    } catch (error) {
        Logger.error("AdminController", `updateFriend error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/** POST /api/admin/friends — owner-only create (auto-slug from username). */
export const createFriend = async ({ body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }
        if (!user.isOwner) { set.status = 403; return { error: "Owner only" }; }

        const provided = typeof body?.slug === "string" ? body.slug : "";
        const fromUsername = String(body?.username ?? "").replace(/^@/, "").toLowerCase();
        const slug = (provided || fromUsername)
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "");
        if (!slug) { set.status = 400; return { error: "Could not derive a slug" }; }

        const { slug: _omit, ...config } = body ?? {};
        const saved = FriendRepository.createFriend(slug, config);
        if (!saved) { set.status = 409; return { error: "Slug exists or config invalid" }; }
        /* Seed the other-language variants for the freshly authored content. */
        await autofillTranslations(saved);
        FriendRepository.writeConfig(slug, saved);
        resync(slug);
        set.status = 200;
        return { ok: true, slug, friend: FriendRepository.findBySlug(slug) };
    } catch (error) {
        Logger.error("AdminController", `createFriend error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/** POST /api/admin/friend/:slug/avatar — upload an avatar; sets config.avatar. */
export const uploadAvatar = async ({ params, body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }
        const cfg = FriendRepository.getRawConfig(params.slug);
        if (!cfg) { set.status = 404; return { error: "Not found" }; }
        if (!canEdit(user, cfg.username)) { set.status = 403; return { error: "Forbidden" }; }

        const file = body?.avatar as File | undefined;
        if (!file || typeof file.arrayBuffer !== "function") {
            set.status = 400;
            return { error: "No avatar file" };
        }
        const which = body?.which === "puzzle" ? "puzzle" : "main";
        const ext = (file.type === "image/png" ? "png" : "jpg");
        const filename = `${which}-${Math.max(1, file.size)}.${ext}`;

        const dir = FriendRepository.friendDirPath(params.slug);
        if (!dir) { set.status = 400; return { error: "Bad slug" }; }
        const dest = assertInside(dir, filename);
        await Bun.write(dest, await file.arrayBuffer());

        const nextCfg = { ...cfg, [which === "puzzle" ? "puzzleAvatar" : "avatar"]: filename };
        FriendRepository.writeConfig(params.slug, nextCfg);
        resync(params.slug);

        set.status = 200;
        return { ok: true, filename, url: `/friends/${params.slug}/${filename}` };
    } catch (error) {
        Logger.error("AdminController", `uploadAvatar error: ${error}`, { slug: params?.slug });
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/** POST /api/admin/translate — translate live form fields (any logged-in user).
    Operates on the values sent in the body so unsaved edits translate too. */
export const translate = async ({ body, jwt, cookie, set }: any) => {
    try {
        const user = await readUser(jwt, cookie);
        if (!user) { set.status = 401; return { error: "Unauthorized" }; }

        const from: Lang = body?.from === "en" ? "en" : "ru";
        const to: Lang = body?.to === "ru" ? "ru" : "en";
        if (from === to) { set.status = 400; return { error: "from and to must differ" }; }

        const fields: TranslatableContent = {};
        if (typeof body?.displayName === "string") fields.displayName = body.displayName;
        if (typeof body?.message === "string") fields.message = body.message;
        if (typeof body?.giftName === "string") fields.giftName = body.giftName;
        if (typeof body?.bio === "string") fields.bio = body.bio;

        const result = await translateContent(fields, from, to);
        if (!result) { set.status = 502; return { error: "Translation unavailable" }; }
        set.status = 200;
        return { ok: true, translations: result };
    } catch (error) {
        Logger.error("AdminController", `translate error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};
