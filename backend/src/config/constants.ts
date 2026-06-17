import path from "node:path";

/* Cache-busting versions. Bump to invalidate generated OG images / styling. */
export const STYLE_VERSION = "1";
export const OG_TEMPLATE_VERSION = "1";

/* Open Graph image dimensions. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/* Fallback accent colour when a friend config omits `accent`. */
export const DEFAULT_ACCENT = "#7EC2E8";

/* Runtime environment. */
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
export const PORT = Number(process.env.PORT ?? 3000);
/* Bind to loopback by default so the port stays private behind a reverse proxy.
   Override with HOST=0.0.0.0 only when direct external access is intended. */
export const HOSTNAME = process.env.HOST ?? "127.0.0.1";
export const IS_DEV = process.env.NODE_ENV !== "production";

/* Header the reverse proxy sets with the real client IP (used for rate limiting
   + abuse tagging). Empty = auto-detect (cf-connecting-ip → x-real-ip →
   x-forwarded-for). Behind Cloudflare, set CLIENT_IP_HEADER=cf-connecting-ip so
   a spoofed x-forwarded-for can't dodge the limiter. */
export const CLIENT_IP_HEADER = (process.env.CLIENT_IP_HEADER ?? "").toLowerCase();

/*
 * Path constants. This file lives at backend/src/config/constants.ts, so
 * import.meta.dir === <repo>/backend/src/config.
 *   ../../  -> <repo>/backend          (ROOT_DIR)
 *   ../../../data -> <repo>/data       (DATA_DIR, sibling of backend/)
 */
export const ROOT_DIR = path.resolve(import.meta.dir, "../..");
export const DATA_DIR = path.resolve(import.meta.dir, "../../../data");

/* Friend & owner asset trees inside data/. */
export const FRIENDS_DIR = path.join(DATA_DIR, "friends");
export const OWNER_DIR = path.join(DATA_DIR, "owner");

/* Backend-local generated artefacts. */
export const CACHE_DIR = path.join(ROOT_DIR, "cache");
export const OG_CACHE_DIR = path.join(CACHE_DIR, "og");
export const DIST_DIR = path.join(ROOT_DIR, "dist");

/* Static assets bundled with the backend. */
export const FONTS_DIR = path.join(ROOT_DIR, "assets", "fonts");
export const TWEMOJI_DIR = path.join(ROOT_DIR, "assets", "twemoji");

/* Auth / admin. Telegram Login Widget verifies against the bot token; the owner
   (matched by Telegram username, case-insensitive, no @) can manage every page,
   a friend can edit only the page whose username matches their own. */
export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN ?? "";
export const TG_BOT_USERNAME = process.env.TG_BOT_USERNAME ?? "";
export const OWNER_TG_USERNAME = (process.env.OWNER_TG_USERNAME ?? "").replace(/^@/, "").toLowerCase();
/* JWT signing secret. In production a real secret is REQUIRED: refuse to boot on
   the insecure dev default (or a too-short value), because anyone who knows it
   could forge owner sessions. Local dev falls back to the dev default. */
const DEV_SESSION_SECRET = "dev-insecure-secret-change-me";
export const SESSION_SECRET = (() => {
    const secret = process.env.SESSION_SECRET ?? DEV_SESSION_SECRET;
    if (!IS_DEV && (secret === DEV_SESSION_SECRET || secret.length < 16)) {
        throw new Error(
            "SESSION_SECRET must be a long random string in production (the dev " +
                "default is insecure). Generate one with: openssl rand -base64 32",
        );
    }
    return secret;
})();
export const AUTH_TTL_DAYS = 30;

/* Gemini (Google AI Studio) — auto-translates user content between ru/en.
   Absent key disables auto-translation gracefully (content stays single-lang).
   `gemini-flash-latest` is an alias that tracks the current stable Flash model,
   so it won't 404 when a dated version is retired. */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/* SQLite database files. */
export const SCORES_DB_PATH = path.join(ROOT_DIR, "scores.db");
export const BIRTHDAYS_DB_PATH = path.join(ROOT_DIR, "birthdays.db");
export const HISTORY_DB_PATH = path.join(ROOT_DIR, "history.db");
export const SHOP_DB_PATH = path.join(ROOT_DIR, "shop.db");
