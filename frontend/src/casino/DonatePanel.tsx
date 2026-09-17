import { useEffect, useState } from "react";

import { useT } from "../lib/i18n.ts";

/* Where the loop closes: the chips a visitor won are worth nothing to them, so
   they hand them to the birthday friend, whose shop wallet they join. The panel
   only picks an amount and asks — the send (and its confirmation) belongs to the
   casino modal, which owns the request and the toast. */

interface DonatePanelProps {
  /** Who the points are going to, for the explainer line. */
  friendName: string;
  /** What the visitor can give right now. */
  balance: number;
  /** Smallest gift the server accepts. */
  minDonation: number;
  /** What this visitor has already given on this page, lifetime. */
  donated: number;
  disabled: boolean;
  onDonate: (amount: number) => void;
}

/** Amount picker + "gift it" button for sending points to the friend. */
export function DonatePanel({
  friendName,
  balance,
  minDonation,
  donated,
  disabled,
  onDonate,
}: DonatePanelProps) {
  const { t } = useT();
  const [amount, setAmount] = useState(balance);

  /* Follow the balance without stealing the player's choice: an amount they can
     still afford is kept, one a losing spin priced out is clamped down, and an
     empty purse that just got funded defaults to giving it all. */
  useEffect(() => {
    setAmount((current) => (current <= 0 ? balance : Math.min(current, balance)));
  }, [balance]);

  const canGive = balance >= minDonation;
  const value = Math.max(minDonation, Math.min(balance, amount));

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border-[2px] border-[var(--color-secondary)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,var(--color-surface))] p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-[var(--color-secondary-deep)]">
          {t("casino.donate.title", { name: friendName })}
        </h3>
        <p className="text-sm text-[var(--color-text-soft)]">
          {t("casino.donate.hint", { name: friendName })}
        </p>
      </div>

      {canGive ? (
        <>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={minDonation}
              max={balance}
              step={1}
              value={value}
              disabled={disabled}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label={t("casino.donate.amount")}
              className="flex-1"
            />
            <span className="w-20 shrink-0 text-right font-bold tabular-nums">
              {value}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setAmount(balance)}
              className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-3 py-1 text-xs font-bold text-[var(--color-text)] transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("casino.donate.all")}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDonate(value)}
              className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-secondary-deep)] bg-[var(--color-secondary)] px-4 py-1.5 text-sm font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {t("casino.donate.send", { n: value })}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-soft)]">
          {t("casino.donate.tooPoor", { n: minDonation })}
        </p>
      )}

      {donated > 0 && (
        <p className="text-xs font-bold text-[var(--color-success)]">
          {t("casino.donate.already", { n: donated, name: friendName })}
        </p>
      )}
    </section>
  );
}
