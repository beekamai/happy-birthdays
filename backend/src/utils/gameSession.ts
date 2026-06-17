import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { SESSION_SECRET } from "../config/constants";

/* Anti-cheat for game scores. A raw POST to /api/scores could previously claim
   any number. Now a play must carry a one-time, server-signed token issued by
   POST /api/games/start, bound to {slug, gameId, visitorId} and short-lived, the
   raw metrics + duration must be plausible (see services/gameScoring), and the
   server computes the score itself. None of this makes a client game
   un-cheatable (a determined player can still submit believable fake metrics),
   but it blocks trivial curl-inflation and replays. */

const TOKEN_TTL_MS = 30 * 60_000; /* a play must be submitted within 30 min */

export interface GameTokenPayload {
    slug: string;
    gameId: string;
    visitorId: string;
    iat: number;
    nonce: string;
}

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

const NONCE_HARD_CAP = 50_000;
function purge(now: number): void {
    if (usedNonces.size < 500) return;
    for (const [nonce, exp] of usedNonces) {
        if (exp < now) usedNonces.delete(nonce);
    }
    /* Backstop against a flood arriving faster than nonces expire: if live ones
       still exceed the cap, evict the oldest so memory stays bounded. */
    if (usedNonces.size > NONCE_HARD_CAP) {
        const oldest = [...usedNonces.entries()].sort((a, b) => a[1] - b[1]);
        const excess = usedNonces.size - NONCE_HARD_CAP;
        for (let i = 0; i < excess; i++) usedNonces.delete(oldest[i]![0]);
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
