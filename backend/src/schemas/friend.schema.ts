import { t } from "elysia";
import type { FriendConfig, ParsedBirthday } from "../models/Friend";
import { normalizeSocialUrl } from "../utils/socialUrl";

/* ------------------------------------------------------------------ */
/* Birthday parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a birthday string into { month, day, year? }.
 * Accepts "MM-DD" (no year) or full ISO "YYYY-MM-DD". Throws on invalid input.
 */
export function parseBirthday(raw: string): ParsedBirthday {
    if (typeof raw !== "string") {
        throw new Error("birthday must be a string");
    }
    const trimmed = raw.trim();

    /* Full ISO: YYYY-MM-DD */
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (iso) {
        const year = Number(iso[1]);
        const month = Number(iso[2]);
        const day = Number(iso[3]);
        assertMonthDay(month, day, trimmed);
        return { month, day, year };
    }

    /* Short: MM-DD */
    const md = /^(\d{2})-(\d{2})$/.exec(trimmed);
    if (md) {
        const month = Number(md[1]);
        const day = Number(md[2]);
        assertMonthDay(month, day, trimmed);
        return { month, day };
    }

    throw new Error(`Invalid birthday format: "${raw}" (expected MM-DD or YYYY-MM-DD)`);
}

function assertMonthDay(month: number, day: number, raw: string): void {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        throw new Error(`Invalid birthday value: "${raw}"`);
    }
}

/* ------------------------------------------------------------------ */
/* Runtime friend config validation                                    */
/* ------------------------------------------------------------------ */

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string): string {
    const v = obj[key];
    if (typeof v !== "string" || v.length === 0) {
        throw new Error(`friend config: "${key}" must be a non-empty string`);
    }
    return v;
}

/**
 * Validate an unknown value as a FriendConfig. Returns a typed, normalized
 * object on success; throws with a descriptive message on bad shape.
 */
