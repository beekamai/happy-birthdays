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
    /* Access window (open / closing / locked) computed from the birthday. */
    access: AccessInfo;
}

/* Site-level config (data/site.json), public shape. */
export interface SiteConfig {
    owner: { displayName: string; avatarUrl: string };
    baseUrl: string;
}
