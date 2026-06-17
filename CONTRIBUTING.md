# Contributing to happy_birthdays

Thanks for your interest in improving the project. This guide covers the dev
workflow, repo layout, how to test the Telegram login locally, and the
conventions a pull request is expected to follow.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- [Bun](https://bun.sh) (the project is Bun-first; `npm`/`node` are not used)
- A GitHub account
- For testing the admin/login flow: a Telegram account and a bot from
  [@BotFather](https://t.me/BotFather)

## Dev workflow

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<you>/happy_birthdays.git
cd happy_birthdays

# 2. Create a feature branch off main
git checkout -b feat/short-description

# 3. Install dependencies (installs both workspaces)
bun install

# 4. Run the dev server (backend + frontend together)
bun run dev

# 5. Make your changes, then typecheck BEFORE opening a PR
bun run typecheck

# 6. Commit and push
git commit -m "Add short description"
git push origin feat/short-description
```

Then open a pull request against `main`. The
[PR template](.github/pull_request_template.md) lists the checklist that must
pass (`bun run typecheck`, `bun run build`, commit convention, no unrelated
changes).

### Useful scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Backend + frontend dev server |
| `bun run build` | Production build of the frontend |
| `bun run start` | Run the backend in production mode |
| `bun run typecheck` | Typecheck every workspace (run before every PR) |

## Repository structure

This is a Bun monorepo with two workspaces.

```
happy_birthdays/
├── backend/                 # Elysia (Bun) API + SSR/OG rendering
│   └── src/
│       ├── controllers/     # Request handlers
│       ├── routes/          # Route definitions wired into app.ts
│       ├── services/        # Translation, OG image, page render, scoring
│       ├── repositories/    # SQLite persistence (scores, birthdays, ...)
│       ├── middlewares/     # Auth, rate limiting
│       ├── models/ schemas/ # Types and request validation
│       ├── utils/           # Telegram auth, client IP, hashing, paths, logging
│       └── config/          # constants.ts (env wiring)
├── frontend/                # React 19 + Vite SPA
│   └── src/
│       ├── page/            # Public friend pages, landing, profile
│       ├── components/      # Reusable UI (shop, switchers, decor)
│       ├── games/           # Mini-games (catcher, maze, memory, puzzle)
│       ├── admin/           # Owner/friend admin app
│       ├── lib/             # API client, i18n, theme, hooks
│       └── styles/          # global.css, theme.css (design tokens)
├── data/                    # Runtime content (friend configs, avatars) — not source
└── scripts/                 # add-friend / add-gift CLIs
```

### Styles & theming

All colours and visual tokens live in `frontend/src/styles/theme.css`. Use the
CSS variables (`var(--color-*)`) instead of hard-coding hex values, so themes
switch cleanly and stay consistent.

### Internationalisation (i18n)

User-facing strings go through the `t()` helper in `frontend/src/lib/i18n.ts`.
Add the key to **both** the `ru` and `en` dictionaries — never hard-code a
visible string in a component.

## How to test Telegram login locally

The admin/login flow uses the Telegram Login Widget, which requires a real bot.

1. In Telegram, talk to [@BotFather](https://t.me/BotFather):
   - `/newbot` — follow the prompts, copy the **bot token** it gives you.
   - `/setdomain` — set the domain to `http://localhost:3000` (the dev server's
     default origin). The widget refuses to render on an unregistered domain.
2. Create `backend/.env` from the example and fill it in:

   ```bash
   cp backend/.env.example backend/.env
   ```

   ```dotenv
   TG_BOT_TOKEN=123456:your-token-from-botfather
   TG_BOT_USERNAME=your_bot_username      # without @
   OWNER_TG_USERNAME=your_telegram_handle # without @ — grants owner rights
   SESSION_SECRET=any-long-random-string  # required, generate one for dev too
   ```

3. `bun run dev`, open the app, and log in. The account whose handle matches
   `OWNER_TG_USERNAME` becomes the owner and can manage every page.

> Note: the backend listens on port `3000` by default; `backend/.env` can
> override `PORT`/`BASE_URL`. If you change the port, register the matching
> domain with `/setdomain`.

## Commit conventions

- Write commit messages in **English**.
- Use the **imperative mood**, short and to the point.
- One logical change per commit.

Good:

```
Add diminishing returns to replay scoring
Fix 422 on game score submission
Expose earned wallet field in score schema
```

Avoid: past tense ("Added ..."), vague messages ("fix stuff", "update"),
bundling unrelated changes into one commit.

## Scope — what's welcome, what to discuss first

Welcome as a direct PR (no prior issue needed):

- Bug fixes with a clear reproduction
- i18n: missing/incorrect `ru`/`en` strings
- Accessibility, performance, and small UX polish
- Documentation fixes

Open an issue **first** to align before you build:

- New games or new public-page sections
- Changes to the auth, scoring, or anti-cheat logic
- New runtime dependencies
- Anything that changes the data format under `data/` or the DB schema

## Core principles

- **No hard-coding.** Colours → `var(--color-*)`. Strings → `t()`. Reuse
  existing components instead of duplicating markup.
- **Surgical changes.** Touch only what the task needs; match the existing
  style of the file you're in.
- **Typecheck before "done".** `bun run typecheck` must pass.

## See also

- [AGENTS.md](AGENTS.md) — guidance for AI assistants contributing to this repo.
- [SECURITY.md](SECURITY.md) — security model and how to report vulnerabilities.
