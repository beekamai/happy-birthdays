import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/* Verify a Telegram Login Widget payload per the official algorithm:
   secret = SHA256(bot_token); hmac = HMAC_SHA256(data_check_string, secret),
   where data_check_string is every field except `hash`, sorted by key and
   joined as "key=value" with newlines. Also rejects stale auth_date. */

export interface TelegramAuthData {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number | string;
    hash: string;
    [key: string]: unknown;
}

const MAX_AGE_SECONDS = 86_400; /* 1 day */

export function verifyTelegramAuth(
    data: TelegramAuthData,
    botToken: string,
): boolean {
    try {
        if (!botToken || !data?.hash) return false;

        const { hash, ...fields } = data;
        const checkString = Object.keys(fields)
            .filter((k) => fields[k] !== undefined && fields[k] !== null)
            .sort()
            .map((k) => `${k}=${fields[k]}`)
            .join("\n");

        const secret = createHash("sha256").update(botToken).digest();
        const hmac = createHmac("sha256", secret).update(checkString).digest("hex");

        const a = Buffer.from(hmac, "hex");
        const b = Buffer.from(String(hash), "hex");
        if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

        /* Reject replayed / stale logins. */
        const authDate = Number(data.auth_date);
        if (!Number.isFinite(authDate)) return false;
        const ageSec = Date.now() / 1000 - authDate;
        return ageSec >= 0 && ageSec < MAX_AGE_SECONDS;
    } catch {
        return false;
    }
}
