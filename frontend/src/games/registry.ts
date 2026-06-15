import { lazy } from "react";

import type { GameDescriptor } from "./game-types.ts";
import { feedFoxConfig, catchStarsConfig } from "./catcher-configs.ts";

/* The pluggable game registry. Each entry lazily imports its component so games
   ship as separate chunks. `feed-fox` and `catch-stars` share the Catcher
   engine, differing only in `defaultConfig`. To add a game: write the component,
   add one entry here. Friends reference games by `gameId`. */

export const GAMES: Record<string, GameDescriptor> = {
  "feed-fox": {
    id: "feed-fox",
    titleKey: "game.feed-fox.title",
    icon: "🦊",
    blurbKey: "game.feed-fox.blurb",
    component: lazy(() => import("./Catcher.tsx")),
    defaultConfig: feedFoxConfig as unknown as Record<string, unknown>,
  },
  "catch-stars": {
    id: "catch-stars",
    titleKey: "game.catch-stars.title",
    icon: "⭐",
    blurbKey: "game.catch-stars.blurb",
    component: lazy(() => import("./Catcher.tsx")),
    defaultConfig: catchStarsConfig as unknown as Record<string, unknown>,
  },
  "slide-puzzle": {
    id: "slide-puzzle",
    titleKey: "game.slide-puzzle.title",
    icon: "🧩",
    blurbKey: "game.slide-puzzle.blurb",
    component: lazy(() => import("./SlidePuzzle.tsx")),
  },
  memory: {
    id: "memory",
    titleKey: "game.memory.title",
    icon: "🃏",
    blurbKey: "game.memory.blurb",
    component: lazy(() => import("./Memory.tsx")),
  },
  maze: {
    id: "maze",
    titleKey: "game.maze.title",
    icon: "🗺️",
    blurbKey: "game.maze.blurb",
    component: lazy(() => import("./Maze.tsx")),
  },
};

/** Look up a game descriptor by id. */
export function getGame(id: string): GameDescriptor | undefined {
  return GAMES[id];
}
