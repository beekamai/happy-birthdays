import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import type { PublicFriend, SiteConfig } from "../lib/types.ts";
import type { GameDescriptor } from "../games/game-types.ts";
import { getGame } from "../games/registry.ts";
import { playSound } from "../lib/sound.ts";
import { useT } from "../lib/i18n.ts";
import { GameHost } from "../games/GameHost.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* The mini-games section: a grid of cozy launcher cards. Tapping a card opens
   a near-fullscreen modal hosting the game. The modal locks body scroll and
   closes on backdrop click, the ✕ button, or Escape. */

interface GamesGridProps {
  friend: PublicFriend;
  site: SiteConfig | null;
  /** Stable per-device id for score attribution. */
  visitorId: string;
  /** Called after the server records a score (to refresh the page total). */
  onScored?: () => void;
  /** Page-wide best score per gameId (from server totals). Reactive: refreshed
      after a play so a new record shows on the launcher card right away. */
  bestByGame?: Record<string, number>;
}

interface ResolvedGame {
  descriptor: GameDescriptor;
  config?: Record<string, unknown>;
}

/** Grid of game launchers with a modal game host. */
export function GamesGrid({ friend, site, visitorId, onScored, bestByGame }: GamesGridProps) {
  const { t } = useT();
  /* Resolve each slot to its descriptor once; skip unknown gameIds. */
  const games = useMemo<ResolvedGame[]>(() => {
    const resolved: ResolvedGame[] = [];
    for (const slot of friend.games) {
      const descriptor = getGame(slot.gameId);
      if (descriptor) resolved.push({ descriptor, config: slot.config });
    }
    return resolved;
  }, [friend.games]);

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const open = openIdx !== null ? games[openIdx] : null;

  const close = () => setOpenIdx(null);

  /* Close on Escape and lock body scroll while a game is open. */
  useEffect(() => {
    if (open === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
    };
    window.addEventListener("keydown", onKeyDown);

    const hasDoc = typeof document !== "undefined";
    const prevOverflow = hasDoc ? document.body.style.overflow : "";
    if (hasDoc) document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (hasDoc) document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (games.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center justify-center gap-2 text-center text-3xl">
        {t("games.title")}
        <span
          tabIndex={0}
          role="note"
          aria-label={t("earn.card.tooltip")}
          title={t("earn.card.tooltip")}
          className="inline-flex size-6 cursor-help items-center justify-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-text-soft)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)]"
        >
          ⓘ
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {games.map((game, index) => {
          const best = bestByGame?.[game.descriptor.id] ?? 0;
          return (
            <StickerCard key={`${game.descriptor.id}-${index}`} className="p-0">
              <button
                type="button"
                onClick={() => {
                  playSound("start");
                  setOpenIdx(index);
                }}
                className="flex w-full cursor-pointer flex-col gap-2 rounded-[var(--radius-lg)] p-6 text-left focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)]"
              >
                <span className="text-5xl select-none" aria-hidden="true">
                  {game.descriptor.icon}
                </span>
                <span className="text-xl font-bold text-[var(--color-text)]">
                  {t(game.descriptor.titleKey)}
                </span>
                <span className="text-sm text-[var(--color-text-soft)]">
                  {t(game.descriptor.blurbKey)}
                </span>
                {best > 0 && (
                  <span className="text-xs font-bold text-[var(--color-text-soft)]">
                    {t("games.best", { n: best })}
                  </span>
                )}
              </button>
            </StickerCard>
          );
        })}
      </div>

      <AnimatePresence>
        {open !== null && (
          <div
            key="game-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          >
            <motion.div
              className="absolute inset-0 bg-[var(--color-text)]/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            <motion.div
              className="relative z-10 flex h-[85vh] w-[min(900px,92vw)] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] sm:h-[min(80vh,720px)]"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-end p-3">
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("games.close")}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)]"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1">
                <GameHost
                  descriptor={open.descriptor}
                  friend={friend}
                  site={site}
                  config={open.config}
                  onClose={close}
                  visitorId={visitorId}
                  onScored={onScored}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
