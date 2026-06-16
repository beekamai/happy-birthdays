import { useEffect, useRef, useState } from "react";

import { StickerCard } from "../components/decor/StickerCard.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { useT, coverage } from "../lib/i18n.ts";
import {
  fetchAdminFriends,
  fetchPageOrder,
  savePageOrder,
  type AdminFriendSummary,
} from "./adminApi.ts";
import { PillButton, Spinner, StateBadge, Toast, useToast } from "./adminUi.tsx";
import { FriendEditor } from "./FriendEditor.tsx";

/* The owner's home: a grid of every friend page as a cozy card, plus a button to
   create a new one. Selecting a card or "create" swaps in the FriendEditor; the
   "← К списку" back-action re-fetches the list so freshly created/edited pages
   show up. View state lives here (no router).

   Cards are reorderable by dragging the ⠿ handle with pointer events, so it
   works with both mouse and touch. While dragging, the grid collapses to a
   single column and a bright accent insertion bar shows exactly where the card
   will land — no need to aim at a specific card. The order is persisted to the
   backend and reapplied on load; new pages absent from the saved order fall to
   the end. Clicking a card (off the handle) still opens its editor. */

type View =
  | { kind: "list" }
  | { kind: "edit"; slug: string }
  | { kind: "create" };

/* Live drag state: which card is being moved (`from`) and the insertion slot the
   pointer currently points at (`target`, 0..length — a position between cards,
   not a card index). `null` when not dragging. */
type DragState = { from: number; target: number };

function birthdayLabel(b: AdminFriendSummary["birthday"], t: (k: string) => string): string {
  const month = ((b.month - 1 + 12) % 12) + 1;
  const m = t(`month.short.${month}`);
  return b.year ? `${b.day} ${m} ${b.year}` : `${b.day} ${m}`;
}

/* Sort friends by a saved slug order; pages not in the order keep their original
   relative position at the end. */
function applyOrder(
  friends: AdminFriendSummary[],
  order: string[],
): AdminFriendSummary[] {
  const rank = new Map(order.map((slug, i) => [slug, i]));
  const known = friends.filter((f) => rank.has(f.slug));
  const rest = friends.filter((f) => !rank.has(f.slug));
  known.sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
  return [...known, ...rest];
}

/* Map an insertion slot (0..length) to the final index of the moved card after
   it's been spliced out of `from`. Returns null if the move is a no-op. */
function resolveMove(from: number, target: number): number | null {
  /* Inserting right before or right after itself changes nothing. */
  if (target === from || target === from + 1) return null;
  return target > from ? target - 1 : target;
}

