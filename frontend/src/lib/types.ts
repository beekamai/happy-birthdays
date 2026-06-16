/* Shared data contract — mirrors backend/src/models/Friend.ts.
   Keep these shapes byte-for-byte in sync with the backend's public payloads. */

export type AccessState = "open" | "closing" | "locked";

export interface AccessInfo {
  state: AccessState;
  daysUntilBirthday: number;
  closesInDays: number;
}

export interface PublicFriend {
  slug: string;
  username: string; /* "@alumi" */
  displayName: string; /* "Алуми" */
  birthday: { month: number; day: number; year?: number };
  message: string;
  accent: string; /* hex, per-friend accent override */
  gift?: {
    name: string;
    emoji: string;
    lottie?: string;
    imageUrl?: string;
    link?: string; /* clickable source, e.g. t.me/nft/... */
  };
  games: { gameId: string; config?: Record<string, unknown> }[];
  avatarUrl: string; /* "/friends/<slug>/<file>" */
  puzzleAvatarUrl?: string;
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
  /* Personal profile (shown on /u/<slug>). */
  bio?: string;
  socials?: SocialLink[];
  /* Localized variants of displayName/message/giftName/bio for the non-source
     language; the client picks per the visitor's active language. */
  translations?: Partial<Record<"ru" | "en", FriendTranslations>>;
  access: AccessInfo;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface FriendTranslations {
  displayName?: string;
  message?: string;
  giftName?: string;
  bio?: string;
}

export interface SiteConfig {
  owner: { displayName: string; avatarUrl: string };
  baseUrl: string;
}
