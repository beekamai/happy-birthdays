import { useEffect, useRef, useState } from "react";

import { useT } from "../lib/i18n.ts";

/* The account anchor — rightmost item of the top-right ControlBar on every page.
   Logged out: a "log in" pill leading to /account (the Telegram login lives
   there). Logged in: the user's avatar opening a menu. A friend's menu links to
   their public profile(s) at /u/<slug> and to the editor; the owner's links to
   the cabinet. The own-page slug is resolved lazily via /api/admin/mine (a
   friend's slug can differ from their handle). Talks to /api/* directly so the
   lazy admin bundle is never pulled into the public chunk. */

interface SessionUser {
  username?: string;
  firstName?: string;
  photoUrl?: string;
  isOwner?: boolean;
}

interface MyPageLite {
  slug: string;
  displayName: string;
}

const PILL =
  "flex h-11 items-center justify-center gap-2 rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 px-3 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95";
const ITEM =
  "rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-muted)]/40";

/** Account / login anchor for the ControlBar. */
export function AccountButton({ onLogout }: { onLogout?: () => void } = {}) {
  const { t } = useT();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState<MyPageLite[] | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: SessionUser | null } | null) => {
        if (!alive) return;
        setUser(data?.user ?? null);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* Resolve the friend's own page(s) so the menu can link to /u/<slug>. Owners
     never get a /u page (their /mine lists everyone), so skip the call. */
  useEffect(() => {
    if (!user || user.isOwner) return;
    let alive = true;
    fetch("/api/admin/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pages?: MyPageLite[] } | null) => {
        if (alive) setPages(d?.pages ?? []);
      })
      .catch(() => {
        if (alive) setPages([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setUser(null);
    setPages(null);
    setOpen(false);
    onLogout?.();
  };

  /* Avoid a flash of the wrong state until /me resolves. */
  if (!ready) return null;

  if (!user) {
    return (
      <a href="/account" className={PILL} title={t("account.login")}>
        <span aria-hidden="true">👤</span>
        <span className="text-sm">{t("account.login")}</span>
      </a>
    );
  }

  const isOwner = !!user.isOwner;
  const myPages = pages ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-11 items-center justify-center overflow-hidden rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95"
        title={user.username ? `@${user.username}` : t("account.account")}
      >
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-lg" aria-hidden="true">
            👤
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-13 right-0 flex min-w-48 flex-col gap-1 rounded-[var(--radius-md)] border-[2px] border-white bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-md)] backdrop-blur-sm"
        >
          {user.username && (
            <span className="truncate px-3 py-1 text-xs text-[var(--color-text-soft)]">
              @{user.username}
            </span>
          )}

          {isOwner ? (
            <a href="/account" onClick={() => setOpen(false)} className={ITEM}>
              {t("account.cabinet")}
            </a>
          ) : (
            <>
              {myPages.map((p) => (
                <a
                  key={p.slug}
                  href={`/u/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className={ITEM}
                >
                  {t("account.profile")}
                  {myPages.length > 1 ? ` «${p.displayName}»` : ""}
                </a>
              ))}
              <a href="/account" onClick={() => setOpen(false)} className={ITEM}>
                {t("account.edit")}
              </a>
            </>
          )}

          <button type="button" onClick={logout} className={ITEM}>
            {t("account.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
