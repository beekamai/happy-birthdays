import type { CSSProperties, ReactNode } from "react";

/* Visual renderers for shop decorations, keyed by item id. The backend owns the
   catalogue economics (ids, costs, types); this is the matching client-side look.
   Four slots: avatarFrame (ring around the avatar), background (ambient page
   pattern), badge (emblem beside the name), effect (animated overlay). Anything
   without a known visual renders nothing — safe for forward-compatible ids. */

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ---- Avatar frame -------------------------------------------------------- */

/* Box-shadow ring applied directly to the avatar image so it tracks any bob. */
const FRAME_RING: Record<string, string> = {
  "frame-gold": "0 0 0 3px #f7d774, 0 0 16px 3px rgba(247,215,116,0.65)",
  "frame-neon":
    "0 0 0 3px var(--color-accent), 0 0 22px 5px color-mix(in srgb, var(--color-accent) 70%, transparent)",
};

export function frameShadow(id?: string): string | undefined {
  return id ? FRAME_RING[id] : undefined;
}

/* A ring of petals around the avatar (used by frame-flower). */
function FlowerPetals() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -ml-2.5 -mt-2.5 text-xl select-none"
          style={{ transform: `rotate(${i * 45}deg) translateY(-4.7rem)` }}
        >
          🌸
        </span>
      ))}
    </>
  );
}

interface DecoratedAvatarProps {
  src: string;
  alt: string;
  frameId?: string;
  animate?: boolean;
  grayscale?: boolean;
  className?: string;
}

/** Avatar image with its accent outline plus any equipped frame decoration. */
export function DecoratedAvatar({
  src,
  alt,
  frameId,
  animate = false,
  grayscale = false,
  className = "",
}: DecoratedAvatarProps) {
  const ring = frameShadow(frameId);
  const imgStyle: CSSProperties = {
    outline: "3px solid var(--color-accent)",
    outlineOffset: "3px",
    ...(ring ? { boxShadow: ring } : {}),
    ...(grayscale ? { filter: "grayscale(0.25)" } : {}),
  };
  return (
    <span className={`relative inline-block size-32 ${animate ? "animate-bob" : ""} ${className}`}>
      <img
        src={src}
        alt={alt}
        className="size-32 rounded-full border-[4px] border-white object-cover shadow-[var(--shadow-md)]"
        style={imgStyle}
      />
      {frameId === "frame-flower" && <FlowerPetals />}
    </span>
  );
}

/* ---- Badge --------------------------------------------------------------- */

const BADGE_EMOJI: Record<string, string> = {
  "badge-crown": "👑",
  "badge-star": "⭐",
  "badge-fire": "🔥",
};

export function badgeEmoji(id?: string): string | undefined {
  return id ? BADGE_EMOJI[id] : undefined;
}

/** A little emblem rendered beside the friend's name. */
export function DecorBadge({ id }: { id?: string }) {
  const emoji = badgeEmoji(id);
  if (!emoji) return null;
  return (
    <span aria-hidden="true" className="ml-1 align-middle select-none">
      {emoji}
    </span>
  );
}

/* ---- Background ---------------------------------------------------------- */

const BG_STYLE: Record<string, CSSProperties> = {
  "bg-stars": {
    backgroundImage: "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1.6px)",
    backgroundSize: "26px 26px",
  },
  "bg-confetti": {
    backgroundImage:
      "radial-gradient(var(--color-primary) 2px, transparent 2.5px), radial-gradient(var(--color-secondary) 2px, transparent 2.5px), radial-gradient(var(--color-ramen-gold) 2px, transparent 2.5px)",
    backgroundSize: "62px 62px, 84px 84px, 72px 72px",
    backgroundPosition: "0 0, 32px 22px, 16px 44px",
  },
  "bg-hearts": {
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><text x='4' y='30' font-size='22'>💗</text></svg>\")",
    backgroundSize: "44px 44px",
  },
};

export function backgroundStyle(id?: string): CSSProperties | undefined {
  return id ? BG_STYLE[id] : undefined;
}

/** A subtle full-page pattern layer behind the content. */
export function DecorBackground({ id }: { id?: string }) {
  const style = backgroundStyle(id);
  if (!style) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-35"
      style={style}
    />
  );
}

/* ---- Effect -------------------------------------------------------------- */

/* Ambient animated overlay; reuses the theme-decor keyframes (snow-fall for
   falling glyphs, twinkle for sparkles). Skipped under reduced-motion. */
function effectLayer(id: string): ReactNode {
  if (id === "fx-hearts") {
    return Array.from({ length: 12 }, (_, i) => (
      <span
        key={i}
        className="animate-snow-fall absolute top-0 select-none"
        style={{
          left: `${rand(0, 100)}%`,
          fontSize: `${rand(12, 22)}px`,
          opacity: rand(0.5, 0.9),
          animationDuration: `${rand(7, 13)}s`,
          animationDelay: `${rand(0, 9)}s`,
        }}
      >
        {Math.random() < 0.5 ? "💕" : "💗"}
      </span>
    ));
  }
  if (id === "fx-sparkles") {
    return Array.from({ length: 16 }, (_, i) => (
      <span
        key={i}
        className="animate-twinkle absolute select-none"
        style={{
          top: `${rand(2, 92)}%`,
          left: `${rand(0, 100)}%`,
          fontSize: `${rand(9, 17)}px`,
          animationDuration: `${rand(2.5, 5)}s`,
          animationDelay: `${rand(0, 4)}s`,
        }}
      >
        ✨
      </span>
    ));
  }
  return null;
}

/** Ambient effect overlay for the equipped effect decoration. */
export function DecorEffect({ id }: { id?: string }) {
  if (!id || reducedMotion()) return null;
  const layer = effectLayer(id);
  if (!layer) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {layer}
    </div>
  );
}

/* ---- Shop preview -------------------------------------------------------- */

/** A compact swatch previewing any catalogue item by id + slot, for the shop. */
export function DecorPreview({ id, type }: { id: string; type: string }) {
  if (type === "avatarFrame") {
    const ring = frameShadow(id);
    return (
      <span className="relative inline-flex size-12 items-center justify-center">
        <span
          className="size-9 rounded-full bg-[var(--color-muted)]"
          style={{
            outline: "2px solid var(--color-accent)",
            outlineOffset: "2px",
            ...(ring ? { boxShadow: ring } : {}),
          }}
        />
        {id === "frame-flower" && (
          <>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 -ml-1.5 -mt-1.5 text-[10px] select-none"
                style={{ transform: `rotate(${i * 60}deg) translateY(-1.45rem)` }}
              >
                🌸
              </span>
            ))}
          </>
        )}
      </span>
    );
  }
  if (type === "background") {
    return (
      <span
        className="block size-12 rounded-[var(--radius-sm)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)]"
        style={backgroundStyle(id)}
      />
    );
  }
  if (type === "badge") {
    return <span className="text-3xl select-none">{badgeEmoji(id) ?? "🏷️"}</span>;
  }
  if (type === "effect") {
    return (
      <span className="text-3xl select-none">{id === "fx-hearts" ? "💕" : "✨"}</span>
    );
  }
  if (type === "companion") {
    return <span className="text-3xl select-none">🦊</span>;
  }
  return null;
}
