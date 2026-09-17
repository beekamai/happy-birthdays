/* Native-fetch helpers for the casino. Like the score endpoints these are
   anonymous and keyed by the localStorage `visitorId` — no session cookie, so no
   `credentials: "include"`. Every number here is the SERVER's: the client picks
   a side and a stake, the server rolls, settles, and returns the fresh wallet.
   Reads fall back to null; writes surface the HTTP status so the UI can toast
   402 (not enough points) / 429 (bonus already claimed) distinctly. */

export type CasinoGameId = "coin" | "dice" | "slots";

/** How a spin ended; also the suffix of its i18n key. */
export type OutcomeKind = "jackpot" | "triple" | "pair" | "win" | "lose";

export interface CasinoGame {
  id: CasinoGameId;
  /** Ids the player may bet on, or `[]` when the table takes no pick (slots). */
  picks: string[];
  /** Every symbol the table can roll. */
  symbols: string[];
  /** Payout table, highest multiplier first. */
  payouts: { kind: OutcomeKind; multiplier: number }[];
}

export interface SpinOutcome {
  gameId: CasinoGameId;
  /** What the house rolled: one face for coin/dice, three symbols for slots. */
  roll: string[];
  kind: OutcomeKind;
  multiplier: number;
  /** Points paid back for the spin. */
  payout: number;
  /** Signed balance change, `payout − bet`. */
  delta: number;
}

export interface CasinoStats {
  plays: number;
  wagered: number;
  won: number;
  donated: number;
  bonused: number;
}

export interface CasinoState {
  /** Points the visitor earned themselves on this page (best run per game). */
  earned: number;
  /** What they can stake or gift right now. */
  balance: number;
  stats: CasinoStats;
  bonus: { amount: number; available: boolean; nextAt: number };
  limits: { minBet: number; maxBet: number; minDonation: number };
}

/** A spin's response: the roll plus the wallet it left behind. */
export interface BetResult extends CasinoState {
  ok: true;
  outcome: SpinOutcome;
}

/** A settled gift: the wallet after it, plus the page's donated total. */
export interface DonateResult extends CasinoState {
  ok: true;
  amount: number;
  pageDonated: number;
}

/** A failed write carrying the HTTP status so callers can pick a message. */
export interface CasinoError {
  error: true;
  status: number;
}

/** True when a write came back as an error rather than a fresh state. */
export function isCasinoError(res: unknown): res is CasinoError {
  return typeof res === "object" && res !== null && "error" in res;
}

async function post<T>(url: string, body: unknown): Promise<T | CasinoError> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { error: true, status: res.status };
    return (await res.json()) as T;
  } catch {
    return { error: true, status: 0 };
  }
}

/** Fetch the tables and their payout multipliers. Returns `[]` on error. */
export async function fetchCasinoGames(): Promise<CasinoGame[]> {
  try {
    const res = await fetch("/api/casino/games");
    if (!res.ok) return [];
    const body = (await res.json()) as { games?: CasinoGame[] };
    return body.games ?? [];
  } catch {
    return [];
  }
}

/** Fetch a visitor's chips, bonus and stats on a page. `null` on error. */
export async function fetchCasinoState(
  slug: string,
  visitorId: string,
): Promise<CasinoState | null> {
  try {
    const res = await fetch(
      `/api/casino/${encodeURIComponent(slug)}?visitorId=${encodeURIComponent(visitorId)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as CasinoState;
  } catch {
    return null;
  }
}

/**
 * Stake points on a table. The server rolls; `pick` is ignored by tables that
 * take no pick. Returns the outcome + fresh wallet, or a `CasinoError` (402 not
 * enough points, 403 page closed, 429 rate-limited).
 */
export function placeBet(
  slug: string,
  visitorId: string,
  gameId: CasinoGameId,
  bet: number,
  pick: string,
): Promise<BetResult | CasinoError> {
  return post<BetResult>(`/api/casino/${encodeURIComponent(slug)}/bet`, {
    visitorId,
    gameId,
    bet,
    pick,
  });
}

/** Claim the once-a-day free chips. `CasinoError` with 429 when already taken. */
export function claimBonus(
  slug: string,
  visitorId: string,
): Promise<(CasinoState & { ok: true; amount: number }) | CasinoError> {
  return post(`/api/casino/${encodeURIComponent(slug)}/bonus`, { visitorId });
}

/**
 * Gift personal points into the friend's shop wallet. One-way and final —
 * confirm with the player first. `CasinoError` with 402 when short.
 */
export function donatePoints(
  slug: string,
  visitorId: string,
  amount: number,
): Promise<DonateResult | CasinoError> {
  return post<DonateResult>(`/api/casino/${encodeURIComponent(slug)}/donate`, {
    visitorId,
    amount,
  });
}
