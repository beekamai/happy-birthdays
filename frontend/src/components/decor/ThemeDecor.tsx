import { useMemo, type ReactNode } from "react";

import type { ThemeName } from "../../lib/useTheme.ts";

/* Theme-specific ambient decor layered behind the page content: snow for
   New Year, bats + pumpkins for Halloween, a moon + twinkling stars for dark.
   Light theme adds nothing (the base lanterns/particles suffice). Non-interactive,
   low-opacity, and skipped entirely under prefers-reduced-motion. */

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function ThemeDecor({ theme }: { theme: ThemeName }) {
  const layer = useMemo<ReactNode>(() => buildLayer(theme), [theme]);
  if (!layer || reducedMotion()) return null;

  return (
    <div
      key={theme}
      aria-hidden="true"
      className="animate-theme-decor pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {layer}
    </div>
  );
}

function buildLayer(theme: ThemeName): ReactNode {
  if (theme === "newyear") {
    const flakes = Array.from({ length: 16 }, (_, i) => (
      <span
        key={i}
        className="animate-snow-fall absolute top-0"
        style={{
          left: `${rand(0, 100)}%`,
          fontSize: `${rand(10, 22)}px`,
          opacity: rand(0.5, 0.95),
          animationDuration: `${rand(7, 14)}s`,
          animationDelay: `${rand(0, 10)}s`,
        }}
      >
        {Math.random() < 0.5 ? "❄️" : "❅"}
      </span>
    ));
    return flakes;
  }

  if (theme === "halloween") {
    const bats = Array.from({ length: 6 }, (_, i) => (
      <span
        key={`b${i}`}
        className="animate-drift-across absolute"
        style={{
          top: `${rand(8, 70)}%`,
          fontSize: `${rand(18, 30)}px`,
          opacity: rand(0.6, 0.9),
          animationDuration: `${rand(12, 22)}s`,
          animationDelay: `${rand(0, 12)}s`,
        }}
      >
        🦇
      </span>
    ));
    const pumpkins = ["6%", "84%"].map((left, i) => (
      <span
        key={`p${i}`}
        className="animate-bob absolute bottom-3 text-3xl"
        style={{ left, animationDelay: `${i * 0.6}s`, filter: "drop-shadow(0 0 10px rgba(255,122,26,0.5))" }}
      >
        🎃
      </span>
    ));
    return [...bats, ...pumpkins];
  }

  if (theme === "dark") {
    const moon = (
      <span
        key="moon"
        className="absolute text-5xl"
        style={{ top: "4%", left: "7%", filter: "drop-shadow(0 0 14px rgba(255,226,150,0.5))" }}
      >
        🌙
      </span>
    );
    const stars = Array.from({ length: 12 }, (_, i) => (
      <span
        key={`s${i}`}
        className="animate-twinkle absolute"
        style={{
          top: `${rand(2, 60)}%`,
          left: `${rand(0, 100)}%`,
          fontSize: `${rand(8, 16)}px`,
          animationDuration: `${rand(2.5, 5)}s`,
          animationDelay: `${rand(0, 4)}s`,
        }}
      >
        ✨
      </span>
    ));
    return [moon, ...stars];
  }

  return null;
}
