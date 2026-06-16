import type { PublicFriend, SiteConfig } from "./types.ts";

/* Native-fetch API helpers. In dev these hit Vite's proxy to the backend on
   :3000; in prod they hit the same Elysia process serving the SPA. */

/**
 * Fetch a single friend's public payload.
 * @returns the friend, or `null` on 404 / network error.
 */
export async function fetchFriend(slug: string): Promise<PublicFriend | null> {
  try {
    const res = await fetch(`/api/friend/${encodeURIComponent(slug)}`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PublicFriend;
  } catch {
    return null;
  }
}

/**
 * Fetch global site config (owner + base URL).
 * @returns the config, or `null` on failure.
 */
export async function fetchSite(): Promise<SiteConfig | null> {
  try {
    const res = await fetch("/api/site");
    if (!res.ok) return null;
    return (await res.json()) as SiteConfig;
  } catch {
    return null;
  }
}

/**
 * Fetch public site stats (count of published birthday pages).
 * @returns the count, or `null` on failure.
 */
export async function fetchStats(): Promise<{ pages: number } | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    return (await res.json()) as { pages: number };
  } catch {
    return null;
  }
}

export interface ScorePayload {
  gameId: string;
  score: number;
  durationMs: number;
}

export interface GameBest {
  gameId: string;
  best: number;
}

export interface Totals {
  total: number;
  games: GameBest[];
}

export interface ScoreResult {
  ok: boolean;
  /** This visitor's best score for the game just played (authoritative). */
  gameBest: number;
  /** This visitor's totals on the page. */
  personal: Totals;
  /** Page-wide totals across all visitors. */
  global: Totals;
}

export interface DualTotals {
  personal: Totals;
  global: Totals;
}

/**
 * Begin a play and obtain a one-time score token. The token must accompany the
 * score; without it the server rejects the submission (anti-cheat). Returns the
 * token, or null on failure.
 */
export async function startGame(
  slug: string,
  gameId: string,
  visitorId: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/games/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, gameId, visitorId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Submit a game score for a visitor with the play's token. The SERVER verifies
 * the token + plausibility, clamps, and returns the authoritative personal +
 * global aggregates, so the UI shows the server's numbers. Returns null on
 * failure (rejected token, implausible score, network).
 */
export async function postScore(
  slug: string,
  visitorId: string,
  payload: ScorePayload,
  token: string | null,
): Promise<ScoreResult | null> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, visitorId, token, ...payload }),
      keepalive: true,
    });
    if (!res.ok) return null;
    return (await res.json()) as ScoreResult;
  } catch {
    return null;
  }
}

/** Fetch authoritative personal + global totals for a friend page. */
export async function fetchTotals(
  slug: string,
  visitorId: string,
): Promise<DualTotals | null> {
  try {
    const res = await fetch(
      `/api/scores/${encodeURIComponent(slug)}?visitorId=${encodeURIComponent(visitorId)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as DualTotals;
  } catch {
    return null;
  }
}
