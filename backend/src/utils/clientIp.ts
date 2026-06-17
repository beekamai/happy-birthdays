import { CLIENT_IP_HEADER } from "../config/constants";

/*
 * Resolve the real client IP from proxy headers. Priority:
 *   1. an explicitly configured trusted header (CLIENT_IP_HEADER env),
 *   2. Cloudflare's `cf-connecting-ip`,
 *   3. `x-real-ip`,
 *   4. the first `x-forwarded-for` hop.
 * Returns "" when none are present (callers decide the fallback).
 *
 * SECURITY: these headers are only trustworthy when the origin is reachable
 * SOLELY through your reverse proxy (the app binds 127.0.0.1 by default) and the
 * proxy overwrites them from the real client. If the origin is exposed directly
 * (e.g. HOST=0.0.0.0 with no firewall), a client can FORGE x-forwarded-for to
 * dodge per-IP rate limits — keep it behind the proxy and set CLIENT_IP_HEADER
 * to the one header your proxy guarantees (e.g. cf-connecting-ip behind
 * Cloudflare, x-real-ip behind a plain nginx).
 */
export function clientIp(headers: Record<string, string | undefined>): string {
    const pick = (name: string): string => {
        const v = headers[name];
        return v ? v.split(",")[0]!.trim() : "";
    };
    if (CLIENT_IP_HEADER) {
        const explicit = pick(CLIENT_IP_HEADER);
        if (explicit) return explicit;
    }
    return pick("cf-connecting-ip") || pick("x-real-ip") || pick("x-forwarded-for");
}
