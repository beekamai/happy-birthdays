/* Server-authoritative scoring. The client no longer sends a score — it sends
   the raw play metrics (moves, hints, items caught) plus the play duration, and
   the server computes the score itself with the same formulas the games used to
   apply locally. This makes the score un-forgeable by tampering with the POST
   body: a cheat would have to fake plausible metrics AND beat the realism
   checks, which is far harder than POSTing a big number. */

/* Per-game realism ceilings. A play longer than the ceiling is rejected as
   absurd; there is deliberately no floor (a fast solve is legitimate and gets
   clamped, not rejected). `maxCaught` caps the catcher games' absolute item
   count, a second safety net on top of the per-second rate cap. */
const GAME_LIMITS: Record<
    string,
    { maxDurationMs: number; maxCaught?: number }
> = {
    "feed-fox": { maxDurationMs: 600_000, maxCaught: 3000 },
    "catch-stars": { maxDurationMs: 600_000, maxCaught: 3000 },
    "slide-puzzle": { maxDurationMs: 1_800_000 },
    memory: { maxDurationMs: 1_800_000 },
    maze: { maxDurationMs: 1_800_000 },
};

/* Catcher realism: nobody catches more than this many items per real second. */
const MAX_CATCH_PER_SEC = 4;

/* Points awarded per caught item, so the catcher games reward a comparable
   amount to the puzzle games (a good ~50-item run ≈ 750) instead of a token few. */
const CATCH_POINTS = 15;

/* A submission may claim a duration at most this much longer than the time that
   actually elapsed since the token was issued. Generous: it only needs to catch
   absurd claims, while absorbing a slow /start round-trip + clock skew so a
   legitimate play is never rejected. */
const SLACK_MS = 15_000;

/** Coerce an unknown meta field to a finite, non-negative integer (0 on junk). */
function asCount(v: unknown): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Max items the catcher games may credit for a play of `durationMs`. */
function catchCap(gameId: string, durationMs: number): number {
    const limit = GAME_LIMITS[gameId];
    const byTime = Math.ceil(durationMs / 1000) * MAX_CATCH_PER_SEC;
    const absolute = limit?.maxCaught ?? byTime;
    return Math.min(byTime, absolute);
}

/**
 * Compute the authoritative score for a play from its game, duration, and raw
 * metrics. Unknown games score 0. Mirrors the games' former local formulas.
 */
export function computeScore(
    gameId: string,
    durationMs: number,
    meta: Record<string, unknown> | undefined,
): number {
    const m = meta ?? {};
    switch (gameId) {
        case "memory":
            return Math.max(0, 1000 - asCount(m.moves) * 20);
        case "slide-puzzle":
            return Math.max(50, 1000 - asCount(m.moves) * 10 - asCount(m.hintsUsed) * 20);
        case "maze":
            return Math.max(300, 1000 - Math.floor(durationMs / 120));
        case "feed-fox":
        case "catch-stars":
            return Math.min(asCount(m.caught), catchCap(gameId, durationMs)) * CATCH_POINTS;
        default:
            return 0;
    }
}

/**
 * Whether a play is realistic enough to record. Checks the duration is in the
 * game's bounds, that the claimed duration didn't exceed the real wall-clock
 * since the token was issued (`elapsedMs`), and that the metrics aren't absurd.
 */
export function validatePlay(
    gameId: string,
    durationMs: number,
    elapsedMs: number,
    _meta: Record<string, unknown> | undefined,
): boolean {
    const limit = GAME_LIMITS[gameId];
    if (!limit) return false; /* unknown game → reject */

    /* Only reject the genuinely impossible. Soft signals (a very fast solve, an
       unusually high catch count) are CLAMPED by computeScore, never rejected —
       so a skilled or lucky legitimate play is always recorded. The real guards
       are the one-time signed token (anti-replay/curl) and the timing check. */
    if (!Number.isFinite(durationMs) || durationMs < 0) return false;
    if (durationMs > limit.maxDurationMs) return false;

    /* Can't claim a play longer than the wall-clock since the token was issued
       (plus generous slack for a slow start / clock skew). */
    if (!Number.isFinite(elapsedMs) || durationMs > elapsedMs + SLACK_MS) return false;

    return true;
}
