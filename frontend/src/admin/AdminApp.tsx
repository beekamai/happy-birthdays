import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { ControlBar } from "../components/ControlBar.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { Steam } from "../components/decor/Steam.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

import { fetchMyPages, type MyPage } from "./adminApi.ts";
import { useAuth } from "./useAuth.ts";
import { Spinner } from "./adminUi.tsx";
import { TelegramLoginButton } from "./TelegramLoginButton.tsx";
import { OwnerDashboard } from "./OwnerDashboard.tsx";
import { FriendEditor } from "./FriendEditor.tsx";

/* Admin entry point (rendered for /admin). Resolves the session, then dispatches:
   loading → spinner; no user → LoginScreen; owner → OwnerDashboard; otherwise →
   the friend's own page editor (limited subset) if they have one. A slim top bar
   shows the user and a logout action on every signed-in screen. */

export default function AdminApp() {
  const { user, config, loading, refresh, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme("light");

  useEffect(() => {
    initLang("ru");
  }, []);

  /* One fixed control cluster (top-right) for every screen — switchers plus the
     account anchor, whose logout flips this app's session state in place. */
  const controls = (
    <ControlBar>
      <LanguageSwitcher />
      <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
      <AccountButton onLogout={logout} />
    </ControlBar>
  );

  if (loading)
    return (
      <>
        {controls}
        <CozyShell>
          <Spinner />
        </CozyShell>
      </>
    );

  if (!user) {
    return (
      <>
        {controls}
        <LoginScreen onLogin={refresh} config={config} />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)]">
      {controls}
      <TopBar />
      {user.isOwner ? <OwnerDashboard /> : <FriendArea />}
    </div>
  );
}

/* ---- Cozy ambient shell (decor behind centered content) ------------------ */
function CozyShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--color-cream)] px-6">
      <Particles count={8} />
      <Lanterns count={5} />
      <div className="relative w-full">{children}</div>
    </main>
  );
}

/* ---- Login screen ------------------------------------------------------- */
function LoginScreen({
  onLogin,
  config,
}: {
  onLogin: () => void;
  config: ReturnType<typeof useAuth>["config"];
}) {
  const { t } = useT();
  return (
    <CozyShell>
      <div className="mx-auto max-w-md text-center">
        <div className="relative">
          <Steam count={4} />
          <StickerCard hover={false} className="mt-12">
            <span className="block text-6xl select-none" aria-hidden="true">
              🍜
            </span>
            <h1 className="mt-4 text-3xl">{t("admin.login.title")}</h1>
            <p className="mt-2 mb-6 text-[var(--color-text-soft)]">
              {t("admin.login.subtitle")}
            </p>
            {config ? (
              <TelegramLoginButton config={config} onLogin={onLogin} />
            ) : (
              <p className="text-sm text-[var(--color-text-soft)]">
                {t("admin.login.configError")}
              </p>
            )}
          </StickerCard>
        </div>
      </div>
    </CozyShell>
  );
}

/* ---- Top bar (brand only; account + logout live in the ControlBar anchor) -- */
function TopBar() {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-30 border-b-[2px] border-[var(--color-muted)] bg-[var(--color-surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <a
          href="/"
          className="flex items-center gap-2 font-[var(--font-display)] font-bold text-[var(--color-text)]"
        >
          <span className="text-xl select-none" aria-hidden="true">
            🍜
          </span>
          {t("admin.brand")}
        </a>
      </div>
    </header>
  );
}

/* ---- Friend area (non-owner) -------------------------------------------- */
/* A non-owner edits only their own page(s). The backend matches pages by the
   user's handle (not the slug), so this works even when a page slug differs
   from the friend's Telegram username. */
function FriendArea() {
  const { t } = useT();
  const [state, setState] = useState<"checking" | "has" | "none">("checking");
  const [pages, setPages] = useState<MyPage[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyPages().then((mine) => {
      if (!alive) return;
      setPages(mine);
      if (mine.length === 1) setSlug(mine[0].slug);
      setState(mine.length > 0 ? "has" : "none");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") return <Spinner label={t("admin.searchingPage")} />;

  if (state === "none") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <StickerCard hover={false}>
          <span className="block text-5xl select-none" aria-hidden="true">
            🥺
          </span>
          <h2 className="mt-3 text-2xl">{t("admin.noPage.title")}</h2>
          <p className="mt-2 text-[var(--color-text-soft)]">
            {t("admin.noPage.text")}
          </p>
        </StickerCard>
      </div>
    );
  }

  /* More than one page tied to this handle — let them choose which to edit. */
  if (!slug) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h2 className="mb-4 text-center text-2xl">{t("admin.myPages.title")}</h2>
        <div className="flex flex-col gap-3">
          {pages.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSlug(p.slug)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] p-3 text-left transition-transform hover:scale-[1.02]"
            >
              <img
                src={p.avatarUrl}
                alt=""
                className="size-12 rounded-full border-[2px] border-[var(--color-surface)] object-cover"
              />
              <div className="flex flex-col">
                <span className="font-bold text-[var(--color-text)]">{p.displayName}</span>
                <span className="text-sm text-[var(--color-text-soft)]">/{p.slug}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <FriendEditor slug={slug} limited />;
}
