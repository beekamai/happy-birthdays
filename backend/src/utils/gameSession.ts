import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { SESSION_SECRET } from "../config/constants";

/* Anti-cheat for game scores. A raw POST to /api/scores could previously claim
   any number. Now a score must carry a one-time, server-signed token issued by
   POST /api/games/start, bound to {slug, gameId, visitorId} and short-lived, AND
   the score/duration must be plausible for that game. None of this makes a
   client game un-cheatable (a determined player can still submit a believable
   fake), but it blocks trivial curl-inflation and replays. */

const TOKEN_TTL_MS = 30 * 60_000; /* a play must be submitted within 30 min */

export interface GameTokenPayload {
    slug: string;
    gameId: string;
    visitorId: string;
    iat: number;
    nonce: string;
}

/* Per-game plausibility bounds. Scores above max or plays shorter than the floor
   are rejected. Bounds are generous — they only catch the absurd. */
const GAME_LIMITS: Record<string, { maxScore: number; minDurationMs: number }> = {
    "feed-fox": { maxScore: 3000, minDurationMs: 8000 },
    "catch-stars": { maxScore: 3000, minDurationMs: 8000 },
    "slide-puzzle": { maxScore: 1000, minDurationMs: 2000 },
    memory: { maxScore: 1000, minDurationMs: 2500 },
    maze: { maxScore: 1000, minDurationMs: 1500 },
};

const b64url = (buf: Buffer | string) =>
    Buffer.from(buf).toString("base64url");

function hmac(data: string): string {
    return createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

/** Issue a signed one-time token for a play. */
export function signGameToken(
    slug: string,
    gameId: string,
    visitorId: string,
): string {
    const payload: GameTokenPayload = {
        slug,
        gameId,
        visitorId,
        iat: Date.now(),
        nonce: randomBytes(12).toString("hex"),
    };
    const body = b64url(JSON.stringify(payload));
    return `${body}.${hmac(body)}`;
}

/** Verify a token's signature + freshness. Returns the payload or null. */
export function verifyGameToken(token: unknown): GameTokenPayload | null {
    try {
        if (typeof token !== "string" || !token.includes(".")) return null;
        const [body, sig] = token.split(".");
        if (!body || !sig) return null;

        const expected = hmac(body);
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as GameTokenPayload;
        if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
        return payload;
    } catch {
        return null;
    }
}

/* One-time use: nonces consumed on a successful score submit, lazily purged. */
const usedNonces = new Map<string, number>();

function purge(now: number): void {
    if (usedNonces.size < 500) return;
    for (const [nonce, exp] of usedNonces) {
        if (exp < now) usedNonces.delete(nonce);
    }
}

/** Returns false if the nonce was already used; otherwise marks it used. */
export function consumeNonce(nonce: string): boolean {
    const now = Date.now();
    purge(now);
    if (usedNonces.has(nonce)) return false;
    usedNonces.set(nonce, now + TOKEN_TTL_MS);
    return true;
}

/** Whether a (score, duration) pair is plausible for the game. */
export function isPlausibleScore(gameId: string, score: number, durationMs: number): boolean {
    const limit = GAME_LIMITS[gameId];
    if (!limit) return false; /* unknown game → reject */
    if (!Number.isFinite(score) || score < 0 || score > limit.maxScore) return false;
    if (!Number.isFinite(durationMs) || durationMs < limit.minDurationMs) return false;
    return true;
}
