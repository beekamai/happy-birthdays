import { useEffect, useState, type CSSProperties } from "react";

import type { Decor, PublicFriend } from "../lib/types.ts";
import { getVisitorId } from "../lib/visitor.ts";
import { useTotals } from "../lib/useTotals.ts";
import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { friendDisplayName, friendBio } from "../lib/friendContent.ts";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { SocialLinks } from "../components/SocialLinks.tsx";
import { ControlBar } from "../components/ControlBar.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { PetCompanion } from "../pet/PetCompanion.tsx";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { ThemeDecor } from "../components/decor/ThemeDecor.tsx";
import {
  DecoratedAvatar,
  DecorBadge,
  DecorBackground,
  DecorEffect,
} from "../components/decor/Decorations.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";
import { Shop } from "../components/Shop.tsx";

/* The personal profile at /u/<slug> — always available, independent of the
   birthday window. Shows identity, bio, social links, the friend's points
   wallet, and a link through to their birthday page. The owner / the friend
   themselves additionally see an Edit shortcut to the admin editor. */

/* Lightweight session probe — true when the viewer may edit this page. Kept
   inline (not via the lazy admin bundle) so the public profile stays slim. */
function useCanEdit(friend: PublicFriend | null): boolean {
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => {
    if (!friend) return;
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { username?: string; isOwner?: boolean } | null } | null) => {
        const user = data?.user;
        if (!alive || !user) return;
        const handle = friend.username.replace(/^@/, "").toLowerCase();
        setCanEdit(Boolean(user.isOwner) || user.username === handle);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [friend]);
  return canEdit;
}

/** Personal profile page for one friend. */
export function ProfilePage({ friend }: { friend: PublicFriend }) {
  const accentStyle = { "--color-accent": friend.accent } as CSSProperties;
  const { theme, setTheme, themes } = useTheme(friend.theme);
  const { t, lang } = useT();
  const visitorId = getVisitorId();
  const { totals } = useTotals(friend.slug, visitorId);
  const canEdit = useCanEdit(friend);
  const [shopOpen, setShopOpen] = useState(false);
  /* Equipped decor lives in local state so shop purchases re-render the page
     instantly, with no reload. Seeded from the loaded friend. */
  const [decor, setDecor] = useState<Decor | undefined>(friend.decor);

  useEffect(() => {
    initLang(friend.lang);
  }, [friend.lang]);

  const name = friendDisplayName(friend, lang);
  const bio = friendBio(friend, lang);
  const points = totals?.global.total ?? 0;

  return (
    <main
      data-friend={friend.slug}
      style={accentStyle}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 py-16"
    >
      <ControlBar>
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
        <AccountButton />
      </ControlBar>
      <DecorBackground id={decor?.background} />
      <ThemeDecor theme={theme} />
      <DecorEffect id={decor?.effect} />
      <Particles count={8} />
      <Lanterns count={5} />

      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="relative">
          <DecoratedAvatar
            src={friend.avatarUrl}
            alt={name}
            frameId={decor?.avatarFrame}
          />
          {/* Owner/friend tools tucked onto the avatar's corner — compact icons
             so the public view stays clean. */}
          {canEdit && (
            <div className="absolute -top-1 -right-1 flex flex-col gap-1.5">
              <a
                href="/account"
                title={t("profile.edit")}
                aria-label={t("profile.edit")}
                className="flex size-9 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 text-base shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-110 active:scale-95"
              >
                <span aria-hidden="true">✏️</span>
              </a>
              <button
                type="button"
                onClick={() => setShopOpen(true)}
                title={t("shop.open")}
                aria-label={t("shop.open")}
                className="flex size-9 items-center justify-center rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)]/90 text-base shadow-[var(--shadow-sm)] backdrop-blur-sm transition-transform duration-200 hover:scale-110 active:scale-95"
              >
                <span aria-hidden="true">🛍️</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl">
            {name}
            <DecorBadge id={decor?.badge} />
          </h1>
          <a
            href={`https://t.me/${friend.username.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-secondary-deep)]"
          >
            {friend.username}
          </a>
        </div>

        {/* Points wallet earned by visitors playing on the birthday page. */}
        <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-ramen-gold)] bg-[var(--color-ramen-gold)]/15 px-5 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
          <span aria-hidden="true">🏅</span>
          {t("profile.points", { n: points })}
        </span>

        {bio && (
          <StickerCard hover={false} className="max-w-sm text-center">
            <p className="leading-relaxed text-[var(--color-text)]">{bio}</p>
          </StickerCard>
        )}

        {friend.socials && friend.socials.length > 0 && (
          <SocialLinks links={friend.socials} style={friend.socialStyle ?? "icon"} />
        )}

        <div className="mt-2 flex items-center justify-center">
          <a
            href={`/${friend.slug}`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-primary-deep)] bg-[var(--color-primary)] px-6 py-3 font-bold text-[var(--color-on-primary)] shadow-[var(--shadow-md)] transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-[1.03]"
          >
            {t("profile.birthdayPage")}
          </a>
        </div>

        <footer className="mt-2 flex justify-center text-[var(--color-text-soft)]">
          <a
            href="/"
            className="text-sm opacity-70 transition-opacity duration-200 hover:opacity-100"
          >
            {t("nav.home")}
          </a>
        </footer>
      </div>

      {/* A bought fox companion follows the friend onto their profile too. */}
      {decor?.companion === "pet-fox" && <PetCompanion slug={friend.slug} />}

      {canEdit && (
        <Shop
          slug={friend.slug}
          open={shopOpen}
          onClose={() => setShopOpen(false)}
          onChange={(equipped) =>
            setDecor({
              avatarFrame: equipped.avatarFrame,
              background: equipped.background,
              badge: equipped.badge,
              effect: equipped.effect,
              companion: equipped.companion,
            })
          }
        />
      )}
    </main>
  );
}
