import type { SocialLink } from "../lib/types.ts";

/* A row of social/bio links rendered as cozy sticker pills. Each known platform
   gets an emoji glyph + a readable label; unknown platforms fall back to a
   generic link glyph and the host name. No icon library — just emoji. */

interface PlatformMeta {
  glyph: string;
  label: string;
}

const PLATFORMS: Record<string, PlatformMeta> = {
  telegram: { glyph: "✈️", label: "Telegram" },
  discord: { glyph: "🎮", label: "Discord" },
  x: { glyph: "🐦", label: "X" },
  twitter: { glyph: "🐦", label: "Twitter" },
  instagram: { glyph: "📷", label: "Instagram" },
  youtube: { glyph: "▶️", label: "YouTube" },
  twitch: { glyph: "🎬", label: "Twitch" },
  github: { glyph: "🐙", label: "GitHub" },
  vk: { glyph: "🅥", label: "VK" },
  tiktok: { glyph: "🎵", label: "TikTok" },
  steam: { glyph: "🕹️", label: "Steam" },
  website: { glyph: "🌐", label: "Website" },
  link: { glyph: "🔗", label: "Link" },
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function metaFor(link: SocialLink): PlatformMeta {
  const key = link.platform?.toLowerCase();
  if (key && PLATFORMS[key]) return PLATFORMS[key];
  return { glyph: "🔗", label: hostOf(link.url) };
}

/** Sticker-pill row of a friend's social links. Renders nothing when empty. */
export function SocialLinks({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {links.map((link, i) => {
        const meta = metaFor(link);
        return (
          <a
            key={`${link.platform}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.05] hover:border-[var(--color-accent)]"
          >
            <span aria-hidden="true">{meta.glyph}</span>
            {meta.label}
          </a>
        );
      })}
    </div>
  );
}