export function validateFriendConfig(obj: unknown): FriendConfig {
    if (!isObject(obj)) {
        throw new Error("friend config: root must be an object");
    }

    const username = requireString(obj, "username");
    const displayName = requireString(obj, "displayName");
    const birthday = requireString(obj, "birthday");
    const message = requireString(obj, "message");
    const avatar = requireString(obj, "avatar");

    /* Birthday must be parseable. */
    parseBirthday(birthday);

    /* games: required array of { gameId, config? }. */
    if (!Array.isArray(obj.games)) {
        throw new Error('friend config: "games" must be an array');
    }
    const games = obj.games.map((g, i) => {
        if (!isObject(g) || typeof g.gameId !== "string" || g.gameId.length === 0) {
            throw new Error(`friend config: games[${i}].gameId must be a non-empty string`);
        }
        const entry: { gameId: string; config?: Record<string, unknown> } = {
            gameId: g.gameId,
        };
        if (g.config !== undefined) {
            if (!isObject(g.config)) {
                throw new Error(`friend config: games[${i}].config must be an object`);
            }
            entry.config = g.config;
        }
        return entry;
    });

    const result: FriendConfig = {
        username,
        displayName,
        birthday,
        message,
        avatar,
        games,
    };

    /* Optional fields. */
    if (obj.accent !== undefined) {
        if (typeof obj.accent !== "string") {
            throw new Error('friend config: "accent" must be a string');
        }
        result.accent = obj.accent;
    }

    if (obj.puzzleAvatar !== undefined) {
        if (typeof obj.puzzleAvatar !== "string") {
            throw new Error('friend config: "puzzleAvatar" must be a string');
        }
        result.puzzleAvatar = obj.puzzleAvatar;
    }

    if (obj.gift !== undefined) {
        if (!isObject(obj.gift)) {
            throw new Error('friend config: "gift" must be an object');
        }
        const gift = obj.gift;
        if (typeof gift.name !== "string" || typeof gift.emoji !== "string") {
            throw new Error('friend config: gift.name and gift.emoji are required strings');
        }
        result.gift = {
            name: gift.name,
            emoji: gift.emoji,
            ...(typeof gift.lottie === "string" ? { lottie: gift.lottie } : {}),
            ...(typeof gift.imagePath === "string" ? { imagePath: gift.imagePath } : {}),
            ...(typeof gift.link === "string" ? { link: gift.link } : {}),
        };
    }

    /* Optional gift history (past gifts). */
    if (obj.giftHistory !== undefined) {
        if (!Array.isArray(obj.giftHistory)) {
            throw new Error('friend config: "giftHistory" must be an array');
        }
        result.giftHistory = obj.giftHistory.map((g, i) => {
            if (!isObject(g) || typeof g.name !== "string") {
                throw new Error(`friend config: giftHistory[${i}].name must be a string`);
            }
            return {
                name: g.name,
                ...(typeof g.emoji === "string" ? { emoji: g.emoji } : {}),
                ...(typeof g.lottie === "string" ? { lottie: g.lottie } : {}),
                ...(typeof g.link === "string" ? { link: g.link } : {}),
                ...(typeof g.imagePath === "string" ? { imagePath: g.imagePath } : {}),
                ...(typeof g.date === "string" ? { date: g.date } : {}),
            };
        });
    }

    /* Display settings. */
    if (typeof obj.gamesEnabled === "boolean") result.gamesEnabled = obj.gamesEnabled;
    if (obj.giftDisplay === "current" || obj.giftDisplay === "all") {
        result.giftDisplay = obj.giftDisplay;
    }
    if (obj.giftLayout === "list" || obj.giftLayout === "blocks") {
        result.giftLayout = obj.giftLayout;
    }
    if (obj.lang === "ru" || obj.lang === "en") result.lang = obj.lang;

    /* Equipped shop decorations (one item id per slot). */
    if (isObject(obj.decor)) {
        const decor: NonNullable<FriendConfig["decor"]> = {};
        for (const slot of ["avatarFrame", "background", "badge", "effect", "companion"] as const) {
            const v = (obj.decor as Record<string, unknown>)[slot];
            if (typeof v === "string" && v.length > 0) decor[slot] = v;
        }
        if (Object.keys(decor).length > 0) result.decor = decor;
    }

    /* Personal profile: free-text bio + social links. */
    if (typeof obj.bio === "string") result.bio = obj.bio;
    if (obj.socialStyle === "icon" || obj.socialStyle === "iconOnly" || obj.socialStyle === "text") {
        result.socialStyle = obj.socialStyle;
    }
    if (Array.isArray(obj.socials)) {
        const socials = obj.socials
            .filter(
                (s): s is { platform: unknown; url: unknown } =>
                    isObject(s) && typeof s.url === "string" && s.url.length > 0,
            )
            .map((s) => {
                const platform = typeof s.platform === "string" ? s.platform : "link";
                /* Force an absolute, scheme'd, platform-matching URL — drops the
                   relative-link footgun and links pointing at the wrong service. */
                const url = normalizeSocialUrl(platform, s.url as string);
                return url ? { platform, url } : null;
            })
            .filter((s): s is { platform: string; url: string } => s !== null);
        if (socials.length > 0) result.socials = socials;
    }

    /* Optional localized content (auto-translated, hand-editable). Lenient: only
       string fields are kept; anything malformed is silently dropped. */
    if (isObject(obj.translations)) {
        const out: NonNullable<FriendConfig["translations"]> = {};
        for (const lang of ["ru", "en"] as const) {
            const tr = (obj.translations as Record<string, unknown>)[lang];
            if (!isObject(tr)) continue;
            const fields: NonNullable<FriendConfig["translations"]>["ru"] = {};
            if (typeof tr.displayName === "string") fields.displayName = tr.displayName;
            if (typeof tr.message === "string") fields.message = tr.message;
            if (typeof tr.giftName === "string") fields.giftName = tr.giftName;
            if (typeof tr.bio === "string") fields.bio = tr.bio;
            if (Object.keys(fields).length > 0) out[lang] = fields;
        }
        if (Object.keys(out).length > 0) result.translations = out;
    }
    if (
        obj.theme === "light" ||
        obj.theme === "dark" ||
        obj.theme === "halloween" ||
        obj.theme === "newyear"
    ) {
        result.theme = obj.theme;
    }

    return result;
}

