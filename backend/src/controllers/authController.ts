import { verifyTelegramAuth, type TelegramAuthData } from "../utils/telegramAuth";
import {
    TG_BOT_TOKEN,
    TG_BOT_USERNAME,
    OWNER_TG_USERNAME,
    AUTH_TTL_DAYS,
    IS_DEV,
} from "../config/constants";
import type { AuthUser } from "../models/Auth";
import Logger from "../utils/Logger";

export const SESSION_COOKIE = "hb_session";

/* Resolve the logged-in user from the session cookie, or null. Exported so the
   admin middleware can reuse it. */
export async function readUser(jwt: any, cookie: any): Promise<AuthUser | null> {
    try {
        const token = cookie?.[SESSION_COOKIE]?.value;
        if (!token) return null;
        const payload = await jwt.verify(token);
        if (!payload || !payload.username) return null;
        return {
            tgId: String(payload.tgId),
            username: String(payload.username),
            firstName: payload.firstName ? String(payload.firstName) : undefined,
            photoUrl: payload.photoUrl ? String(payload.photoUrl) : undefined,
            isOwner: Boolean(payload.isOwner),
        };
    } catch {
        return null;
    }
}

/** POST /api/auth/telegram — verify the Login Widget payload, set a session. */
export const telegramLogin = async ({ body, jwt, cookie, set }: any) => {
    try {
        if (!TG_BOT_TOKEN) {
            set.status = 503;
            return { error: "Telegram login is not configured" };
        }
        const data = body as TelegramAuthData;
        if (!verifyTelegramAuth(data, TG_BOT_TOKEN)) {
            set.status = 401;
            return { error: "Invalid Telegram authentication" };
        }

        const username = (data.username ?? "").toLowerCase();
        const user: AuthUser = {
            tgId: String(data.id),
            username,
            firstName: data.first_name,
            photoUrl: data.photo_url,
            isOwner: !!username && username === OWNER_TG_USERNAME,
        };

        const token = await jwt.sign({ ...user });
        cookie[SESSION_COOKIE].set({
            value: token,
            httpOnly: true,
            secure: !IS_DEV,
            sameSite: "lax",
            path: "/",
            maxAge: AUTH_TTL_DAYS * 86_400,
        });

        set.status = 200;
        return { ok: true, user };
    } catch (error) {
        Logger.error("AuthController", `telegramLogin error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};

/** GET /api/auth/me — the current user, or { user: null }. */
export const me = async ({ jwt, cookie }: any) => {
    return { user: await readUser(jwt, cookie) };
};

/** POST /api/auth/logout — clear the session cookie. */
export const logout = async ({ cookie, set }: any) => {
    try {
        cookie[SESSION_COOKIE].remove();
    } catch {
        /* ignore */
    }
    set.status = 200;
    return { ok: true };
};

/** GET /api/auth/config — public widget config (bot username, enabled flag). */
export const authConfig = async () => ({
    botUsername: TG_BOT_USERNAME,
    enabled: !!TG_BOT_TOKEN,
});
