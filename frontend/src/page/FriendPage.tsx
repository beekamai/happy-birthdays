import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import confetti from "canvas-confetti";

import type { PublicFriend, SiteConfig } from "../lib/types.ts";
import { useTotals } from "../lib/useTotals.ts";
import { getVisitorId } from "../lib/visitor.ts";
import { unlockAudio } from "../lib/sound.ts";
import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { friendMessage, friendGiftName } from "../lib/friendContent.ts";
import { SoundToggle } from "../components/SoundToggle.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { ThemeDecor } from "../components/decor/ThemeDecor.tsx";
import { DecorBackground, DecorEffect } from "../components/decor/Decorations.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";

import { Hero } from "./Hero.tsx";
import { GiftCard } from "./GiftCard.tsx";
import { GiftList } from "./GiftList.tsx";
import { GamesGrid } from "./GamesGrid.tsx";
import { PetCompanion } from "../pet/PetCompanion.tsx";

/* The full birthday page for a single friend. Sets the per-friend accent on the
   wrapper so every child inherits `--color-accent`, then lays out a single cozy
   scroll: hero, message, gift, games, footer — with ambient decor behind it and
   a draggable pet companion floating above everything. */

interface FriendPageProps {
  friend: PublicFriend;
  site: SiteConfig | null;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Composed birthday page for one friend. */
export function FriendPage({ friend, site }: FriendPageProps) {
  const accentStyle = { "--color-accent": friend.accent } as CSSProperties;
  const { theme, setTheme, themes } = useTheme(friend.theme);
  const { t, lang } = useT();
  const visitorId = getVisitorId();
  /* Gift card with the name localized to the active language. */
  const localizedGift = friend.gift
    ? { ...friend.gift, name: friendGiftName(friend, lang) }
    : undefined;

  /* Initialise language from the friend's default (a stored override wins). */
  useEffect(() => {
    initLang(friend.lang);
  }, [friend.lang]);
  const { totals, refresh } = useTotals(friend.slug, visitorId);

  /* One gentle welcome burst on mount — never on a reduced-motion preference,
     and guarded so React's strict double-invoke can't double-fire it. */
  const burstedRef = useRef(false);
  useEffect(() => {
    if (burstedRef.current || prefersReducedMotion()) return;
    burstedRef.current = true;
    const id = window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 65,
        startVelocity: 38,
        origin: { y: 0.35 },
      });
    }, 350);
    return () => window.clearTimeout(id);
  }, []);

  /* Prime the audio context on the first user gesture (browsers require one). */
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <main
      data-friend={friend.slug}
      style={accentStyle}
      className="relative min-h-[100dvh] overflow-hidden px-5 pt-24 pb-16"
    >
      <SoundToggle />
      <ThemeSwitcher theme={theme} setTheme={setTheme} themes={themes} />
      <LanguageSwitcher />
      <AccountButton />
      {/* Ambient decor — non-interactive, behind the content. */}
      <DecorBackground id={friend.decor?.background} />
      <ThemeDecor theme={theme} />
      <DecorEffect id={friend.decor?.effect} />
      <Particles />
      <Lanterns count={5} />

      <div className="relative mx-auto flex w-full max-w-[640px] flex-col gap-8">
        {friend.access.state === "closing" && (
          <div className="rounded-[var(--radius-lg)] border-[2px] border-[var(--color-lantern)] bg-[var(--color-lantern-glow)]/25 px-5 py-3 text-center text-sm font-bold text-[var(--color-text)]">
            {t("friend.closingBanner", { n: friend.access.closesInDays })}
          </div>
        )}
        <Hero friend={friend} />

        <StickerCard hover={false}>
          <p className="text-center text-lg leading-relaxed text-[var(--color-text)] italic">
            {friendMessage(friend, lang)}
          </p>
        </StickerCard>

        {/* Gift: a single current card, or the full dated list (owner setting). */}
        {friend.giftDisplay === "all" && friend.giftHistory && friend.giftHistory.length > 0 ? (
          <div className="flex justify-center">
            <GiftList gifts={friend.giftHistory} />
          </div>
        ) : (
          localizedGift && <GiftCard gift={localizedGift} />
        )}

        {/* Games + scores — hidden entirely when the friend turned them off. */}
        {friend.gamesEnabled && (
          <>
            {totals && (totals.personal.total > 0 || totals.global.total > 0) && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-ramen-gold)] bg-[var(--color-ramen-gold)]/15 px-5 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
                  <span aria-hidden="true">🏅</span>
                  {t("friend.yourScore", { n: totals.personal.total })}
                </span>
                <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-secondary)] bg-[var(--color-secondary)]/15 px-5 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
                  <span aria-hidden="true">🌍</span>
                  {t("friend.pageTotal", { n: totals.global.total })}
                </span>
              </div>
            )}

            <GamesGrid friend={friend} site={site} visitorId={visitorId} onScored={refresh} />
          </>
        )}

        <footer className="mt-2 flex items-center justify-center gap-2 text-[var(--color-text-soft)]">
          <span>{t("friend.footer", { name: site?.owner.displayName ?? "beekamai" })}</span>
          {site?.owner.avatarUrl && (
            <img
              src={site.owner.avatarUrl}
              alt={site.owner.displayName}
              className="size-7 rounded-full border-[2px] border-white object-cover shadow-[var(--shadow-sm)]"
            />
          )}
        </footer>
      </div>

      {/* Floating overlay — lives outside the scroll column. */}
      <PetCompanion slug={friend.slug} />
    </main>
  );
}
