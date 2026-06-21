/* Map the live editor form (FriendConfig) to the PublicFriend shape the public
   pages render — so the editor preview can show unsaved edits, even before the
   first save. This MIRRORS the backend's single source of truth
   (FriendRepository.toPublicFriend / buildGiftHistory + utils/gift.resolveCurrentGift
   + utils/access.computeAccess): same defaults, same gift fallback, same
   imagePath→imageUrl rule, same translations passthrough. Keep it in sync with
   that file. Avatar + slug + access come from the caller (the editor knows the
   pending blob URL and the chosen view), so this stays a pure mapper. */

import type { FriendConfig, GiftConfig } from "./adminApi.ts";
import type { AccessInfo, PublicFriend } from "../lib/types.ts";

const DEFAULT_ACCENT = "#7ec2e8";
const DAY_MS = 86_400_000;
const ACCESS_WINDOW_DAYS = 2;

/* Parse "MM-DD" or "YYYY-MM-DD" into month/day(/year). Mirrors the backend
   schema's parseBirthday, but degrades to Jan 1 on a malformed value instead of
   throwing — the editor previews half-typed dates and must never crash. */
function parseBirthday(raw: string): { month: number; day: number; year?: number } {
  const trimmed = (raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  const md = /^(\d{2})-(\d{2})$/.exec(trimmed);
  if (md) return { month: Number(md[1]), day: Number(md[2]) };
  return { month: 1, day: 1 };
}

/* Days until the next occurrence of month/day (0 on the birthday itself).
   Mirrors computeAccess's countdown branch. */
function daysUntil(month: number, day: number, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return Math.round((next.getTime() - today.getTime()) / DAY_MS);
}

/* The featured "current" gift: explicit cfg.gift wins, else the most recent
   history entry by date. Mirrors utils/gift.resolveCurrentGift. */
function resolveCurrentGift(cfg: FriendConfig): GiftConfig | undefined {
  if (cfg.gift) return cfg.gift;
  const history = cfg.giftHistory ?? [];
  if (history.length === 0) return undefined;
  return [...history].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).at(-1);
}

/* Gift history → public shape, sorted by date asc, imagePath→imageUrl. Mirrors
   FriendRepository.buildGiftHistory. */
function buildGiftHistory(
  cfg: FriendConfig,
  slug: string,
): NonNullable<PublicFriend["giftHistory"]> {
  return (cfg.giftHistory ?? [])
    .filter((g) => g.name.trim())
    .map((g) => ({
      name: g.name,
      ...(g.emoji ? { emoji: g.emoji } : {}),
      ...(g.lottie ? { lottie: g.lottie } : {}),
      ...(g.link ? { link: g.link } : {}),
      ...(g.imagePath ? { imageUrl: assetUrl(slug, g.imagePath) } : {}),
      ...(g.date ? { date: g.date } : {}),
    }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

/* A saved gift image lives under the friend dir; a pending (data:/blob:) path is
   used verbatim. The editor only ever has saved imagePaths here, so this matches
   the backend's `/friends/<slug>/<file>` rule when a slug exists. */
function assetUrl(slug: string, file: string): string {
  if (/^(https?:|data:|blob:)/.test(file)) return file;
  return slug ? `/friends/${slug}/${file}` : file;
}

interface ToPublicOpts {
  /** The slug being edited (empty in create mode, before the first save). */
  slug?: string;
  /** Resolved avatar URL: a pending blob, a saved file URL, or a placeholder. */
  avatarUrl: string;
  /** The access window the preview should reflect (driven by the view toggle). */
  access: AccessInfo;
}

/** Build the access info for a "locked" preview: countdown to the next birthday. */
export function lockedAccess(birthday: string): AccessInfo {
  const { month, day } = parseBirthday(birthday);
  return {
    state: "locked",
    daysUntilBirthday: daysUntil(month, day),
    closesInDays: 0,
  };
}

/** Build the access info for an "open" preview: the celebration is live today. */
export function openAccess(birthday: string): AccessInfo {
  const { month, day } = parseBirthday(birthday);
  return {
    state: "open",
    daysUntilBirthday: daysUntil(month, day),
    closesInDays: ACCESS_WINDOW_DAYS + 1,
  };
}

/**
 * Map the editor form to the PublicFriend the public pages consume. Pure mapper:
 * the caller supplies the resolved avatar URL, the slug, and the access window
 * (so the open/locked preview toggle can drive the celebration state).
 */
export function configToPublicFriend(
  cfg: FriendConfig,
  opts: ToPublicOpts,
): PublicFriend {
  const slug = opts.slug ?? "";
  const birthday = parseBirthday(cfg.birthday);
  const gamesEnabled = cfg.gamesEnabled ?? true;
  const giftHistory = buildGiftHistory(cfg, slug);

  const current = resolveCurrentGift(cfg);
  const gift: PublicFriend["gift"] = current
    ? {
        name: current.name,
        emoji: current.emoji ?? "🎁",
        ...(current.lottie ? { lottie: current.lottie } : {}),
        ...(current.imagePath ? { imageUrl: assetUrl(slug, current.imagePath) } : {}),
        ...(current.link ? { link: current.link } : {}),
      }
    : undefined;

  const locked = opts.access.state === "locked";

  /* Locked pages hide the greeting (and its translations), the games and the
     featured gift card — only the teaser list survives. Mirrors the backend. */
  const friend: PublicFriend = {
    slug,
    username: cfg.username,
    displayName: cfg.displayName,
    birthday,
    message: locked ? "" : cfg.message,
    accent: cfg.accent || DEFAULT_ACCENT,
    games: gamesEnabled && !locked ? cfg.games : [],
    avatarUrl: opts.avatarUrl,
    ...(giftHistory.length ? { giftHistory } : {}),
    gamesEnabled,
    giftDisplay: cfg.giftDisplay ?? "current",
    giftLayout: cfg.giftLayout ?? "list",
    lang: cfg.lang ?? "ru",
    theme: cfg.theme ?? "light",
    ...(cfg.bio ? { bio: cfg.bio } : {}),
    ...(cfg.socials?.length ? { socials: cfg.socials } : {}),
    ...(cfg.socialStyle ? { socialStyle: cfg.socialStyle } : {}),
    ...(cfg.translations ? { translations: stripLockedTranslations(cfg.translations, locked) } : {}),
    access: opts.access,
  };

  if (!locked && gift) friend.gift = gift;

  return friend;
}

/* Drop the `message` variant from every locale on a locked preview, matching the
   backend's buildTranslations(hideMessage) so the teaser never leaks the
   translated greeting. */
function stripLockedTranslations(
  translations: NonNullable<FriendConfig["translations"]>,
  locked: boolean,
): PublicFriend["translations"] {
  if (!locked) return translations;
  const out: NonNullable<PublicFriend["translations"]> = {};
  for (const lang of ["ru", "en"] as const) {
    const tr = translations[lang];
    if (!tr) continue;
    const { message: _drop, ...rest } = tr;
    if (Object.keys(rest).length > 0) out[lang] = rest;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
