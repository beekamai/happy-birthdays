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
    title: "Покорми лисичку",
    icon: "🦊",
    blurb: "Лови падающий рамён в корзинку",
    component: lazy(() => import("./Catcher.tsx")),
    defaultConfig: feedFoxConfig as unknown as Record<string, unknown>,
  },
  "catch-stars": {
    id: "catch-stars",
    title: "Лови звёзды",
    icon: "⭐",
    blurb: "Собери падающие звёздочки",
    component: lazy(() => import("./Catcher.tsx")),
    defaultConfig: catchStarsConfig as unknown as Record<string, unknown>,
  },
  "slide-puzzle": {
    id: "slide-puzzle",
    title: "Пазл",
    icon: "🧩",
    blurb: "Собери картинку из кусочков",
    component: lazy(() => import("./SlidePuzzle.tsx")),
  },
  memory: {
    id: "memory",
    title: "Найди пары",
    icon: "🃏",
    blurb: "Открывай карточки и ищи пары",
    component: lazy(() => import("./Memory.tsx")),
  },
  maze: {
    id: "maze",
    title: "Путь к дружбе",
    icon: "🗺️",
    blurb: "Пройди лабиринт навстречу другу",
    component: lazy(() => import("./Maze.tsx")),
  },
};

/** Look up a game descriptor by id. */
export function getGame(id: string): GameDescriptor | undefined {
  return GAMES[id];
}
