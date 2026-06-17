/* In-memory fixed-window rate limiter for a single self-hosted instance — no
   external store needed. `rateLimit(opts)` returns an Elysia beforeHandle guard;
   exceeding a window's limit short-circuits with 429 (errors are >= 300 so the
   response filter passes them through untouched). Buckets are namespaced by
   `tag` so different routes keep separate counters, and swept lazily so the map
   can't grow without bound. */

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/* Drop expired buckets at most once a minute (cheap, keeps the map bounded). */
function sweep(now: number): void {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [key, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(key);
    }
}

/* Behind a reverse proxy the real client IP is in X-Forwarded-For. */
function clientIp(headers: Record<string, string | undefined>): string {
    const xff = headers["x-forwarded-for"];
    if (xff) return xff.split(",")[0]!.trim();
    return headers["x-real-ip"] ?? "unknown";
}

interface RateLimitOptions {
    /** Namespaces the counter so routes don't share a bucket. */
    tag: string;
    limit: number;
    windowMs: number;
    /** Key the limit by something other than the client IP (e.g. the user). */
    by?: (ctx: any) => string;
}

/** Fixed-window rate-limit guard for a route's `beforeHandle`. */
export function rateLimit(opts: RateLimitOptions) {
    return (ctx: any) => {
        const now = Date.now();
        sweep(now);
        const who = opts.by ? opts.by(ctx) : clientIp(ctx.headers ?? {});
        const key = `${opts.tag}:${who}`;
        const b = buckets.get(key);
        if (!b || b.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
            return;
        }
        if (b.count >= opts.limit) {
            ctx.set.status = 429;
            return { error: "Too many requests" };
        }
        b.count += 1;
    };
}