/* ------------------------------------------------------------------ */
/* TypeBox object schemas                                               */
/* ------------------------------------------------------------------ */

export const Birthday_Object_Schema = {
    month: t.Number(),
    day: t.Number(),
    year: t.Optional(t.Number()),
};

export const Gift_Object_Schema = {
    name: t.String(),
    emoji: t.String(),
    lottie: t.Optional(t.String()),
    imageUrl: t.Optional(t.String()),
    link: t.Optional(t.String()),
};

export const Game_Object_Schema = {
    gameId: t.String(),
    config: t.Optional(t.Record(t.String(), t.Unknown())),
};

export const Access_Object_Schema = {
    state: t.Union([t.Literal("open"), t.Literal("closing"), t.Literal("locked")]),
    daysUntilBirthday: t.Number(),
    closesInDays: t.Number(),
};

/* Per-language localized content variants (other than the page's source lang). */
const FriendTranslations_Object_Schema = t.Object({
    displayName: t.Optional(t.String()),
    message: t.Optional(t.String()),
    giftName: t.Optional(t.String()),
    bio: t.Optional(t.String()),
});

const Social_Object_Schema = t.Object({
    platform: t.String(),
    url: t.String(),
});

const Decor_Object_Schema = t.Object({
    avatarFrame: t.Optional(t.String()),
    background: t.Optional(t.String()),
    badge: t.Optional(t.String()),
    effect: t.Optional(t.String()),
    companion: t.Optional(t.String()),
});

export const PublicFriend_Object_Schema = {
    slug: t.String(),
    username: t.String(),
    displayName: t.String(),
    birthday: t.Object(Birthday_Object_Schema),
    message: t.String(),
    accent: t.String(),
    gift: t.Optional(t.Object(Gift_Object_Schema)),
    games: t.Array(t.Object(Game_Object_Schema)),
    avatarUrl: t.String(),
    puzzleAvatarUrl: t.Optional(t.String()),
    giftHistory: t.Optional(
        t.Array(
            t.Object({
                name: t.String(),
                emoji: t.Optional(t.String()),
                lottie: t.Optional(t.String()),
                link: t.Optional(t.String()),
                imageUrl: t.Optional(t.String()),
                date: t.Optional(t.String()),
            }),
        ),
    ),
    gamesEnabled: t.Boolean(),
    giftDisplay: t.Union([t.Literal("current"), t.Literal("all")]),
    giftLayout: t.Union([t.Literal("list"), t.Literal("blocks")]),
    lang: t.Union([t.Literal("ru"), t.Literal("en")]),
    theme: t.Union([
        t.Literal("light"),
        t.Literal("dark"),
        t.Literal("halloween"),
        t.Literal("newyear"),
    ]),
    bio: t.Optional(t.String()),
    socials: t.Optional(t.Array(Social_Object_Schema)),
    socialStyle: t.Optional(
        t.Union([t.Literal("icon"), t.Literal("iconOnly"), t.Literal("text")]),
    ),
    decor: t.Optional(Decor_Object_Schema),
    translations: t.Optional(
        t.Object({
            ru: t.Optional(FriendTranslations_Object_Schema),
            en: t.Optional(FriendTranslations_Object_Schema),
        }),
    ),
    access: t.Object(Access_Object_Schema),
};

export const SiteConfig_Object_Schema = {
    owner: t.Object({
        displayName: t.String(),
        avatarUrl: t.String(),
    }),
    baseUrl: t.String(),
};

