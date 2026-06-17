import { useEffect, useState } from "react";
import { useLottie } from "lottie-react";

import type { PublicFriend } from "../lib/types.ts";
import { StickerCard } from "../components/decor/StickerCard.tsx";
import { useT } from "../lib/i18n.ts";
import { isLottie } from "../lib/lottie.ts";

/* The gift reveal card: a Lottie animation when available, otherwise a big
   cozy emoji. Caption announces the gift with a sparkle.

   NOTE: we render via the `useLottie` HOOK, not the default `<Lottie>` export —
   the latter resolves to a non-component object under Vite's CJS interop and
   crashes the tree (React #130). The hook returns a plain element (`View`). */

interface GiftCardProps {
  gift: NonNullable<PublicFriend["gift"]>;
}

/* Isolated so the `useLottie` hook only runs once we actually have animation
   data (hooks can't be called conditionally in the parent). */
function LottieGift({ data }: { data: object }) {
  const { View } = useLottie({ animationData: data, loop: true, autoplay: true });
  return (
    <div style={{ width: 180, height: 180 }} className="mx-auto">
      {View}
    </div>
  );
}

/** A sticker card revealing the friend's birthday gift. */
export function GiftCard({ gift }: GiftCardProps) {
  const { t } = useT();
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    if (!gift.lottie) return;

    let alive = true;
    fetch(gift.lottie)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (alive) setData(isLottie(json) ? (json as object) : null);
      })
      .catch(() => {
        if (alive) setData(null);
      });

    return () => {
      alive = false;
    };
  }, [gift.lottie]);

  const visual = data ? (
    <LottieGift data={data} />
  ) : (
    <span className="animate-bob text-7xl select-none" aria-hidden="true">
      {gift.emoji}
    </span>
  );

  return (
    <StickerCard>
      <div className="flex flex-col items-center gap-4 text-center">
        {gift.link ? (
          <a
            href={gift.link}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform duration-200 hover:scale-105"
            title={t("gift.open")}
          >
            {visual}
          </a>
        ) : (
          visual
        )}

        <p className="text-[var(--color-text-soft)]">
          {t("gift.youGot")}{" "}
          {gift.link ? (
            <a
              href={gift.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--color-accent)] underline decoration-dotted underline-offset-4"
            >
              {gift.name}
            </a>
          ) : (
            <span className="font-bold text-[var(--color-text)]">{gift.name}</span>
          )}{" "}
          <span aria-hidden="true">✨</span>
        </p>
      </div>
    </StickerCard>
  );
}
