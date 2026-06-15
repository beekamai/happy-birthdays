/* Page-access window logic. A friend's page is live only on their birthday and
   for ACCESS_WINDOW_DAYS after it:
     - day 0            → "open"    (the full celebration)
     - day +1..+N       → "closing" (full page + a banner that it will close)
     - otherwise        → "locked"  (just avatar/name/handle + countdown)
   The server decides this so it can't be bypassed (and scoring is blocked while
   locked). */

export const ACCESS_WINDOW_DAYS = 2;

export type AccessState = "open" | "closing" | "locked";

export interface AccessInfo {
    state: AccessState;
    /** Days until the next birthday (0 on the birthday itself). */
    daysUntilBirthday: number;
    /** While open/closing: days until the page locks again (0 when locked). */
    closesInDays: number;
}

const DAY_MS = 86_400_000;

/** Compute the access window for a month/day birthday relative to `now`. */
export function computeAccess(month: number, day: number, now: Date = new Date()): AccessInfo {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /* Most recent birthday occurrence (this year if already reached, else last). */
    let last = new Date(today.getFullYear(), month - 1, day);
    if (last.getTime() > today.getTime()) {
        last = new Date(today.getFullYear() - 1, month - 1, day);
    }
    const daysSince = Math.round((today.getTime() - last.getTime()) / DAY_MS);

    /* Next birthday occurrence (today counts as 0). */
    let next = new Date(today.getFullYear(), month - 1, day);
    if (next.getTime() < today.getTime()) {
        next = new Date(today.getFullYear() + 1, month - 1, day);
    }
    const daysUntilBirthday = Math.round((next.getTime() - today.getTime()) / DAY_MS);

    if (daysSince <= ACCESS_WINDOW_DAYS) {
        return {
            state: daysSince === 0 ? "open" : "closing",
            daysUntilBirthday,
            closesInDays: ACCESS_WINDOW_DAYS + 1 - daysSince,
        };
    }
    return { state: "locked", daysUntilBirthday, closesInDays: 0 };
}

/** Scoring + games are only allowed while the page is open or closing. */
export function isPlayable(access: AccessInfo): boolean {
    return access.state !== "locked";
}
