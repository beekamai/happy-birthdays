import type { LazyExoticComponent, ComponentType } from "react";

import type { PublicFriend, SiteConfig } from "../lib/types.ts";

/* Shared contracts for the pluggable mini-game system. Every game is a plain
   component that takes {@link GameProps} and calls `onFinish` exactly once when
   it ends. Score posting + finish UI live in GameHost, never in the game. */

/** The outcome of a single play-through, handed to GameHost via `onFinish`. */
export interface GameResult {
  score: number;
  durationMs: number;
  won: boolean;
  meta?: Record<string, unknown>;
}

/** Props injected into every game component by GameHost. */
export interface GameProps {
  friend: PublicFriend;
  site: SiteConfig | null;
  /** Call once when the game ends (win or lose). */
  onFinish: (r: GameResult) => void;
  /** Per-friend overrides merged over the descriptor's `defaultConfig`. */
  config?: Record<string, unknown>;
}

/** Registry entry describing a game: metadata + a lazily-loaded component. */
export interface GameDescriptor {
  id: string;
  title: string;
  /** Emoji shown on the launcher card. */
  icon: string;
  /** One-line description shown on the card. */
  blurb: string;
  component: LazyExoticComponent<ComponentType<GameProps>>;
  defaultConfig?: Record<string, unknown>;
}
