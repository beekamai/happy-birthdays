import { useEffect, useRef, useState } from "react";

import { useT } from "../lib/i18n.ts";

/* A discoverable account entry, fixed top-left on every public page (the
   switcher cluster lives top-right). Logged out: a "log in" pill that leads to
   /admin, where the Telegram Login Widget lives. Logged in: the user's avatar
   with a small menu to edit their page or log out. Talks to /api/auth/* directly
   so the lazy admin bundle is never pulled into the public chunk. */

interface SessionUser {
  username?: string;
  firstName?: string;
  photoUrl?: string;
  isOwner?: boolean;
}

/** Fixed account / login control for public pages. */
export function AccountButton() {
  const { t } = useT();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setUser(null);
    setOpen(false);
  };

  const pill =
    "flex h-11 items-center justify-center gap-2 rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 px-3 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95";

  /* Until /me resolves, show nothing to avoid a flash of the wrong state. */
  if (!ready) return <div className="fixed top-4 left-4 z-50 size-11" aria-hidden="true" />;

  if (!user) {
    return (
      <a href="/admin" className={`fixed top-4 left-4 z-50 ${pill}`} title={t("account.login")}>
        <span aria-hidden="true">👤</span>
        <span className="text-sm">{t("account.login")}</span>
      </a>
    );
  }

  return (
    <div ref={rootRef} className="fixed top-4 left-4 z-50">
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
          className="absolute top-13 left-0 flex min-w-44 flex-col gap-1 rounded-[var(--radius-md)] border-[2px] border-white bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-md)] backdrop-blur-sm"
        >
          {user.username && (
            <span className="truncate px-3 py-1 text-xs text-[var(--color-text-soft)]">
              @{user.username}
            </span>
          )}
          <a
            href="/admin"
            onClick={() => setOpen(false)}
            className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-muted)]/40"
          >
            {t("account.settings")}
          </a>
          <button
            type="button"
            onClick={logout}
            className="rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-muted)]/40"
          >
            {t("account.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
