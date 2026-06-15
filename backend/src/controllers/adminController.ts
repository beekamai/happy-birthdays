import path from "node:path";

import FriendRepository from "../repositories/FriendRepository";
import BirthdayRepository from "../repositories/BirthdayRepository";
import HistoryRepository from "../repositories/HistoryRepository";
import { readUser } from "./authController";
import type { AuthUser } from "../models/Auth";
import { assertInside } from "../utils/paths";
import Logger from "../utils/Logger";

/* Fields a non-owner friend may change on their OWN page. The owner may write
   the full config. */
const FRIEND_EDITABLE = ["displayName", "accent", "gamesEnabled", "giftDisplay", "giftLayout"] as const;

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
