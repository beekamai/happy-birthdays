import { useEffect, useState } from "react";
import { useLottie } from "lottie-react";

import type { PublicFriend } from "../lib/types.ts";
import { StickerCard } from "../components/decor/StickerCard.tsx";
import { useT } from "../lib/i18n.ts";
import { isLottie } from "../lib/lottie.ts";

/* A dated collection of gifts — shown outside the birthday window, and in-window
   when the owner prefers the full history over the single current gift. Each
   entry shows its real Lottie animation when it has one (falling back to the
   emoji); `layout` switches between a vertical list and a grid of blocks. */

type Gift = NonNullable<PublicFriend["giftHistory"]>[number];

/* Per-gift animation thumbnail: fetches + renders the gift's Lottie when present
   (via the useLottie HOOK — never the default <Lottie>, which crashes under
   Vite's CJS interop, React #130), otherwise the cozy emoji. */
function GiftThumb({ gift, size }: { gift: Gift; size: number }) {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    if (!gift.lottie) {
      setData(null);
      return;
    }
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

  if (data) return <LottieThumb data={data} size={size} />;
  return (
    <span
      className="flex shrink-0 items-center justify-center select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
      aria-hidden="true"
    >
      {gift.emoji ?? "🎁"}
    </span>
  );
}

/* Isolated so the useLottie hook runs only once we hold animation data. */
function LottieThumb({ data, size }: { data: object; size: number }) {
  const { View } = useLottie({ animationData: data, loop: true, autoplay: true });
  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      {View}
    </div>
  );
}

export function GiftList({
  gifts,
  layout = "list",
}: {
  gifts: NonNullable<PublicFriend["giftHistory"]>;
  layout?: "list" | "blocks";
}) {
  const { t } = useT();

  /* "DD <month> YYYY" using the localized short month; unparsable input passes
     through unchanged. */
  const formatDate = (d?: string): string => {
    if (!d) return "";
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
    if (!m) return d;
    const month = t(`month.short.${Number(m[2])}`);
    return `${Number(m[3])} ${month} ${m[1]}`;
  };

  if (!gifts.length) return null;

  const nameNode = (g: Gift) =>
    g.link ? (
      <a
        href={g.link}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-[var(--color-accent)] underline decoration-dotted underline-offset-2"
      >
        {g.name}
      </a>
    ) : (
      <span className="font-bold text-[var(--color-text)]">{g.name}</span>
    );

  if (layout === "blocks") {
    return (
      <StickerCard hover={false} className="w-full max-w-md">
        <h3 className="text-center text-xl">{t("giftList.title")}</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gifts.map((g, i) => (
            <div
              key={`${g.name}-${i}`}
              className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-cream)] p-3 text-center"
            >
              <GiftThumb gift={g} size={72} />
              <div className="text-sm">{nameNode(g)}</div>
              {g.date && (
                <div className="text-xs text-[var(--color-text-soft)]">
                  {formatDate(g.date)}
                </div>
              )}
            </div>
          ))}
        </div>
      </StickerCard>
    );
  }

  return (
    <StickerCard hover={false} className="w-full max-w-sm">
      <h3 className="text-center text-xl">{t("giftList.title")}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {gifts.map((g, i) => (
          <li
            key={`${g.name}-${i}`}
            className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-cream)] px-3 py-2"
          >
            <GiftThumb gift={g} size={48} />
            <div className="flex-1 text-left">
              {nameNode(g)}
              {g.date && (
                <div className="text-xs text-[var(--color-text-soft)]">
                  {formatDate(g.date)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </StickerCard>
  );
}
