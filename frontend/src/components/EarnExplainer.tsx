import { useT } from "../lib/i18n.ts";

/* A presentational explainer for the page wallet's accrual model: the shop is a
   shared pool that fills gradually because each new guest and each replay earns
   a diminishing share. Pure UI — no fetches, no state — so it can sit inside the
   shop's wallet header and on the friend page alike. Strings go through t(). */

interface EarnBar {
  /** Width fraction of the track, 0..1 — the visual decay (100% → 40% → 15%). */
  frac: number;
  /** Bar fill colour, a theme token (var(--color-*)). */
  color: string;
  labelKey: string;
}

const BARS: EarnBar[] = [
  { frac: 1, color: "var(--color-ramen-gold)", labelKey: "earn.bars.best" },
  { frac: 0.4, color: "var(--color-secondary)", labelKey: "earn.bars.newVisitor" },
  { frac: 0.15, color: "var(--color-lantern)", labelKey: "earn.bars.replay" },
];

const STEP_KEYS = ["earn.step.best", "earn.step.newVisitor", "earn.step.replay"];

interface EarnExplainerProps {
  /** When provided, renders a "got it" button (use when shown as a panel). */
  onClose?: () => void;
}

/** Visual explainer of how the page wallet accrues, with diminishing-return bars. */
export function EarnExplainer({ onClose }: EarnExplainerProps) {
  const { t } = useT();

  return (
    <div className="flex flex-col gap-4 text-left text-[var(--color-text)]">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-[var(--color-secondary-deep)]">
          {t("earn.title")}
        </h3>
        <p className="text-sm text-[var(--color-text-soft)]">{t("earn.intro")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {STEP_KEYS.map((key) => (
          <li key={key} className="text-sm leading-relaxed">
            {t(key)}
          </li>
        ))}
      </ul>

      {/* Diminishing-return bars: 100% → 40% → 15% widths drive the message home. */}
      <div className="flex flex-col gap-2.5">
        {BARS.map((bar) => (
          <div key={bar.labelKey} className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--color-text-soft)]">
              {t(bar.labelKey)}
            </span>
            <div className="h-3 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-muted)]">
              <div
                className="h-full rounded-[var(--radius-full)]"
                style={{ width: `${bar.frac * 100}%`, backgroundColor: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-text-soft)]">
        {t("earn.deficit")}
      </p>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-[var(--radius-full)] border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] px-4 py-1.5 text-sm font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent)]"
        >
          {t("earn.close")}
        </button>
      )}
    </div>
  );
}
