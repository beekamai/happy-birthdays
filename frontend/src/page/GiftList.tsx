import type { PublicFriend } from "../lib/types.ts";
import { StickerCard } from "../components/decor/StickerCard.tsx";

/* A dated list of all gifts — shown outside the birthday window (and optionally
   in-window when the owner prefers a list over the single current gift). */

const MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function formatDate(d?: string): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
  if (!m) return d;
  const month = MONTHS[Number(m[2]) - 1] ?? "";
  return `${Number(m[3])} ${month} ${m[1]}`;
}

export function GiftList({
  gifts,
}: {
  gifts: NonNullable<PublicFriend["giftHistory"]>;
}) {
  if (!gifts.length) return null;

  return (
    <StickerCard hover={false} className="w-full max-w-sm">
      <h3 className="text-center text-xl">Подарки 🎁</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {gifts.map((g, i) => (
          <li
            key={`${g.name}-${i}`}
            className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-cream)] px-3 py-2"
          >
            <span className="text-2xl select-none" aria-hidden="true">
              {g.emoji ?? "🎁"}
            </span>
            <div className="flex-1 text-left">
              {g.link ? (
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
              )}
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
