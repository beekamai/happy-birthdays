/* A row of swaying paper lanterns hanging from the top. Each lantern pendulums
   on a per-index delay. Pure CSS/SVG, non-interactive. */

interface LanternsProps {
  count?: number;
  className?: string;
}

function Lantern({ index }: { index: number }) {
  /* Vary the pendulum slightly per lantern so the row feels alive, not synced. */
  const delay = `${(index % 4) * 0.45}s`;
  const duration = `${3.2 + (index % 3) * 0.5}s`;
  const cordHeight = 14 + (index % 3) * 8;

  return (
    <div className="flex flex-col items-center">
      {/* hanging cord */}
      <div
        className="w-px bg-[var(--color-text-soft)]/40"
        style={{ height: `${cordHeight}px` }}
      />
      <div
        className="animate-sway"
        style={{ animationDelay: delay, animationDuration: duration }}
      >
        <svg
          width="44"
          height="58"
          viewBox="0 0 44 58"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`lantern-glow-${index}`} cx="50%" cy="42%" r="55%">
              <stop offset="0%" stopColor="var(--color-lantern-glow)" />
              <stop offset="100%" stopColor="var(--color-lantern)" />
            </radialGradient>
          </defs>
          {/* top cap */}
          <rect x="16" y="2" width="12" height="5" rx="2" fill="var(--color-lantern)" />
          {/* body */}
          <ellipse
            cx="22"
            cy="26"
            rx="20"
            ry="20"
            fill={`url(#lantern-glow-${index})`}
          />
          {/* ribbing */}
          <line x1="22" y1="7" x2="22" y2="45" stroke="var(--color-lantern)" strokeWidth="1" opacity="0.35" />
          <ellipse cx="22" cy="26" rx="10" ry="20" stroke="var(--color-lantern)" strokeWidth="1" fill="none" opacity="0.3" />
          {/* bottom cap */}
          <rect x="16" y="45" width="12" height="5" rx="2" fill="var(--color-lantern)" />
          {/* gold tassel */}
          <line x1="22" y1="50" x2="22" y2="57" stroke="var(--color-ramen-gold)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function Lanterns({ count = 5, className = "" }: LanternsProps) {
  const lanterns = Array.from({ length: count });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-6 sm:gap-10 ${className}`}
    >
      {lanterns.map((_, i) => (
        <Lantern key={i} index={i} />
      ))}
    </div>
  );
}
