import { useEffect, useState } from "react";
import { motion } from "motion/react";

import type { CasinoGame } from "../lib/casinoApi.ts";

import { symbolEmoji } from "./casinoSymbols.ts";

/* The felt: the big animated face(s) a table rolls. One slot for the coin and
   the die, three for the reels. While a spin is in flight the slots cycle random
   symbols locally — pure decoration, the settled `roll` always comes from the
   server — and a reduced-motion preference skips the cycling entirely. */

interface CasinoStageProps {
  game: CasinoGame;
  /** True between the POST and its answer: cycle the faces. */
  rolling: boolean;
  /** The server's settled roll, or null before the first spin. */
  roll: string[] | null;
  /** The settled spin's net change, null before the first spin. Drives the win
      glow, so it tracks the same signal as the outcome line — a slots pair pays
      x0.75, which reads as a hit but still leaves the purse smaller, and lighting
      it up gold would claim a win the balance doesn't show. */
  delta: number | null;
}

/* How fast the faces cycle while a spin is in flight (ms). */
const CYCLE_MS = 90;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animated roll display for one casino table. */
export function CasinoStage({ game, rolling, roll, delta }: CasinoStageProps) {
  const reels = game.id === "slots" ? 3 : 1;
  const [cycling, setCycling] = useState<string[]>([]);

  /* Cycle random faces while the bet is in flight. */
  useEffect(() => {
    if (!rolling || prefersReducedMotion()) {
      setCycling([]);
      return;
    }
    const shuffle = () =>
      setCycling(
        Array.from(
          { length: reels },
          () => game.symbols[Math.floor(Math.random() * game.symbols.length)] ?? "",
        ),
      );
    shuffle();
    const id = window.setInterval(shuffle, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [rolling, reels, game]);

  /* Cycling faces while spinning, the server's roll once it lands, and a calm
     preview of the table's own symbols before the first bet. */
  const faces =
    cycling.length === reels
      ? cycling
      : (roll ?? game.symbols.slice(0, reels));

  const won = !rolling && delta !== null && delta > 0;

  return (
    <div
      className="flex items-center justify-center gap-3 rounded-[var(--radius-lg)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] px-4 py-6 transition-colors duration-300"
      style={
        won
          ? {
              borderColor: "var(--color-ramen-gold)",
              boxShadow: "var(--shadow-glow)",
            }
          : undefined
      }
      aria-live="polite"
    >
      {faces.map((face, i) => (
        <motion.span
          key={`${i}-${face}-${rolling ? "spin" : "rest"}`}
          initial={{ scale: 0.7, opacity: 0.4, rotate: rolling ? -12 : 0 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className="inline-flex size-16 items-center justify-center rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-4xl select-none sm:size-20 sm:text-5xl"
        >
          {symbolEmoji(face)}
        </motion.span>
      ))}
    </div>
  );
}
