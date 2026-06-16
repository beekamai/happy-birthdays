import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

import type { GameProps } from "./game-types.ts";
import { playSound } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";

/* Find-pairs memory game. A themed emoji set is doubled, shuffled, and laid out
   as flip cards (CSS rotateY). Two cards flip up; a 700ms lock lets the player
   see a mismatch before it flips back. Matches stay revealed. */

const DEFAULT_EMOJIS = ["🍜", "⭐", "🦊", "🎂", "🎈", "🌸", "🏮", "🍡"] as const;

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

/** Fisher-Yates in place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function buildDeck(emojis: readonly string[]): Card[] {
  const doubled = emojis.flatMap((e) => [e, e]);
  return shuffle(doubled).map((emoji, id) => ({
    id,
    emoji,
    flipped: false,
    matched: false,
  }));
}

export default function Memory({ config, onFinish }: GameProps) {
  const { t } = useT();
  const override = (config as { emojis?: string[] } | undefined)?.emojis;
  const emojis = override?.length ? override : [...DEFAULT_EMOJIS];

  const [deck, setDeck] = useState<Card[]>(() => buildDeck(emojis));
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const firstRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flip(idx: number) {
    if (lockRef.current || finishedRef.current) return;
    const card = deck[idx];
    if (!card || card.flipped || card.matched) return;

    const next = deck.slice();
    next[idx] = { ...card, flipped: true };
    setDeck(next);
    playSound("flip");

    if (firstRef.current === null) {
      firstRef.current = idx;
      return;
    }

    /* second card revealed → resolve */
    const firstIdx = firstRef.current;
    firstRef.current = null;
    setMoves((m) => m + 1);

    if (next[firstIdx]!.emoji === next[idx]!.emoji) {
      const matched = next.slice();
      matched[firstIdx] = { ...matched[firstIdx]!, matched: true };
      matched[idx] = { ...matched[idx]!, matched: true };
      setDeck(matched);
      playSound("match");
    } else {
      lockRef.current = true;
      timerRef.current = setTimeout(() => {
        setDeck((prev) =>
          prev.map((c, i) =>
            i === firstIdx || i === idx ? { ...c, flipped: false } : c,
          ),
        );
        lockRef.current = false;
      }, 700);
    }
  }

  /* win check */
  useEffect(() => {
    if (finishedRef.current) return;
    if (deck.length > 0 && deck.every((c) => c.matched)) {
      finishedRef.current = true;
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      onFinish({
        score: Math.max(0, 1000 - moves * 20),
        durationMs: Date.now() - startRef.current,
        won: true,
        meta: { moves },
      });
    }
  }, [deck, moves, onFinish]);

  /* clear pending compare timer on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cols = deck.length <= 12 ? 4 : 4;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
      <div className="rounded-[var(--radius-full)] bg-[var(--color-surface)]/90 px-4 py-1.5 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
        {t("memory.moves", { n: moves })}
      </div>

      <div
        className="grid w-full max-w-[min(80vh,440px)] gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {deck.map((card, idx) => {
          const up = card.flipped || card.matched;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(idx)}
              aria-label={up ? card.emoji : t("memory.closedCard")}
              className="relative aspect-square w-full"
              style={{ perspective: "600px", touchAction: "manipulation" }}
            >
              <div
                className="relative h-full w-full transition-transform duration-300"
                style={{
                  transformStyle: "preserve-3d",
                  transform: up ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* back face (hidden side) */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-md)] border-[3px] border-white bg-[var(--color-primary)] text-2xl shadow-[var(--shadow-sm)]"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <span className="opacity-80">🎁</span>
                </div>
                {/* front face (emoji) */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-md)] border-[3px] border-white bg-[var(--color-surface)] text-4xl shadow-[var(--shadow-sm)]"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    opacity: card.matched ? 0.6 : 1,
                  }}
                >
                  {card.emoji}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-[var(--color-text-soft)]">
        {t("memory.hint")}
      </p>
    </div>
  );
}
