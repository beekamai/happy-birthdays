import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { Steam } from "../components/decor/Steam.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

import { deriveSlug, fetchAdminFriend, type AuthUser } from "./adminApi.ts";
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

  /* The switchers are fixed-positioned, so render them once for every screen. */
  const switcher = (
    <>
      <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
      <LanguageSwitcher />
    </>
  );

  if (loading)
    return (
      <>
        {switcher}
        <CozyShell>
          <Spinner />
        </CozyShell>
      </>
    );

  if (!user) {
    return (
      <>
        {switcher}
        <LoginScreen onLogin={refresh} config={config} />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-cream)]">
      {switcher}
      <TopBar user={user} onLogout={logout} />
      {user.isOwner ? <OwnerDashboard /> : <FriendArea user={user} />}
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

/* ---- Top bar ------------------------------------------------------------ */
function TopBar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-40 border-b-[2px] border-[var(--color-muted)] bg-[var(--color-surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a
          href="/admin"
          className="flex items-center gap-2 font-[var(--font-display)] font-bold text-[var(--color-text)]"
        >
          <span className="text-xl select-none" aria-hidden="true">
            🍜
          </span>
          {t("admin.brand")}
        </a>
        <div className="flex items-center gap-3">
          {user.photoUrl && (
            <img
              src={user.photoUrl}
              alt={user.username ?? "user"}
              className="size-8 rounded-full border-[2px] border-white object-cover shadow-[var(--shadow-sm)]"
            />
          )}
          <span className="hidden text-sm font-bold text-[var(--color-text)] sm:inline">
            {user.username ? `@${user.username}` : (user.firstName ?? t("admin.you"))}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-[var(--radius-full)] border-[2px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-1.5 text-sm font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-transform hover:scale-[1.03]"
          >
            {t("admin.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---- Friend area (non-owner) -------------------------------------------- */
/* A non-owner can only edit their own page. We probe for a page whose slug
   matches their username; if the probe 403/404s they have nothing to edit. */
function FriendArea({ user }: { user: AuthUser }) {
  const { t } = useT();
  const [state, setState] = useState<"checking" | "has" | "none">("checking");
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const candidate = deriveSlug(user.username ?? "");
    if (!candidate) {
      setState("none");
      return;
    }
    let alive = true;
    fetchAdminFriend(candidate).then((detail) => {
      if (!alive) return;
      if (detail) {
        setSlug(detail.slug);
        setState("has");
      } else {
        setState("none");
      }
    });
    return () => {
      alive = false;
    };
  }, [user.username]);

  if (state === "checking") return <Spinner label={t("admin.searchingPage")} />;

  if (state === "none" || !slug) {
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

  return <FriendEditor slug={slug} limited />;
}
