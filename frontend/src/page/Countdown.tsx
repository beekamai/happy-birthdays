import { useMemo } from "react";

/* A small cozy chip showing how many days remain until the friend's next
   birthday — or a festive "it's today!" badge when the day has arrived.
   Computed once per mount via useMemo (no live ticking needed). */

interface CountdownProps {
  birthday: { month: number; day: number; year?: number };
}

/* Russian pluralization for день/дня/дней. */
function pluralizeDays(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  const mod10 = n % 10;
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

/* Returns { isToday, days } for the next occurrence of month/day from today,
   comparing date-only (midnight) to avoid time-of-day drift. */
function computeCountdown(month: number, day: number): {
  isToday: boolean;
  days: number;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (now.getMonth() + 1 === month && now.getDate() === day) {
    return { isToday: true, days: 0 };
  }

  /* Months are 1-based in the data, 0-based in Date. */
  let target = new Date(today.getFullYear(), month - 1, day);
  if (target.getTime() < today.getTime()) {
    target = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((target.getTime() - today.getTime()) / msPerDay);
  return { isToday: false, days };
}

/** Cozy "days until birthday" chip. */
export function Countdown({ birthday }: CountdownProps) {
  const { isToday, days } = useMemo(
    () => computeCountdown(birthday.month, birthday.day),
    [birthday.month, birthday.day],
  );

  if (isToday) {
    return (
      <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-[var(--color-accent)] bg-[var(--color-surface)] px-4 py-2 font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)]">
        <span aria-hidden="true">🎉</span>
        Сегодня твой день!
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border-[2px] border-white bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] shadow-[var(--shadow-sm)]">
      <span aria-hidden="true">📅</span>
      <span>
        До дня рождения{" "}
        <span className="font-bold">{days}</span> {pluralizeDays(days)}
      </span>
    </span>
  );
}