export const Score_Object_Schema = {
    slug: t.String(),
    gameId: t.String(),
    score: t.Number(),
    durationMs: t.Number(),
    createdAt: t.Number(),
};

/* Shared error response shape. */
const errorResponse = t.Object({ error: t.String() });

/* ------------------------------------------------------------------ */
/* Request schemas (consumed by Phase 2 routes)                        */
/* ------------------------------------------------------------------ */

export const getFriend_Request_Schema = {
    params: t.Object({
        slug: t.String({ error: "slug is required." }),
    }),
    response: {
        200: t.Object(PublicFriend_Object_Schema),
        400: errorResponse,
        404: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};

export const getSite_Request_Schema = {
    response: {
        200: t.Object(SiteConfig_Object_Schema),
        404: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};

/* Per-game best entry + the totals shape returned by the score endpoints. */
const GameBest_Object_Schema = t.Object({ gameId: t.String(), best: t.Number() });
const Totals_Object = t.Object({
    total: t.Number(),
    games: t.Array(GameBest_Object_Schema),
});

export const startGame_Request_Schema = {
    body: t.Object({
        slug: t.String({ error: "slug is required." }),
        gameId: t.String({ error: "gameId is required." }),
        visitorId: t.Optional(t.String()),
    }),
    response: {
        200: t.Object({ token: t.String() }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};

export const postScore_Request_Schema = {
    body: t.Object({
        slug: t.String({ error: "slug is required." }),
        visitorId: t.Optional(t.String()),
        gameId: t.String({ error: "gameId is required." }),
        durationMs: t.Number({ error: "durationMs must be a number." }),
        meta: t.Optional(t.Record(t.String(), t.Unknown())),
        token: t.Optional(t.String()),
    }),
    response: {
        200: t.Object({
            ok: t.Boolean(),
            score: t.Number(),
            gameBest: t.Number(),
            earned: t.Number(),
            personal: Totals_Object,
            global: Totals_Object,
        }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};

export const getTotals_Request_Schema = {
    params: t.Object({
        slug: t.String({ error: "slug is required." }),
    }),
    query: t.Object({
        visitorId: t.Optional(t.String()),
    }),
    response: {
        200: t.Object({ earned: t.Number(), personal: Totals_Object, global: Totals_Object }),
        404: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};

export const getHistory_Request_Schema = {
    params: t.Object({
        slug: t.String({ error: "slug is required." }),
    }),
    response: {
        200: t.Object({
            gifts: t.Array(
                t.Object({
                    id: t.Number(),
                    slug: t.String(),
                    name: t.String(),
                    emoji: t.String(),
                    lottie: t.String(),
                    link: t.String(),
                    imagePath: t.String(),
                    createdAt: t.Number(),
                }),
            ),
            changes: t.Array(
                t.Object({
                    id: t.Number(),
                    slug: t.String(),
                    field: t.String(),
                    oldValue: t.String(),
                    newValue: t.String(),
                    createdAt: t.Number(),
                }),
            ),
        }),
        500: errorResponse,
    },
};

export const getBirthdays_Request_Schema = {
    response: {
        200: t.Object({
            birthdays: t.Array(
                t.Object({
                    slug: t.String(),
                    displayName: t.String(),
                    username: t.String(),
                    month: t.Number(),
                    day: t.Number(),
                    year: t.Nullable(t.Number()),
                    daysUntil: t.Number(),
                }),
            ),
        }),
        500: errorResponse,
    },
};

export const getScores_Request_Schema = {
    params: t.Object({
        slug: t.String({ error: "slug is required." }),
        gameId: t.String({ error: "gameId is required." }),
    }),
    query: t.Object({
        limit: t.Optional(t.String()),
    }),
    response: {
        200: t.Object({ scores: t.Array(t.Object(Score_Object_Schema)) }),
        400: errorResponse,
        404: errorResponse,
        422: errorResponse,
        500: errorResponse,
    },
};
