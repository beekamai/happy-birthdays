import type { CSSProperties } from "react";

import type { PublicFriend } from "../lib/types.ts";
import { Lanterns } from "../components/decor/Lanterns.tsx";
import { Particles } from "../components/decor/Particles.tsx";
import { StickerCard } from "../components/decor/StickerCard.tsx";
import { Countdown } from "./Countdown.tsx";
import { GiftList } from "./GiftList.tsx";

/* Shown outside the birthday window: just the friend's identity and a countdown
   to their next birthday — no greeting, gift, games or scoring. */
export function LockedPage({ friend }: { friend: PublicFriend }) {
  const accentStyle = { "--color-accent": friend.accent } as CSSProperties;

  return (
    <main
      data-friend={friend.slug}
      style={accentStyle}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 py-16"
    >
      <Particles count={8} />
      <Lanterns count={5} />

      <div className="relative flex flex-col items-center gap-5">
        <img
          src={friend.avatarUrl}
          alt={friend.displayName}
          className="size-32 rounded-full border-[4px] border-white object-cover shadow-[var(--shadow-md)]"
          style={{
            outline: "3px solid var(--color-accent)",
            outlineOffset: "3px",
            filter: "grayscale(0.25)",
          }}
        />

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl">{friend.displayName}</h1>
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
            Праздничная страничка откроется в день рождения
            {friend.access.daysUntilBirthday === 0
              ? " — сегодня! 🎉"
              : ` — через ${friend.access.daysUntilBirthday} дн. 🎉`}
          </p>
        </StickerCard>

        {friend.giftHistory && friend.giftHistory.length > 0 && (
          <GiftList gifts={friend.giftHistory} />
        )}
      </div>
    </main>
  );
}
