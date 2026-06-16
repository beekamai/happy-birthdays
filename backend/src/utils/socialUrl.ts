/* Normalisation + validation for friend social links. A raw value like
   "yumssee.t.me" (no scheme) is otherwise treated by the browser as a RELATIVE
   path and resolves to https://<our-site>/u/yumssee.t.me — both broken and a mild
   open-redirect-ish footgun. We force an absolute https URL, require http(s), and
   (for known platforms) require the host to belong to that service. */

/* Allowed hostnames per platform. A host matches if it equals the domain or is a
   subdomain of it. Platforms not listed (website / link / unknown) accept any
   valid http(s) host. */
const PLATFORM_DOMAINS: Record<string, string[]> = {
    telegram: ["t.me", "telegram.me", "telegram.org"],
    discord: ["discord.gg", "discord.com", "discordapp.com"],
    x: ["x.com", "twitter.com"],
    twitter: ["x.com", "twitter.com"],
    instagram: ["instagram.com"],
    youtube: ["youtube.com", "youtu.be"],
    twitch: ["twitch.tv"],
    github: ["github.com"],
    vk: ["vk.com", "vk.ru"],
    tiktok: ["tiktok.com"],
    steam: ["steamcommunity.com", "store.steampowered.com"],
};

/**
 * Normalise + validate a social URL for a platform. Returns an absolute https(p)
 * URL string, or null when it's not a usable http(s) link (or doesn't belong to
 * the named platform's domain). Forcing a scheme prevents the relative-link
 * footgun where "name.t.me" would resolve under our own origin.
 */
export function normalizeSocialUrl(platform: string, rawUrl: string): string | null {
    let s = (rawUrl ?? "").trim();
    if (!s) return null;

    /* Add a scheme if missing so it's always treated as an absolute URL. */
    if (/^\/\//.test(s)) s = `https:${s}`;
    else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;

    let u: URL;
    try {
        u = new URL(s);
    } catch {
        return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;

    const domains = PLATFORM_DOMAINS[platform.toLowerCase()];
    if (domains) {
        const host = u.hostname.toLowerCase();
        const ok = domains.some((d) => host === d || host.endsWith(`.${d}`));
        if (!ok) return null;
    }
    return u.toString();
}
