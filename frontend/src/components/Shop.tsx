import { useCallback, useEffect, useState } from "react";

import { useT } from "../lib/i18n.ts";
import {
  buyItem,
  equipItem,
  refundItem,
  fetchCatalog,
  fetchShopState,
  type DecorType,
  type ShopItem,
  type ShopState,
} from "../lib/shopApi.ts";
import { DecorPreview } from "./decor/Decorations.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

/* The decoration store, shown over the profile when the viewer may edit it.
   Loads the catalogue + the friend's wallet/ownership on open, groups items by
   slot, and lets the owner buy (auto-equip) and toggle equip/unequip. Every
   mutation refreshes local state, fires a toast, and calls `onChange` so the
   host page can re-render the freshly equipped decor. Strings go through t(). */

const SECTION_ORDER: DecorType[] = [
  "avatarFrame",
  "background",
  "badge",
  "effect",
  "companion",
];

interface ToastState {
  message: string;
  kind: "success" | "error";
}

/* A ring that fills with the share of the page's total points already spent, so
   it's obvious the shop draws from a shared quota. The remaining balance sits in
   the centre. */
function SpentRing({ spent, earned }: { spent: number; earned: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const frac = earned > 0 ? Math.min(1, spent / earned) : 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="7" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--color-ramen-gold)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - frac)}
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

interface ShopProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful buy/equip/refund with the fresh equipped slots so
      the host page can re-render decor live (no reload). */
  onChange: (equipped: Record<string, string | undefined>) => void;
}

