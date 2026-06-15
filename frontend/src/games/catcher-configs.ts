/* Presets for the shared Catcher engine. One engine, two flavours: feed the fox
   warm noodles, or catch falling stars at dusk. Both stay cozy. */

export interface CatcherItem {
  emoji: string;
  /** Points added on catch — negative for "ouch" items. */
  points: number;
  /** Relative spawn weight. */
  weight: number;
}

export interface CatcherConfig {
  /** CSS background applied to the arena (gradient or color). */
  background: string;
  items: CatcherItem[];
  basketEmoji: string;
  /** Seconds between spawns. */
  spawnEverySec: number;
  /** Fall speed in px/s at the start of the round. */
  speedStartPx: number;
  /** Fall speed in px/s at the end of the round (linear ramp). */
  speedEndPx: number;
  /** Round length in seconds. */
  duration: number;
}

export const feedFoxConfig: CatcherConfig = {
  background: "linear-gradient(180deg, #ffe7c7 0%, #ffd6a8 55%, #ffc089 100%)",
  items: [
    { emoji: "🍜", points: 10, weight: 3 },
    { emoji: "🍙", points: 15, weight: 2 },
    { emoji: "🌶️", points: -5, weight: 1 },
  ],
  basketEmoji: "🦊",
  spawnEverySec: 0.8,
  speedStartPx: 180,
  speedEndPx: 420,
  duration: 40,
};

export const catchStarsConfig: CatcherConfig = {
  background: "linear-gradient(180deg, #3a3f6b 0%, #5b5e92 50%, #8f7bb0 100%)",
  items: [
    { emoji: "⭐", points: 10, weight: 4 },
    { emoji: "💫", points: 25, weight: 1 },
    { emoji: "☄️", points: -5, weight: 1 },
  ],
  basketEmoji: "🧺",
  spawnEverySec: 0.6,
  speedStartPx: 220,
  speedEndPx: 500,
  duration: 35,
};
