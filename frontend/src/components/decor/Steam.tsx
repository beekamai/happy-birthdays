/* Rising ramen steam — soft white wavy SVG paths drifting up above a container.
   Purely decorative: absolutely positioned, non-interactive, staggered. */

interface SteamProps {
  count?: number;
  className?: string;
}

/* A single gentle S-curve wisp, drawn in a tall narrow viewBox. */
function Wisp() {
  return (
    <svg
      width="24"
      height="80"
      viewBox="0 0 24 80"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 78 C4 64 20 56 12 42 C4 28 20 20 12 4"
        stroke="var(--color-steam)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function Steam({ count = 4, className = "" }: SteamProps) {
  const wisps = Array.from({ length: count });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 -top-12 flex justify-center gap-3 ${className}`}
    >
      {wisps.map((_, i) => (
        <span
          key={i}
          className="animate-steam block blur-[2px]"
          style={{
            animationDelay: `${i * 0.55}s`,
            animationDuration: `${3 + (i % 3) * 0.4}s`,
          }}
        >
          <Wisp />
        </span>
      ))}
    </div>
  );
}
