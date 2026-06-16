import type { PublicFriend } from "../lib/types.ts";
import { useT } from "../lib/i18n.ts";
import { friendDisplayName } from "../lib/friendContent.ts";
import { Steam } from "../components/decor/Steam.tsx";
import { DecoratedAvatar, DecorBadge } from "../components/decor/Decorations.tsx";

import { Countdown } from "./Countdown.tsx";

/* The page hero: a bobbing avatar crowned with rising ramen steam, the
   friend's name and handle, and the cozy birthday countdown chip below. */

interface HeroProps {
  friend: PublicFriend;
}

/** Centered avatar + name + countdown hero block. */
export function Hero({ friend }: HeroProps) {
  const { t, lang } = useT();
  const name = friendDisplayName(friend, lang);
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {/* Relative anchor so the absolutely-positioned Steam rises above the avatar. */}
      <div className="relative">
        <Steam count={4} />
        {/* The avatar links through to the friend's personal profile. */}
        <a
          href={`/u/${friend.slug}`}
          title={t("hero.viewProfile")}
          className="block transition-transform duration-200 ease-[var(--ease-bounce)] hover:scale-105"
        >
          <DecoratedAvatar
            src={friend.avatarUrl}
            alt={name}
            frameId={friend.decor?.avatarFrame}
            animate
          />
        </a>
      </div>

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
    </div>
  );
}
