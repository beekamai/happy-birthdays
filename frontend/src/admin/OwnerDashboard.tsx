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
import { PillButton, Spinner, StateBadge } from "./adminUi.tsx";
import { FriendEditor } from "./FriendEditor.tsx";

/* The owner's home: a grid of every friend page as a cozy card, plus a button to
   create a new one. Selecting a card or "create" swaps in the FriendEditor; the
   "← К списку" back-action re-fetches the list so freshly created/edited pages
   show up. View state lives here (no router).

   Cards are reorderable by dragging the ⠿ handle (HTML5 DnD). The order is
   persisted to the backend and reapplied on load; new pages absent from the
   saved order fall to the end. Clicking a card still opens its editor — the
   handle is the only drag surface, so click and drag never conflict. */

type View =
  | { kind: "list" }
  | { kind: "edit"; slug: string }
  | { kind: "create" };

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
  const [view, setView] = useState<View>({ kind: "list" });
  const [friends, setFriends] = useState<AdminFriendSummary[] | null>(null);

  /* Index of the card currently being dragged; cleared on drop/end. */
  const dragIndex = useRef<number | null>(null);
  /* Whether the card wrapper is draggable — only while the handle is pressed,
     so a normal click on the card opens the editor instead of starting a drag. */
  const [armed, setArmed] = useState<number | null>(null);

  const load = () => {
    setFriends(null);
    Promise.all([fetchAdminFriends(), fetchPageOrder()]).then(([list, order]) =>
      setFriends(applyOrder(list, order)),
    );
  };

  useEffect(() => {
    if (view.kind === "list") load();
  }, [view.kind]);

  /* Reorder the local list, then persist the new slug order (best-effort). */
  const onDrop = (to: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setArmed(null);
    if (from === null || from === to || !friends) return;
    const next = [...friends];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFriends(next);
    void savePageOrder(next.map((f) => f.slug));
  };

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
          <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((f, i) => (
              <div
                key={f.slug}
                draggable={armed === i}
                onDragStart={() => {
                  dragIndex.current = i;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setArmed(null);
                }}
              >
                <StickerCard className="relative h-full">
                  {/* Drag handle — arms dragging only while pressed. */}
                  <span
                    onPointerDown={() => setArmed(i)}
                    onPointerUp={() => setArmed(null)}
                    title={t("dashboard.reorderHint")}
                    aria-hidden="true"
                    className="absolute right-3 top-3 cursor-grab select-none text-lg leading-none text-[var(--color-text-soft)] active:cursor-grabbing"
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
