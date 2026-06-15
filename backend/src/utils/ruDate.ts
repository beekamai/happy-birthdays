/* Russian month names in genitive case (for "15 июня" style dates). */
const RU_MONTHS_GENITIVE = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
];

/**
 * Format a birthday as a Russian date string, e.g. "15 июня" — appending the
 * year when present ("15 июня 1998"). Falls back to a bare day when the month
 * is out of range.
 */
export function formatRuDate(b: { month: number; day: number; year?: number }): string {
    const monthName = RU_MONTHS_GENITIVE[b.month - 1];
    const base = monthName ? `${b.day} ${monthName}` : `${b.day}`;
    return b.year ? `${base} ${b.year}` : base;
}
