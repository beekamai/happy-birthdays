import type { PublicFriend } from "../lib/types.ts";
import { Steam } from "../components/decor/Steam.tsx";

import { Countdown } from "./Countdown.tsx";

/* The page hero: a bobbing avatar crowned with rising ramen steam, the
   friend's name and handle, and the cozy birthday countdown chip below. */

interface HeroProps {
  friend: PublicFriend;
}

/** Centered avatar + name + countdown hero block. */
export function Hero({ friend }: HeroProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {/* Relative anchor so the absolutely-positioned Steam rises above the avatar. */}
      <div className="relative">
        <Steam count={4} />
        <img
          src={friend.avatarUrl}
          alt={friend.displayName}
          className="animate-bob size-32 rounded-full border-[4px] border-white object-cover shadow-[var(--shadow-md)]"
          style={{ outline: "3px solid var(--color-accent)", outlineOffset: "3px" }}
        />
      </div>

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-4xl">{friend.displayName}</h1>
        <p className="text-[var(--color-text-soft)]">{friend.username}</p>
      </div>

      <Countdown birthday={friend.birthday} />
    </div>
  );
}
