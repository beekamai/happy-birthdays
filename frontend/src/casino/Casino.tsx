import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";

import { useT } from "../lib/i18n.ts";
import { playSound } from "../lib/sound.ts";
import {
  claimBonus,
  donatePoints,
  fetchCasinoGames,
  fetchCasinoState,
  isCasinoError,
  placeBet,
  type CasinoGame,
  type CasinoGameId,
  type CasinoState,
  type SpinOutcome,
} from "../lib/casinoApi.ts";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Toast, useToast } from "../components/Toast.tsx";

import { CasinoStage } from "./CasinoStage.tsx";
import { DonatePanel } from "./DonatePanel.tsx";
import { GAME_ICON, symbolEmoji } from "./casinoSymbols.ts";

/* The casino: the second half of the points economy. The mini-games mint points
   into a visitor's PERSONAL purse (their best run per game); here they can risk
   that purse on three tables and, when they're done, gift what's left to the
   birthday friend, where it lands in the shop wallet.

   Every number on screen is the server's — the client posts a stake and a side,
   the server rolls, settles the ledger and answers with the fresh wallet, so the
   UI never computes a balance of its own. Strings go through t(). */

interface CasinoProps {
  slug: string;
  /** The birthday friend, named in the donation copy. */
  friendName: string;
  /** Stable per-device id — the purse belongs to it. */
  visitorId: string;
  open: boolean;
  onClose: () => void;
  /** Fired after any balance-moving action so the page can refresh its totals. */
  onChange?: () => void;
}

/* Default stake when the purse can afford it: five times the table minimum. */
const DEFAULT_BET_STEPS = 5;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Hours (rounded up, at least one) until the next daily bonus. */
function hoursUntil(at: number): number {
  return Math.max(1, Math.ceil((at - Date.now()) / 3_600_000));
}

