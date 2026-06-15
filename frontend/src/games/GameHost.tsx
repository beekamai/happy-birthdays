import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

import type { PublicFriend, SiteConfig } from "../lib/types.ts";
import { startGame, postScore, type ScoreResult } from "../lib/api.ts";
import { playSound } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";
import { StickerCard } from "../components/decor/StickerCard.tsx";

import type { GameDescriptor, GameResult } from "./game-types.ts";

/* The single host that mounts a game, posts its score exactly once, fires
   confetti on a win, and shows a finish overlay. Games never touch the API —
   they only call `onFinish`. "Сыграть ещё" remounts the game via `runKey`. */

interface GameHostProps {
  descriptor: GameDescriptor;
  friend: PublicFriend;
  site: SiteConfig | null;
  /** Per-friend slot config, merged over the descriptor's `defaultConfig`. */
  config?: Record<string, unknown>;
  onClose: () => void;
  /** Stable per-device id, so scores attribute to this player. */
  visitorId: string;
  /** Fired after the server records a score, so the page can refresh its total. */
  onScored?: () => void;
}

export function GameHost({
  descriptor,
  friend,
  site,
  config,
  onClose,
  visitorId,
  onScored,
}: GameHostProps) {
  const { t } = useT();
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [serverResult, setServerResult] = useState<ScoreResult | null>(null);
  /* guard against a game calling onFinish twice within one run */
  const postedRef = useRef(false);
  /* one-time anti-cheat token for the current play (fetched per run) */
  const tokenRef = useRef<string | null>(null);

  const merged: Record<string, unknown> = {
    ...descriptor.defaultConfig,
    ...config,
  };

  /* Open a fresh play session per run to get a score token. */
  useEffect(() => {
    let alive = true;
    tokenRef.current = null;
    void startGame(friend.slug, descriptor.id, visitorId).then((tok) => {
      if (alive) tokenRef.current = tok;
    });
    return () => {
      alive = false;
    };
  }, [friend.slug, descriptor.id, visitorId, runKey]);

  const handleFinish = useCallback(
    (r: GameResult) => {
      if (postedRef.current) return;
      postedRef.current = true;

      if (r.won) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        playSound("win");
      } else {
        playSound("lose");
      }
      setResult(r);

      /* The server verifies the token + plausibility, then aggregates; we show
         its numbers, not ours. */
      void postScore(
        friend.slug,
        visitorId,
        {
          gameId: descriptor.id,
          score: r.score,
          durationMs: r.durationMs,
        },
        tokenRef.current,
      ).then((sr) => {
        if (sr) {
          setServerResult(sr);
          onScored?.();
        }
      });
    },
    [friend.slug, descriptor.id, visitorId, onScored],
  );

  const replay = () => {
    postedRef.current = false;
    setResult(null);
    setServerResult(null);
    setRunKey((k) => k + 1);
  };

  const Game = descriptor.component;

  return (
    <div className="relative h-full w-full">
      <Suspense fallback={<CozySpinner />}>
        <Game
          key={runKey}
          friend={friend}
          site={site}
          config={merged}
          onFinish={handleFinish}
        />
      </Suspense>

      {result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[var(--color-cream)]/70 backdrop-blur-[2px]" />
          <StickerCard hover={false} className="relative z-10 max-w-sm text-center">
            <div className="text-5xl">{result.won ? "🎉" : "🌙"}</div>
            <h2 className="mt-3 text-2xl">
              {result.won ? t("game.won") : t("game.over")}
            </h2>
            <p className="mt-2 text-[var(--color-text-soft)]">
              {t("game.scoreForGame")}{" "}
              <span className="font-bold text-[var(--color-text)]">{result.score}</span>
            </p>
            {serverResult && (
              <div className="mt-2 flex flex-col gap-1 text-sm text-[var(--color-text-soft)]">
                <span>
                  {t("game.bestInGame")}{" "}
                  <span className="font-bold text-[var(--color-accent)]">
                    {serverResult.gameBest}
                  </span>
                </span>
                <span>
                  {t("game.yourScore")}{" "}
                  <span className="font-bold text-[var(--color-text)]">
                    {serverResult.personal.total}
                  </span>{" "}
                  · {t("game.pageTotal")}{" "}
                  <span className="font-bold text-[var(--color-text)]">
                    {serverResult.global.total}
                  </span>
                </span>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={replay}
                className="rounded-[var(--radius-full)] bg-[var(--color-primary)] px-5 py-2.5 font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105"
              >
                {t("game.playAgain")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-5 py-2.5 font-bold text-[var(--color-text)] transition-transform duration-200 hover:scale-105"
              >
                {t("game.close")}
              </button>
            </div>
          </StickerCard>
        </div>
      )}
    </div>
  );
}

/* Cozy fallback while a game chunk loads. */
function CozySpinner() {
  const { t } = useT();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <span className="animate-bob text-5xl select-none" aria-hidden="true">
        🍜
      </span>
      <p className="font-bold text-[var(--color-text-soft)]">{t("loading.game")}</p>
    </div>
  );
}
