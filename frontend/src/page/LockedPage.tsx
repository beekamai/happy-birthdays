import { useEffect, type CSSProperties } from "react";

import type { PublicFriend } from "../lib/types.ts";
import { useTheme } from "../lib/useTheme.ts";
import { useT, initLang } from "../lib/i18n.ts";
import { friendDisplayName } from "../lib/friendContent.ts";
import { ControlBar } from "../components/ControlBar.tsx";
import { ThemeSwitcher } from "../components/ThemeSwitcher.tsx";
import { LanguageSwitcher } from "../components/LanguageSwitcher.tsx";
import { AccountButton } from "../components/AccountButton.tsx";
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
import { Countdown } from "./Countdown.tsx";
import { GiftList } from "./GiftList.tsx";

/* Shown outside the birthday window: just the friend's identity and a countdown
   to their next birthday — no greeting, gift, games or scoring. */
export function LockedPage({ friend }: { friend: PublicFriend }) {
  const accentStyle = { "--color-accent": friend.accent } as CSSProperties;
  const { theme, setTheme, themes } = useTheme(friend.theme);
  const { t, lang } = useT();
  const name = friendDisplayName(friend, lang);

  useEffect(() => {
    initLang(friend.lang);
  }, [friend.lang]);

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
      <DecorBackground id={friend.decor?.background} />
      <ThemeDecor theme={theme} />
      <DecorEffect id={friend.decor?.effect} />
      <Particles count={8} />
      <Lanterns count={5} />

      <div className="relative flex flex-col items-center gap-5">
        {/* The avatar links through to the friend's personal profile (same as
           the active birthday page). */}
        <a
          href={`/u/${friend.slug}`}
          title={t("hero.viewProfile")}
          className="block transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-105"
        >
          <DecoratedAvatar
            src={friend.avatarUrl}
            alt={name}
            frameId={friend.decor?.avatarFrame}
            grayscale
          />
        </a>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl">
            {name}
            <DecorBadge id={friend.decor?.badge} />
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

        <Countdown birthday={friend.birthday} />

        <StickerCard hover={false} className="max-w-sm text-center">
          <div className="text-4xl" aria-hidden="true">
            🔒🎂
          </div>
          <p className="mt-3 text-[var(--color-text-soft)]">
            {t("locked.opensOn")}
            {friend.access.daysUntilBirthday === 0
              ? t("locked.today")
              : t("locked.inDays", { n: friend.access.daysUntilBirthday })}
          </p>
        </StickerCard>

        {friend.giftHistory && friend.giftHistory.length > 0 && (
          <GiftList gifts={friend.giftHistory} layout={friend.giftLayout} />
        )}
      </div>
    </main>
  );
}
