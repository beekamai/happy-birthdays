import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
   works with both mouse and touch. The responsive grid is kept intact while
   dragging: as the pointer moves over another card the live order is reordered
   and every card glides to its new slot with a hand-rolled FLIP animation
   (measure → invert → play), so nothing teleports. The dragged card is lifted
   (scale/shadow/opacity). The order is persisted to the backend and reapplied
   on load; new pages absent from the saved order fall to the end. Clicking a
   card (off the handle) still opens its editor. */

type View =
  | { kind: "list" }
  | { kind: "edit"; slug: string }
  | { kind: "create" };

/* Live drag state: the slug of the card being moved. The visual order lives in
   `order` and is reordered in place as the pointer crosses other cards. */
type DragState = { slug: string };

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

export function OwnerDashboard() {
  const { t } = useT();
  const cov = coverage();
  const { toast, show } = useToast();
  const [view, setView] = useState<View>({ kind: "list" });
  const [friends, setFriends] = useState<AdminFriendSummary[] | null>(null);

  /* Live pointer-drag state; null when idle. */
  const [drag, setDrag] = useState<DragState | null>(null);
  /* DOM nodes of the card wrappers, keyed by slug — used to read their rects for
     the nearest-card hit test and for the FLIP measure/invert. */
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /* Rects captured just before a reorder, keyed by slug — the FLIP "first". */
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  /* Mutable mirror of `drag` so the window listeners (bound once per drag) read
     the latest value without re-binding on every move. */
  const dragRef = useRef<DragState | null>(null);
  /* Mutable mirror of `friends` so move/drop logic isn't a stale closure. */
  const friendsRef = useRef<AdminFriendSummary[] | null>(null);
  friendsRef.current = friends;
  /* Mutable mirror of `t` so the toast on drop uses the current language. */
  const tRef = useRef(t);
  tRef.current = t;
  /* Set true right before a reorder so the next layout pass runs the FLIP. */
  const flipPending = useRef(false);

  const load = () => {
    setFriends(null);
    Promise.all([fetchAdminFriends(), fetchPageOrder()]).then(([list, order]) =>
      setFriends(applyOrder(list, order)),
    );
  };

  useEffect(() => {
    if (view.kind === "list") load();
  }, [view.kind]);

  /* FLIP "invert + play": after a reorder commits, each card is offset back to
     where it was (invert) then released to 0 on the next frame so CSS
     transitions slide it into place. Runs in a layout effect to set the inverse
     transform before the browser paints the new positions. */
  useLayoutEffect(() => {
    if (!flipPending.current) return;
    flipPending.current = false;
    const refs = cardRefs.current;
    const prev = prevRects.current;
    const moved: HTMLDivElement[] = [];
    refs.forEach((el, slug) => {
      const before = prev.get(slug);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (dx === 0 && dy === 0) return;
      /* Invert: jump back to the old spot with no transition. */
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(el);
    });
    if (moved.length === 0) return;
    /* Play: next frame, clear the offset with a transition so it glides. */
    requestAnimationFrame(() => {
      for (const el of moved) {
        el.style.transition = "transform 200ms ease";
        el.style.transform = "";
      }
    });
  });

  /* Drag handlers held in a ref so the window listeners we add on pointerdown
     are the exact same function objects we remove on pointerup/unmount, while
     still calling the latest closures (toast/show, friendsRef). */
  const handlers = useRef({
    /* The slug of the card whose rect center is nearest the pointer (2D), or
       null when there are no measurable cards. Used as the drop target the
       dragged card swaps toward. */
    nearestSlug(x: number, y: number): string | null {
      let best: string | null = null;
      let bestDist = Infinity;
      cardRefs.current.forEach((el, slug) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = slug;
        }
      });
      return best;
    },
    /* Capture every card's current rect — the FLIP "first" snapshot. */
    measure() {
      prevRects.current.clear();
      cardRefs.current.forEach((el, slug) => {
        prevRects.current.set(slug, el.getBoundingClientRect());
      });
    },
    onMove(e: PointerEvent) {
      /* Stop the touch from scrolling the page while we reorder. */
      e.preventDefault();
      const cur = dragRef.current;
      const list = friendsRef.current;
      if (!cur || !list) return;
      const over = handlers.current.nearestSlug(e.clientX, e.clientY);
      if (!over || over === cur.slug) return;
      const fromIdx = list.findIndex((f) => f.slug === cur.slug);
      const overIdx = list.findIndex((f) => f.slug === over);
      if (fromIdx < 0 || overIdx < 0 || fromIdx === overIdx) return;
      /* Snapshot positions, reorder, then let the layout effect play the FLIP. */
      handlers.current.measure();
      flipPending.current = true;
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(overIdx, 0, moved);
      setFriends(next);
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
      void savePageOrder(list.map((f) => f.slug));
      show(tRef.current("dashboard.orderSaved"), "success");
    },
  });

  const startDrag = (e: React.PointerEvent, slug: string) => {
    e.preventDefault();
    const state: DragState = { slug };
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
          {/* Responsive grid kept intact during drag; cards FLIP into new slots. */}
          <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((f) => {
              const isDragged = drag?.slug === f.slug;
              return (
                <div
                  key={f.slug}
                  ref={(el) => {
                    if (el) cardRefs.current.set(f.slug, el);
                    else cardRefs.current.delete(f.slug);
                  }}
                  className="relative"
                  style={{ zIndex: isDragged ? 10 : undefined }}
                >
                  <StickerCard
                    className={
                      "relative h-full transition-[transform,opacity] " +
                      (isDragged
                        ? "scale-[1.03] opacity-90 shadow-[var(--shadow-lg)]"
                        : "")
                    }
                  >
                    {/* Drag handle — pointer-driven, works with touch. */}
                    <span
                      onPointerDown={(e) => startDrag(e, f.slug)}
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
          </div>
        </>
      )}
    </div>
  );
}
