import type { FriendConfig } from "../models/Friend";

/* A gift in its on-disk shape — covers both `cfg.gift` and a `giftHistory`
   entry (history items add an optional `date`, and their `emoji` is optional). */
type GiftLike = {
    name: string;
    emoji?: string;
    lottie?: string;
    imagePath?: string;
    link?: string;
    date?: string;
};

/*
 * The gift to feature as the "current" one. Prefer the explicitly-set
 * `cfg.gift`; otherwise, when the owner never marked a current gift but a
 * history exists, fall back to the most recent history entry (by date) so a
 * `giftDisplay: "current"` page still shows a gift instead of nothing. Legacy
 * configs that only ever populated `giftHistory` (e.g. via the add-gift CLI)
 * are covered automatically, without touching their data.
 */
export function resolveCurrentGift(cfg: FriendConfig): GiftLike | undefined {
    if (cfg.gift) return cfg.gift;
    const history = cfg.giftHistory ?? [];
    if (history.length === 0) return undefined;
    return [...history].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).at(-1);
}

/*
 * The "past" gifts shown on the locked page: the history minus the explicitly
 * featured gift, so a deliberately-set current gift stays a surprise until the
 * birthday. When no current gift is marked, the WHOLE history shows (a lone,
 * un-marked gift is an ordinary gift, not a hidden surprise). Pass the explicit
 * `cfg.gift` here — not a fallback — so only an intentional choice hides a gift.
 * Matched by name (a gift's name is its user-facing identity).
 */
export function pastGifts<T extends { name: string }>(
    history: T[],
    featured: { name: string } | undefined,
): T[] {
    if (!featured) return history;
    return history.filter((g) => g.name !== featured.name);
}
