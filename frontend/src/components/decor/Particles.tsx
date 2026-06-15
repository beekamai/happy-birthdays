import { useMemo } from "react";

/* Low-density floating particles — gold stars + green noodle curls drifting
   upward. Pure CSR, so Math.random is fine (no SSR/hydration). Memoized per
   mount so positions stay stable across re-renders. Non-interactive. */

interface ParticlesProps {
  count?: number;
  className?: string;
}

const GLYPHS = ["⭐", "✨", "🌟", "〰️", "🍥"] as const;

interface Particle {
  glyph: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  green: boolean;
}

export function Particles({ count = 11, className = "" }: ParticlesProps) {
  const particles = useMemo<Particle[]>(() => {
    const n = Math.min(Math.max(count, 8), 14);
    return Array.from({ length: n }, (): Particle => {
      const green = Math.random() < 0.35;
      return {
        glyph: green
          ? "〰️"
          : GLYPHS[Math.floor(Math.random() * (GLYPHS.length - 1))],
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 6,
        size: 14 + Math.random() * 12,
        green,
      };
    });
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="animate-float-up absolute bottom-0 select-none"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            filter: p.green
              ? "hue-rotate(-30deg) saturate(0.8)"
              : "drop-shadow(0 0 4px rgba(242,180,65,0.5))",
          }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}
