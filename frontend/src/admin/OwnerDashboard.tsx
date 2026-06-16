import { useEffect, useState } from "react";

import { StickerCard } from "../components/decor/StickerCard.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { useT, coverage } from "../lib/i18n.ts";
import {
  fetchAdminFriends,
  type AdminFriendSummary,
} from "./adminApi.ts";
import { PillButton, Spinner, StateBadge } from "./adminUi.tsx";
import { FriendEditor } from "./FriendEditor.tsx";

/* The owner's home: a grid of every friend page as a cozy card, plus a button to
   create a new one. Selecting a card or "create" swaps in the FriendEditor; the
   "← К списку" back-action re-fetches the list so freshly created/edited pages
   show up. View state lives here (no router). */

type View =
  | { kind: "list" }
  | { kind: "edit"; slug: string }
  | { kind: "create" };

function birthdayLabel(b: AdminFriendSummary["birthday"], t: (k: string) => string): string {
  const month = ((b.month - 1 + 12) % 12) + 1;
  const m = t(`month.short.${month}`);
  return b.year ? `${b.day} ${m} ${b.year}` : `${b.day} ${m}`;
}

export function OwnerDashboard() {
  const { t } = useT();
  const cov = coverage();
  const [view, setView] = useState<View>({ kind: "list" });
  const [friends, setFriends] = useState<AdminFriendSummary[] | null>(null);

  const load = () => {
    setFriends(null);
    fetchAdminFriends().then(setFriends);
  };

  useEffect(() => {
    if (view.kind === "list") load();
  }, [view.kind]);

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
        <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => setView({ kind: "edit", slug: f.slug })}
              className="text-left"
            >
              <StickerCard className="h-full">
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
              </StickerCard>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
