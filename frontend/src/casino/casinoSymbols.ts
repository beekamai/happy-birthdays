/* The one place that turns the server's ascii symbol ids (see
   backend/src/services/casino.ts) into something to look at. Ids travel over the
   wire so they stay loggable; emoji live here so a new table only needs a line
   in this map plus its i18n keys. */

const SYMBOL_EMOJI: Record<string, string> = {
  /* Coin faces */
  fox: "🦊",
  star: "⭐",
  /* Slot reels — `ramen` is the jackpot symbol. */
  ramen: "🍜",
  cake: "🎂",
  dango: "🍡",
  balloon: "🎈",
  /* Dice faces */
  "1": "⚀",
  "2": "⚁",
  "3": "⚂",
  "4": "⚃",
  "5": "⚄",
  "6": "⚅",
};

/** Emoji for a symbol id, falling back to the id itself for unknown ones. */
export function symbolEmoji(id: string): string {
  return SYMBOL_EMOJI[id] ?? id;
}

/** Emoji shown on a table's launcher tab. */
export const GAME_ICON: Record<string, string> = {
  coin: "🪙",
  dice: "🎲",
  slots: "🎰",
};
