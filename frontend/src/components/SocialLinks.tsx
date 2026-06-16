import type { SocialLink } from "../lib/types.ts";
import { socialIcon, socialLabel } from "./socialIcons.tsx";

/* A row of social/bio links rendered as cozy sticker pills. Two styles:
   - "icon" (default): a brand glyph (currentColor, theme-tinted) + a readable
     label per link.
   - "text": a flat label-only pill, no glyph.
   Unknown platforms fall back to a globe glyph + the host name. */

/** Sticker-pill row of a friend's social links. Renders nothing when empty. */
export function SocialLinks({
  links,
  style = "icon",
}: {
  links: SocialLink[];
  style?: "icon" | "text";
}) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {links.map((link, i) => (
        <a
          key={`${link.platform}-${i}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.05] hover:border-[var(--color-accent)]"
        >
          {style === "icon" && socialIcon(link.platform)}
          {socialLabel(link.platform, link.url)}
        </a>
      ))}
    </div>
  );
}
