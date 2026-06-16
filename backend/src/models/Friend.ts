import type { AccessInfo } from "../utils/access";

/* On-disk friend config (data/friends/<slug>/config.json). */
export interface FriendConfig {
    username: string;
    displayName: string;
    /* "MM-DD" or full ISO "YYYY-MM-DD". */
    birthday: string;
    message: string;
    /* Hex override; defaults to DEFAULT_ACCENT when absent. */
    accent?: string;
    gift?: {
        name: string;
        emoji: string;
        lottie?: string;
        imagePath?: string;
        /* Clickable source link, e.g. https://t.me/nft/InstantRamen-349224 */
        link?: string;
    };
    games: { gameId: string; config?: Record<string, unknown> }[];
    /* Main / OG avatar filename, e.g. "avatar2.jpg". */
    avatar: string;
    /* Slide-puzzle avatar filename, e.g. "avatar1.jpg". */
    puzzleAvatar?: string;
    /* Past gifts (history). The current `gift` is also folded into history. */
    giftHistory?: {
        name: string;
        emoji?: string;
        lottie?: string;
        link?: string;
        imagePath?: string;
        date?: string;
    }[];
    /* Owner/friend-tunable display settings. */
    gamesEnabled?: boolean; /* default true; off hides games + score badges */
    giftDisplay?: "current" | "all"; /* in-window: single current gift or full list */
    giftLayout?: "list" | "blocks"; /* how the gift list is rendered */
    lang?: "ru" | "en"; /* default page language (visitor can switch) */
    theme?: "light" | "dark" | "halloween" | "newyear"; /* default page theme */
    /* Personal profile (shown on /u/<slug>, independent of the birthday window). */
    bio?: string;
    socials?: SocialLink[];
    /* Equipped shop decorations (one per slot). Ownership lives in the shop DB;
       this only records which owned item is currently applied to the pages. */
    decor?: Decor;
    /* Localized variants of the user-authored fields, keyed by target language.
       The authored fields above are in `lang`; the other language is auto-filled
       by Gemini on save and may be hand-edited. */
    translations?: Partial<Record<"ru" | "en", FriendTranslations>>;
}

/* A social/bio link. `platform` is a known key (telegram, discord, x, ...) used
   to pick an icon; unknown keys fall back to a generic link glyph. */
export interface SocialLink {
    platform: string;
    url: string;
}

/* Equipped decoration ids, one per slot. Each value is a shop item id the
   friend owns; absent = nothing equipped in that slot. */
export interface Decor {
    avatarFrame?: string;
    background?: string;
    badge?: string;
    effect?: string;
}

/* Translatable user content (per language). Missing fields fall back to the
   authored value in the page's source `lang`. */
export interface FriendTranslations {
    displayName?: string;
    message?: string;
    giftName?: string;
    bio?: string;
}

/* Parsed birthday components. `year` present only for full ISO dates. */
export interface ParsedBirthday {
    month: number;
    day: number;
    year?: number;
}

/* Public-facing friend shape exposed to the client (API + page injection). */
export interface PublicFriend {
    slug: string;
    username: string;
    displayName: string;
    birthday: ParsedBirthday;
    message: string;
    accent: string;
    gift?: {
        name: string;
        emoji: string;
        lottie?: string;
        imageUrl?: string;
        link?: string;
    };
    games: { gameId: string; config?: Record<string, unknown> }[];
    avatarUrl: string;
    puzzleAvatarUrl?: string;
    /* Full gift history (sorted by date), shown as a list outside the window. */
    giftHistory?: {
        name: string;
        emoji?: string;
        lottie?: string;
        link?: string;
        imageUrl?: string;
        date?: string;
    }[];
    gamesEnabled: boolean;
    giftDisplay: "current" | "all";
    giftLayout: "list" | "blocks";
    lang: "ru" | "en";
    theme: "light" | "dark" | "halloween" | "newyear";
    /* Personal profile fields (always present; the profile page is not gated). */
    bio?: string;
    socials?: SocialLink[];
    /* Equipped shop decorations applied to both pages. */
    decor?: Decor;
    /* Localized variants of displayName/message/giftName/bio (other language than
       `lang`); the client picks per the visitor's active language. */
    translations?: Partial<Record<"ru" | "en", FriendTranslations>>;
    /* Access window (open / closing / locked) computed from the birthday. */
    access: AccessInfo;
}

/* Site-level config (data/site.json), public shape. */
export interface SiteConfig {
    owner: { displayName: string; avatarUrl: string };
    baseUrl: string;
}
