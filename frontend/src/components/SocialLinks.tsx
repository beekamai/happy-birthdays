import type { SocialLink } from "../lib/types.ts";
import { socialIcon, socialLabel } from "./socialIcons.tsx";

/* A row of social/bio links rendered as cozy sticker pills. Three styles:
   - "icon" (default): a brand glyph (currentColor, theme-tinted) + a readable
     label per link.
   - "iconOnly": the brand glyph alone, no label.
   - "text": a flat label-only pill, no glyph.
   Unknown platforms fall back to a globe glyph + the host name. */

/** Sticker-pill row of a friend's social links. Renders nothing when empty. */
export function SocialLinks({
  links,
  style = "icon",
}: {
  links: SocialLink[];
  style?: "icon" | "iconOnly" | "text";
}) {
  if (!links.length) return null;

  /* iconOnly pills are compact 44x44 circles (touch-friendly, label-less);
     icon/text pills are roomy and read left-to-right with a label. */
  const iconOnly = style === "iconOnly";
  const shapeClasses = iconOnly
    ? "size-11 justify-center rounded-full"
    : "gap-2 rounded-[var(--radius-full)] px-4 py-2";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {links.map((link, i) => {
        const label = socialLabel(link.platform, link.url);
        return (
          <a
            key={`${link.platform}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            className={`inline-flex items-center border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.05] hover:border-[var(--color-accent)] ${shapeClasses}`}
          >
            {style !== "text" && socialIcon(link.platform)}
            {!iconOnly && label}
          </a>
        );
      })}
    </div>
  );
}
