# AGENTS.md

Guide for AI contributors (Claude, Cursor, Copilot, etc.) working on this repo.
Read this first — it gets you productive in ~2 minutes: structure, conventions,
where things live, and the non-obvious gotchas that will bite you.

> Human contributors: this doubles as a contributor cheat-sheet, but it is
> primarily written so an LLM can orient itself without re-discovering the whole
> codebase.

---

## Project at a glance

Personalised birthday pages: each friend gets a server-rendered page at `/:slug`
with a countdown, gifts, themes, a fox pet companion, and small arcade games
whose scores feed a wallet economy (a shop the owner spends points in).

- **Monorepo** managed by **Bun workspaces**: repo root + `backend/` + `frontend/`.
- **Backend** — [ElysiaJS](https://elysiajs.com) 1.4, `bun:sqlite`, server-side
  page rendering, OG image generation via **satori + resvg**.
- **Frontend** — React 19 + Vite + **Tailwind v4** + `lottie-react`, with a tiny
  dependency-free i18n layer (ru + en).
- **No tests, no ESLint.** The one automated gate is `bun run typecheck`
  (`tsc --noEmit` in both workspaces). Treat it as mandatory before "done".

---

## Repo map

```
happy_birthdays/
├── package.json            # workspace root: dev/build/start/typecheck + add-friend/add-gift
├── dev.ts                  # dev orchestrator
├── AGENTS.md               # you are here
├── data/                   # GITIGNORED runtime data (friends configs, sqlite). Never commit.
│   └── friends/<slug>/config.json   # source of truth for a friend (see Gotcha 7)
├── backend/
│   └── src/
│       ├── app.ts          # Elysia app — ROUTE ORDER IS CRITICAL (Gotcha 1)
│       ├── routes/         # apiRoutes, authRoutes, adminRoutes, shopRoutes, ogRoutes, assetRoutes, pageRoutes
│       ├── controllers/    # per-route handlers (authController, ...)
│       ├── services/       # business logic — gameScoring.ts (server-authoritative scores), ...
│       ├── middlewares/    # authMiddleware.ts (authDerive/authMiddleware/ownerMiddleware), rateLimit.ts
│       ├── handlers/       # errorHandler.ts, responseFilter.ts (withResponseFilter — Gotcha 5)
│       ├── utils/          # clientIp.ts, gameSession.ts (anti-cheat token), ...
│       ├── config/         # constants.ts (DIST_DIR, SESSION_SECRET, CLIENT_IP_HEADER, ...)
│       └── assets/fonts/   # static full-charset TTFs for satori (Gotcha 6)
└── frontend/
    └── src/
        ├── games/
        │   ├── registry.ts        # GAMES map (5 games) + getGame() — add a game here
        │   ├── game-types.ts      # GameDescriptor
        │   └── Catcher.tsx / SlidePuzzle.tsx / Memory.tsx / Maze.tsx
        ├── styles/theme.css       # design tokens + [data-theme] overrides (4 themes)
        ├── lib/
        │   ├── i18n.ts            # t(), useT(), ru/en dictionaries — all strings go here
        │   ├── useTheme.ts        # ThemeName union, THEMES list, useTheme()
        │   └── lottie.ts          # isLottie() validation helper
        └── components/            # shared UI (StickerCard, ...) — reuse, don't copy-paste
```

---

## Key conventions

**Reusability is enforced, not optional. Do not hardcode.**

- **Colours** — only design tokens `var(--color-*)` defined in
  `frontend/src/styles/theme.css`. The `@theme` block on `:root` is the light
  "Cozy Ramen" palette; each `[data-theme="..."]` block (light / dark / halloween
  / newyear) re-declares the *same* token set. Never write a raw hex in a
  component. Per-friend accent is the `--color-accent` custom property.
- **Strings** — only via `t("some.key")` from `frontend/src/lib/i18n.ts`. Every
  user-facing string lives in the dictionary as both `ru` (source of truth) and
  `en`. No literal UI text in components.
- **Shared components** — reuse existing ones (`StickerCard`, etc.) instead of
  re-implementing the same card/layout per page.

**General:**

- TypeScript strict everywhere. Prefer native `fetch` (Bun), no `node-fetch`.
- Match the existing style of the file you touch. Block comments `/* ... */` in
  new code; keep JSDoc `/** ... */` on public APIs.
- Surgical changes — every changed line should trace back to the task.

---

## Gotchas for LLMs

These are the traps. Read them before touching backend routing, auth, Lottie,
React hooks, response shapes, OG images, or friend data.

### 1. Route registration order is critical (`backend/src/app.ts`)
Elysia resolves the **first** matching route, so order matters. The fixed order:

```
1. /api/*            JSON API (concrete prefix)
2. /og/:file         generated OG images
3. /friends, /owner, assets   disk assets (concrete / 2-segment)
4. /assets/*         built frontend bundle (static plugin, indexHTML: false)
5. /:slug  and  /    server-rendered pages — CATCH-ALL, MUST BE LAST
```

The single-segment `/:slug` catch-all will swallow anything registered after it.
Add new concrete routes **before** `pageRoutes`.

### 2. Auth is per-route-file `.derive`, not app-level
`authDerive` from `backend/src/middlewares/authMiddleware.ts` must be declared on
**each protected route file's own instance** (`adminRoutes`, `shopRoutes`)
**before** its `.guard(...)`:

```ts
new Elysia()
  .derive(authDerive)                 // resolves { user } into context
  .guard({ beforeHandle: [authMiddleware] }, (app) => app /* ... */)
```

Putting the derive at the app level does **not** work — Elysia's cross-plugin
scope encapsulation means an app-level derive may not reach a `.use()`-mounted
child, so `user` arrives `null`.

Guards:
- `authMiddleware` → 401 if not logged in (stack first).
- `ownerMiddleware` → 403 if not the page owner (stack after `authMiddleware`).

**Per-resource** checks (a friend editing *their own* page) live in the
controller via `canEdit` — they depend on the target config, not just the
session. To add a new protected endpoint: drop it into the right `.guard()`
block. Do **not** call `readUser` manually in the controller.

### 3. Lottie: use the `useLottie` hook, not `<Lottie>`
The default `<Lottie>` component crashes the React tree under Vite
(React error #130). Always render via the `useLottie` hook from `lottie-react`.
Validate animation data with `isLottie()` from `frontend/src/lib/lottie.ts`
before mounting.

### 4. No hooks below an early return
Do not add React hooks *after* an early `return` (loading / not-found guards) —
this caused bug #310 (hook order violation). New hooks go **above** all early
returns, or extract the affected UI into its own isolated component that mounts
only when the data is ready.

### 5. The response filter drops fields not in the 200 schema
`withResponseFilter` (`backend/src/handlers/responseFilter.ts`) strips any field
from a **2xx** response body that isn't declared in the route's 200 schema. This
silently ate the `earned` field once. **When you add a field to a response,
add it to the 200 schema in the same change** — otherwise it vanishes in prod.
Non-2xx responses are passed through unfiltered.

### 6. satori needs a static, full-charset TTF
OG image generation (satori) requires a **static** TTF that covers the full
charset (including Cyrillic). Variable TTFs crash satori, and per-subset fonts
break Cyrillic. See `backend/src/assets/fonts/`. If you swap a font, instance a
static full-charset TTF (e.g. via fonttools) — don't drop in a variable file.

### 7. Friend data is file-based and gitignored
`data/friends/<slug>/config.json` is the **source of truth** for each friend and
is gitignored. The SQLite tables (scores / birthdays / history / shop) are
**derived** and re-synced from configs on boot. Never commit anything under
`data/`.

### 8. pm2 + Bun deployment
pm2 can't run Bun TS directly. The ecosystem config uses
`interpreter: "none"` + `args: "run start"`, and the frontend **must be built
before start** (`bun run build` → `bun run start`).

### 9. Security basics that must stay wired
- Rate limiting: `backend/src/middlewares/rateLimit.ts`.
- Client IP resolution: `backend/src/utils/clientIp.ts`
  (`cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`, header configurable via
  `CLIENT_IP_HEADER`). Use this helper for IP — don't read headers ad hoc.
- `SESSION_SECRET` is **required** in production (JWT signing secret).
- Game scores are **server-authoritative** (`backend/src/services/gameScoring.ts`)
  and gated by an anti-cheat session token (`backend/src/utils/gameSession.ts`).
  Don't trust client-submitted scores.

---

## Common tasks

### Add a game
1. Write the component in `frontend/src/games/` (or reuse the Catcher engine like
   `feed-fox` / `catch-stars`, which differ only in `defaultConfig`).
2. Register **one entry** in `frontend/src/games/registry.ts`:
   ```ts
   "my-game": {
     id: "my-game",
     titleKey: "game.my-game.title",
     icon: "🎯",
     blurbKey: "game.my-game.blurb",
     component: lazy(() => import("./MyGame.tsx")),
     // defaultConfig?: only if it reuses a shared engine
   },
   ```
3. Add the `game.my-game.title` / `game.my-game.blurb` keys to **both** `ru` and
   `en` in `frontend/src/lib/i18n.ts`.
4. If the game submits a score, wire it through the server-authoritative scoring
   in `backend/src/services/gameScoring.ts` — never trust a client score.

### Add a theme
1. Add a new `:root[data-theme="x"] { ... }` block in
   `frontend/src/styles/theme.css`. Re-declare **every** `--color-*` token (and
   the shadows where the surface is darker) — don't rely on light-mode fallback.
2. Register it in `frontend/src/lib/useTheme.ts`: add to the `ThemeName` union,
   the `THEMES` array, and the `isTheme()` guard.
3. Add a label key for the theme name to `frontend/src/lib/i18n.ts` (ru + en).

### Add a friend
Use the script — don't hand-edit data by hand:
```bash
bun run add-friend
```
It scaffolds `data/friends/<slug>/config.json` (the source of truth). The DB
syncs from it on boot. Nothing here gets committed (`data/` is gitignored).

### Add a gift
```bash
bun run add-gift
```
Manages a friend's gift list in their `config.json`.

### Add an i18n string
Open `frontend/src/lib/i18n.ts`, add the key to the `ru` dictionary (source of
truth) **and** the `en` dictionary. Reference it in the component via `t("key")`
or the `useT()` hook. `t(key, vars)` does `{var}` interpolation. A missing `en`
value falls back to `ru`, then to the key itself.

---

## Build & verify

From the repo root:

| Command | What it does |
|---|---|
| `bun run dev` | Dev orchestrator (backend + Vite). |
| `bun run build` | Build the frontend bundle. |
| `bun run start` | Start the backend (serves built frontend). |
| `bun run typecheck` | `tsc --noEmit` across both workspaces — **the verification gate.** |
| `bun run add-friend` | Scaffold a new friend config. |
| `bun run add-gift` | Manage a friend's gifts. |

**Before saying "done": run `bun run typecheck` and make sure it passes.** There
are no tests and no linter, so the type checker is the only safety net — rely on
it.

For a production-shaped run, build before start:
```bash
bun run build && bun run start
```

---

## Commit style

- **English**, imperative mood, concise, describing the change. (Public repo —
  keep history professional.)
- Real examples from this repo:
  - `Add gift manager: ...`
  - `Fix gift display/layout/date + drag jitter`
  - `Centralize auth as Elysia derive + route guards`
- **No** `Co-Authored-By`, no assistant signatures, no AI mentions anywhere in
  commits, PRs, tags, or messages.
- Before committing, sanity-check `git status` / `git ls-files` so nothing under
  `data/` or any secret slips in.

---

> Maintenance note: keep this file current. If you change route order, auth
> wiring, the theme/game/i18n flow, the build scripts, or any gotcha above,
> update the matching section here in the same change — a stale AGENTS.md misleads
> every future agent.