/** Modal decoration store for a friend's profile. */
export function Shop({ slug, open, onClose, onChange }: ShopProps) {
  const { t, lang } = useT();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [state, setState] = useState<ShopState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingRefund, setPendingRefund] = useState<ShopItem | null>(null);

  const showToast = useCallback((message: string, kind: ToastState["kind"]) => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    Promise.all([fetchCatalog(), fetchShopState(slug)])
      .then(([catalog, shopState]) => {
        if (!alive) return;
        setItems(catalog);
        setState(shopState);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, slug]);

  if (!open) return null;

  const itemName = (item: ShopItem) => (lang === "en" ? item.nameEn : item.nameRu);

  const handleBuy = async (item: ShopItem) => {
    if (busyId) return;
    setBusyId(item.id);
    const res = await buyItem(slug, item.id);
    setBusyId(null);
    if ("error" in res) {
      if (res.status === 402) showToast(t("shop.toast.notEnough"), "error");
      else if (res.status === 409) showToast(t("shop.toast.owned"), "error");
      else showToast(t("shop.toast.error"), "error");
      return;
    }
    setState(res);
    onChange(res.equipped);
    showToast(t("shop.toast.bought"), "success");
  };

  const handleConfirmRefund = async () => {
    const item = pendingRefund;
    if (!item || busyId) return;
    setBusyId(item.id);
    const res = await refundItem(slug, item.id);
    setBusyId(null);
    setPendingRefund(null);
    if (!res) {
      showToast(t("shop.toast.error"), "error");
      return;
    }
    setState(res);
    onChange(res.equipped);
    showToast(t("shop.toast.refunded"), "success");
  };

  const handleEquip = async (item: ShopItem) => {
    if (busyId) return;
    const isOn = state?.equipped[item.type] === item.id;
    setBusyId(item.id);
    const res = await equipItem(slug, item.type, isOn ? null : item.id);
    setBusyId(null);
    if (!res) {
      showToast(t("shop.toast.error"), "error");
      return;
    }
    setState(res);
    onChange(res.equipped);
    showToast(t(isOn ? "shop.toast.unequipped" : "shop.toast.equipped"), "success");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("shop.title")}
    >
      <button
        type="button"
        aria-label={t("shop.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-cream)]/70 backdrop-blur-[2px]"
      />

      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-lg)] border-[3px] border-white bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-lg)]">
        <header className="flex items-center justify-between gap-3 border-b-[2px] border-[var(--color-muted)] px-5 py-4">
          <h2 className="text-2xl">{t("shop.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("shop.close")}
            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-text)] transition-transform duration-200 hover:scale-105"
          >
            ✕
          </button>
        </header>

        {state && (
          <div className="flex items-center gap-4 border-b-[2px] border-[var(--color-muted)] px-5 py-3">
            <SpentRing spent={state.spent} earned={state.earned} />
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">
                <span aria-hidden="true">🏅 </span>
                {t("shop.remaining", { n: state.balance })}
              </span>
              <span className="text-sm text-[var(--color-text-soft)]">
                {t("shop.spentOf", { spent: state.spent, earned: state.earned })}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {loading && <p className="text-center text-[var(--color-text-soft)]">🍜</p>}

          {!loading && items.length === 0 && (
            <p className="text-center text-[var(--color-text-soft)]">
              {t("shop.empty")}
            </p>
          )}

          {!loading &&
            SECTION_ORDER.map((type) => {
              const section = items.filter((it) => it.type === type);
              if (section.length === 0) return null;
              return (
                <section key={type} className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-[var(--color-secondary-deep)]">
                    {t(`shop.section.${type}`)}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {section.map((item) => {
                      const owned = state?.owned.includes(item.id) ?? false;
                      const equipped = state?.equipped[item.type] === item.id;
                      const tooPoor = (state?.balance ?? 0) < item.cost;
                      const busy = busyId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-cream)] p-3"
                        >
                          <DecorPreview id={item.id} type={item.type} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate font-bold">
                              {itemName(item)}
                            </span>
                            <span className="text-xs text-[var(--color-text-soft)]">
                              {t("shop.cost", { n: item.cost })}
                            </span>
                            {owned ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-[var(--radius-full)] border-[2px] border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] px-2.5 py-0.5 text-xs font-bold">
                                  {t("shop.owned")}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleEquip(item)}
                                  className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-3 py-1 text-xs font-bold transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t(equipped ? "shop.unequip" : "shop.equip")}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setPendingRefund(item)}
                                  title={t("shop.refundHint", { n: item.cost })}
                                  className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-lantern)] bg-[var(--color-surface)] px-3 py-1 text-xs font-bold text-[var(--color-lantern)] transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {t("shop.refund", { n: item.cost })}
                                </button>
                              </div>
                            ) : (
                              <span
                                className="mt-1 self-start"
                                title={
                                  tooPoor
                                    ? t("shop.needMore", { n: item.cost - (state?.balance ?? 0) })
                                    : undefined
                                }
                              >
                                <button
                                  type="button"
                                  disabled={busy || tooPoor}
                                  onClick={() => handleBuy(item)}
                                  className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] px-3 py-1 text-xs font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-sm)] transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                                >
                                  {t("shop.buy")}
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            className="rounded-[var(--radius-full)] border-[2px] px-6 py-3 font-bold shadow-[var(--shadow-lg)]"
            style={{
              borderColor:
                toast.kind === "success"
                  ? "var(--color-success)"
                  : "var(--color-lantern)",
              backgroundColor:
                toast.kind === "success"
                  ? "color-mix(in srgb, var(--color-nest-green) 25%, var(--color-surface))"
                  : "color-mix(in srgb, var(--color-lantern-glow) 30%, var(--color-surface))",
              color: "var(--color-text)",
            }}
          >
            {toast.kind === "success" ? "✅ " : "⚠️ "}
            {toast.message}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingRefund !== null}
        title={t("shop.confirmRefundTitle")}
        message={t("shop.confirmRefund", {
          name: pendingRefund ? itemName(pendingRefund) : "",
          n: pendingRefund?.cost ?? 0,
        })}
        confirmLabel={t("shop.confirmDelete")}
        confirmVariant="danger"
        disabled={busyId !== null}
        onConfirm={handleConfirmRefund}
        onCancel={() => setPendingRefund(null)}
      />
    </div>
  );
}