/** Modal casino for one friend page: three tables, a daily bonus and a gift box. */
export function Casino({
  slug,
  friendName,
  visitorId,
  open,
  onClose,
  onChange,
}: CasinoProps) {
  const { t } = useT();
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [state, setState] = useState<CasinoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableId, setTableId] = useState<CasinoGameId>("coin");
  const [pick, setPick] = useState("");
  const [bet, setBet] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingGift, setPendingGift] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const game = games.find((g) => g.id === tableId);

  /* Load the tables + this visitor's purse whenever the modal opens. */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    Promise.all([fetchCasinoGames(), fetchCasinoState(slug, visitorId)])
      .then(([list, wallet]) => {
        if (!alive) return;
        setGames(list);
        setState(wallet);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, slug, visitorId]);

  /* A table change clears the previous roll and picks its first side. */
  useEffect(() => {
    setOutcome(null);
    setPick(game?.picks[0] ?? "");
  }, [game]);

  /* Keep the stake inside the table limits AND inside the purse, which shrinks
     after a losing spin — otherwise the next spin would be refused with a 402. */
  useEffect(() => {
    if (!state) return;
    const { minBet, maxBet } = state.limits;
    const ceiling = Math.min(maxBet, state.balance);
    setBet((current) => {
      if (ceiling < minBet) return minBet;
      const wanted = current > 0 ? current : minBet * DEFAULT_BET_STEPS;
      return Math.max(minBet, Math.min(ceiling, wanted));
    });
  }, [state]);

  /* Escape closes, like the game modal. */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /* Apply a server answer: refresh the purse and let the page re-read its
     totals (a gift changes the friend's shop wallet). */
  const settle = useCallback(
    (next: CasinoState) => {
      setState(next);
      onChange?.();
    },
    [onChange],
  );

  const handleSpin = async () => {
    if (!game || !state || busy || rolling) return;
    playSound("start");
    setBusy(true);
    setRolling(true);
    setOutcome(null);

    const res = await placeBet(slug, visitorId, game.id, bet, pick);

    /* Let the reels cycle for a beat so the roll reads as a roll. */
    if (!prefersReducedMotion()) {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    setRolling(false);
    setBusy(false);

    if (isCasinoError(res)) {
      if (res.status === 402) showToast(t("casino.toast.notEnough"), "error");
      else if (res.status === 429) showToast(t("casino.toast.slowDown"), "error");
      else if (res.status === 403) showToast(t("casino.toast.closed"), "error");
      else showToast(t("casino.toast.error"), "error");
      return;
    }

    setOutcome(res.outcome);
    settle(res);
    if (res.outcome.delta > 0) {
      playSound("win");
      if (res.outcome.kind === "jackpot" && !prefersReducedMotion()) {
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.5 } });
      }
    } else {
      playSound("lose");
    }
  };

  const handleBonus = async () => {
    if (busy) return;
    setBusy(true);
    const res = await claimBonus(slug, visitorId);
    setBusy(false);
    if (isCasinoError(res)) {
      showToast(
        t(res.status === 429 ? "casino.toast.bonusTaken" : "casino.toast.error"),
        "error",
      );
      return;
    }
    playSound("pop");
    settle(res);
    showToast(t("casino.toast.bonus", { n: res.amount }), "success");
  };

  const handleConfirmGift = async () => {
    const amount = pendingGift;
    if (amount === null || busy) return;
    setBusy(true);
    const res = await donatePoints(slug, visitorId, amount);
    setBusy(false);
    setPendingGift(null);
    if (isCasinoError(res)) {
      showToast(
        t(res.status === 402 ? "casino.toast.notEnough" : "casino.toast.error"),
        "error",
      );
      return;
    }
    playSound("win");
    if (!prefersReducedMotion()) {
      confetti({ particleCount: 110, spread: 70, origin: { y: 0.6 } });
    }
    settle(res);
    showToast(t("casino.toast.donated", { n: res.amount, name: friendName }), "success");
  };

  if (!open) return null;

  const minBet = state?.limits.minBet ?? 10;
  const ceiling = state ? Math.min(state.limits.maxBet, state.balance) : 0;
  const broke = !!state && state.balance < minBet;
  const canSpin = !!game && !!state && !broke && !busy && !rolling && bet <= state.balance;

  const stepBet = (delta: number) =>
    setBet((b) => Math.max(minBet, Math.min(ceiling, b + delta)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("casino.title")}
    >
      <button
        type="button"
        aria-label={t("casino.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-cream)]/70 backdrop-blur-[2px]"
      />

      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-lg)] border-[3px] border-[var(--color-surface)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-lg)]">
        <header className="flex items-center justify-between gap-3 border-b-[2px] border-[var(--color-muted)] px-5 py-4">
          <h2 className="text-2xl">{t("casino.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("casino.close")}
            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-text)] transition-transform duration-200 hover:scale-105"
          >
            ✕
          </button>
        </header>

        {state && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[2px] border-[var(--color-muted)] px-5 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">
                <span aria-hidden="true">🪙 </span>
                {t("casino.balance", { n: state.balance })}
              </span>
              <span className="text-xs text-[var(--color-text-soft)]">
                {t("casino.earnedHint", { n: state.earned })}
              </span>
            </div>
            {state.bonus.available ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleBonus}
                className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-ramen-gold)] bg-[color-mix(in_srgb,var(--color-ramen-gold)_25%,var(--color-surface))] px-4 py-1.5 text-sm font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("casino.bonus.claim", { n: state.bonus.amount })}
              </button>
            ) : (
              <span className="text-xs font-bold text-[var(--color-text-soft)]">
                {t("casino.bonus.wait", { n: hoursUntil(state.bonus.nextAt) })}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
          {loading && <p className="text-center text-[var(--color-text-soft)]">🍜</p>}

          {!loading && !state && (
            <p className="text-center text-[var(--color-text-soft)]">
              {t("casino.unavailable")}
            </p>
          )}

          {!loading && state && game && (
            <>
              {/* Table picker. */}
              <div
                role="tablist"
                aria-label={t("casino.tables")}
                className="flex flex-wrap justify-center gap-2"
              >
                {games.map((g) => {
                  const active = g.id === tableId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        playSound("tap");
                        setTableId(g.id);
                      }}
                      className={`inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] px-4 py-1.5 text-sm font-bold transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)] ${
                        active
                          ? "border-[var(--color-primary-deep)] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[var(--shadow-sm)]"
                          : "border-[var(--color-muted)] bg-[var(--color-cream)] text-[var(--color-text)]"
                      }`}
                    >
                      <span aria-hidden="true">{GAME_ICON[g.id] ?? "🎲"}</span>
                      {t(`casino.game.${g.id}.title`)}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-sm text-[var(--color-text-soft)]">
                {t(`casino.game.${game.id}.hint`)}
              </p>

              <CasinoStage
                game={game}
                rolling={rolling}
                roll={outcome?.roll ?? null}
                kind={outcome?.kind ?? null}
              />

              {/* Outcome line — reserves its row so the layout doesn't jump. */}
              <p className="min-h-6 text-center font-bold" aria-live="polite">
                {outcome && (
                  <span
                    style={{
                      color:
                        outcome.delta > 0
                          ? "var(--color-success)"
                          : "var(--color-text-soft)",
                    }}
                  >
                    {t(`casino.outcome.${outcome.kind}`)} ·{" "}
                    {outcome.delta > 0
                      ? t("casino.result.win", { n: outcome.delta })
                      : t("casino.result.lose", { n: -outcome.delta })}
                  </span>
                )}
              </p>

              {/* Side picker — tables without picks (slots) skip it. */}
              {game.picks.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {game.picks.map((side) => {
                    const active = side === pick;
                    return (
                      <button
                        key={side}
                        type="button"
                        aria-pressed={active}
                        aria-label={t(`casino.symbol.${side}`)}
                        disabled={rolling}
                        onClick={() => {
                          playSound("tap");
                          setPick(side);
                        }}
                        className={`inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] border-[2px] text-2xl transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60 ${
                          active
                            ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-surface))]"
                            : "border-[var(--color-muted)] bg-[var(--color-cream)]"
                        }`}
                      >
                        <span aria-hidden="true">{symbolEmoji(side)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Stake controls. */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label={t("casino.bet.less")}
                    disabled={rolling || bet <= minBet}
                    onClick={() => stepBet(-minBet)}
                    className="size-10 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] text-lg font-bold transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="min-w-24 text-center text-xl font-bold tabular-nums">
                    {t("casino.bet.amount", { n: bet })}
                  </span>
                  <button
                    type="button"
                    aria-label={t("casino.bet.more")}
                    disabled={rolling || bet >= ceiling}
                    onClick={() => stepBet(minBet)}
                    className="size-10 rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] text-lg font-bold transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={rolling || ceiling < minBet}
                    onClick={() => setBet(ceiling)}
                    className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] px-3 py-1.5 text-xs font-bold transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("casino.bet.max")}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canSpin}
                  onClick={handleSpin}
                  className="self-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] px-8 py-3 text-lg font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {rolling ? t("casino.rolling") : t(`casino.game.${game.id}.action`)}
                </button>

                {broke && (
                  <p className="text-center text-sm text-[var(--color-text-soft)]">
                    {t("casino.broke", { n: minBet })}
                  </p>
                )}
              </div>

              {/* Payout table, straight from the server's numbers. */}
              <dl className="flex flex-col gap-1 rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] px-4 py-3 text-sm">
                {game.payouts.map((p) => (
                  <div key={p.kind} className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--color-text-soft)]">
                      {t(`casino.outcome.${p.kind}`)}
                    </dt>
                    <dd className="font-bold tabular-nums">×{p.multiplier}</dd>
                  </div>
                ))}
                <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                  {t("casino.house")}
                </p>
              </dl>

              <DonatePanel
                friendName={friendName}
                balance={state.balance}
                minDonation={state.limits.minDonation}
                donated={state.stats.donated}
                disabled={busy || rolling}
                onDonate={setPendingGift}
              />

              {state.stats.plays > 0 && (
                <p className="text-center text-xs text-[var(--color-text-soft)]">
                  {t("casino.stats", {
                    plays: state.stats.plays,
                    wagered: state.stats.wagered,
                    won: state.stats.won,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <Toast toast={toast} />

      <ConfirmDialog
        open={pendingGift !== null}
        title={t("casino.confirmGiftTitle")}
        message={t("casino.confirmGift", { n: pendingGift ?? 0, name: friendName })}
        confirmLabel={t("casino.confirmGiftYes")}
        confirmVariant="primary"
        disabled={busy}
        onConfirm={handleConfirmGift}
        onCancel={() => setPendingGift(null)}
      />
    </div>
  );
}