export function OwnerDashboard() {
  const { t } = useT();
  const cov = coverage();
  const { toast, show } = useToast();
  const [view, setView] = useState<View>({ kind: "list" });
  const [friends, setFriends] = useState<AdminFriendSummary[] | null>(null);

  /* Live pointer-drag state; null when idle. */
  const [drag, setDrag] = useState<DragState | null>(null);
  /* DOM nodes of the card wrappers, indexed by position — used to read their
     rects and pick the nearest insertion slot under the pointer. */
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  /* Mutable mirror of `drag` so the window listeners (bound once per drag) read
     the latest value without re-binding on every move. */
  const dragRef = useRef<DragState | null>(null);
  /* Mutable mirror of `friends` so drop logic isn't a stale closure. */
  const friendsRef = useRef<AdminFriendSummary[] | null>(null);
  friendsRef.current = friends;
  /* Mutable mirror of `t` so the toast on drop uses the current language. */
  const tRef = useRef(t);
  tRef.current = t;

  const load = () => {
    setFriends(null);
    Promise.all([fetchAdminFriends(), fetchPageOrder()]).then(([list, order]) =>
      setFriends(applyOrder(list, order)),
    );
  };

  useEffect(() => {
    if (view.kind === "list") load();
  }, [view.kind]);

  /* Drag handlers held in a ref so the window listeners we add on pointerdown
     are the exact same function objects we remove on pointerup/unmount, while
     still calling the latest closures (toast/show, friendsRef). */
  const handlers = useRef({
    /* Compute the insertion slot (0..count) nearest to the pointer: the card
       whose vertical center is just below the pointer marks the slot before it;
       past the last center the slot is the end. Single-column layout while
       dragging keeps this one-dimensional and unambiguous. */
    slotAt(clientY: number): number {
      const refs = cardRefs.current;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return refs.length;
    },
    onMove(e: PointerEvent) {
      /* Stop the touch from scrolling the page while we reorder. */
      e.preventDefault();
      const cur = dragRef.current;
      if (!cur) return;
      const target = handlers.current.slotAt(e.clientY);
      if (target !== cur.target) {
        const next = { ...cur, target };
        dragRef.current = next;
        setDrag(next);
      }
    },
    onUp() {
      const h = handlers.current;
      window.removeEventListener("pointermove", h.onMove);
      window.removeEventListener("pointerup", h.onUp);
      window.removeEventListener("pointercancel", h.onUp);
      const cur = dragRef.current;
      const list = friendsRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur || !list) return;
      const to = resolveMove(cur.from, cur.target);
      if (to === null) return;
      const next = [...list];
      const [moved] = next.splice(cur.from, 1);
      next.splice(to, 0, moved);
      setFriends(next);
      void savePageOrder(next.map((f) => f.slug));
      show(tRef.current("dashboard.orderSaved"), "success");
    },
  });

  const startDrag = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    const state: DragState = { from: index, target: index };
    dragRef.current = state;
    setDrag(state);
    const h = handlers.current;
    window.addEventListener("pointermove", h.onMove, { passive: false });
    window.addEventListener("pointerup", h.onUp);
    window.addEventListener("pointercancel", h.onUp);
  };

  /* Safety net: drop any live listeners if the component unmounts mid-drag. */
  useEffect(() => {
    const h = handlers.current;
    return () => {
      window.removeEventListener("pointermove", h.onMove);
      window.removeEventListener("pointerup", h.onUp);
      window.removeEventListener("pointercancel", h.onUp);
    };
  }, []);

  if (view.kind === "edit") {
    return (
      <FriendEditor
        slug={view.slug}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }
  if (view.kind === "create") {
    return <FriendEditor create onBack={() => setView({ kind: "list" })} />;
  }

  const dragging = drag !== null;

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8">
      <Particles count={8} />
      <Toast toast={toast} />

      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">{t("dashboard.title")}</h1>
          <p className="text-[var(--color-text-soft)]">
            {t("dashboard.subtitle")}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-soft)]">
            {t("dashboard.coverage", { ru: cov.ru, en: cov.en })}
          </p>
        </div>
        <PillButton onClick={() => setView({ kind: "create" })}>
          {t("dashboard.create")}
        </PillButton>
      </div>

      {friends === null ? (
        <Spinner label={t("dashboard.loading")} />
      ) : friends.length === 0 ? (
        <StickerCard hover={false} className="text-center">
          <span className="block text-5xl select-none" aria-hidden="true">
            🗒️
          </span>
          <h2 className="mt-3 text-2xl">{t("dashboard.empty.title")}</h2>
          <p className="mt-2 text-[var(--color-text-soft)]">
            {t("dashboard.empty.text")}
          </p>
        </StickerCard>
      ) : (
        <>
          {friends.length > 1 && (
            <p className="relative mb-3 text-xs text-[var(--color-text-soft)]">
              {t("dashboard.reorderHint")}
            </p>
          )}
          {/* Single column while dragging so the insertion bar reads cleanly;
              back to the responsive grid otherwise. */}
          <div
            className={
              dragging
                ? "relative flex flex-col gap-5"
                : "relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {friends.map((f, i) => {
              const isDragged = drag?.from === i;
              const showBarBefore = dragging && drag!.target === i;
              return (
                <div
                  key={f.slug}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className="relative"
                >
                  {/* Insertion bar — bright accent line marking where the card
                      will land. */}
                  {showBarBefore && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-3 left-0 right-0 h-1 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
                    />
                  )}
                  <StickerCard
                    className={
                      "relative h-full transition-[transform,opacity] " +
                      (isDragged
                        ? "scale-[0.97] opacity-50 shadow-[var(--shadow-lg)]"
                        : "")
                    }
                  >
                    {/* Drag handle — pointer-driven, works with touch. */}
                    <span
                      onPointerDown={(e) => startDrag(e, i)}
                      title={t("dashboard.reorderHint")}
                      aria-hidden="true"
                      className="absolute right-2 top-2 -m-2 cursor-grab touch-none select-none p-2 text-lg leading-none text-[var(--color-text-soft)] active:cursor-grabbing"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      onClick={() => setView({ kind: "edit", slug: f.slug })}
                      className="block w-full text-left"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={f.avatarUrl}
                          alt={f.displayName}
                          className="size-16 shrink-0 rounded-full border-[3px] border-white object-cover shadow-[var(--shadow-sm)]"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold">
                            {f.displayName}
                          </h3>
                          <p className="truncate text-sm text-[var(--color-text-soft)]">
                            {f.username}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <StateBadge state={f.state} />
                        <span className="text-sm text-[var(--color-text-soft)]">
                          🎂 {birthdayLabel(f.birthday, t)}
                        </span>
                      </div>
                    </button>
                  </StickerCard>
                </div>
              );
            })}
            {/* Trailing insertion bar when dropping at the very end. */}
            {dragging && drag!.target === friends.length && (
              <span
                aria-hidden="true"
                className="pointer-events-none -mt-3 h-1 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
