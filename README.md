# Happy Birthdays

[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=fff)](https://bun.sh)
[![ElysiaJS](https://img.shields.io/badge/ElysiaJS-1.4-0f172a?logo=elysia&logoColor=fff)](https://elysiajs.com)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=fff)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)

A cozy, self-hostable birthday-greeting site. Build a personal page for every
friend, drop in a Lottie gift and a few mini-games, and let them play.

🇬🇧 [English](#english) · 🇷🇺 [Русский](#русский)

---

## English

### What is this

Happy Birthdays is a small self-hosted web app for making warm, personal
birthday pages. As the owner you create a page per friend at `/:slug` with an
avatar, their birth date, a private message, and a gift (a Lottie animation).
Each page also ships a handful of mini-games.

Guests play the games and earn points; you spend those points in an in-app shop
on decorations for the page. When a page is shared on Telegram, it renders a
dynamic, per-friend Open Graph image so the preview feels personal.

### Features

- 🎂 **Per-friend pages** at `/:slug` — avatar, birth date, private message, gift.
- 🎁 **Lottie gifts** — animated presents rendered with `lottie-react`.
- 🎮 **5 mini-games** — `feed-fox`, `catch-stars`, `slide-puzzle`, `memory`, `maze`, with server-side scoring and an anti-cheat token.
- 🛍️ **Points economy** — guests earn points, the owner spends them in a shop on page decorations.
- 🖼️ **Dynamic OG images** — per-friend social previews generated on the fly via `satori` + `resvg`.
- 🎨 **Cozy Ramen design** — 4 themes (`light` / `dark` / `halloween` / `newyear`) via `[data-theme]` tokens.
- 🌍 **Bilingual ru/en** — UI in two languages, with optional AI auto-translation of content.
- 🔐 **Telegram login** — admin panel gated by the Telegram Login Widget.

### Tech stack

| Layer       | Stack                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Runtime     | [Bun](https://bun.sh) monorepo (root + `backend/` + `frontend/`)                   |
| Backend     | [ElysiaJS](https://elysiajs.com) 1.4, `bun:sqlite`, `satori` + `resvg` for OG       |
| Databases   | 4 SQLite files: `scores`, `birthdays`, `history`, `shop`                           |
| Frontend    | [React 19](https://react.dev) + [Vite](https://vite.dev) + [Tailwind v4](https://tailwindcss.com) |
| Animation   | `lottie-react`                                                                     |
| i18n        | ru / en (`frontend/src/lib/i18n.ts`)                                               |

### Quick start

Requires [Bun](https://bun.sh) (see `package.json` for the version) and a POSIX
host. On Windows, develop inside WSL2.

```bash
git clone <your-fork-url> happy-birthdays
cd happy-birthdays
bun install
cp backend/.env.example backend/.env   # then edit it (see Configuration)
bun run dev                            # backend :3000 + frontend Vite :5173
```

Open the Vite dev server and create your first friend with `bun run add-friend`.

### Scripts

Run all of these from the repo root.

| Command              | What it does                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `bun run dev`        | Backend (`:3000`) + frontend Vite (`:5173`) in parallel              |
| `bun run build`      | Builds the frontend into `backend/dist`                              |
| `bun run start`      | Production: a single Elysia process serving API + built frontend     |
| `bun run typecheck`  | Type-checks both packages                                            |
| `bun run add-friend` | Interactive: scaffold a new friend page                             |
| `bun run add-gift`   | Interactive: add a Lottie gift                                       |

### Configuration

All settings come from environment variables. Copy `backend/.env.example` to
`backend/.env` and fill it in.

| Variable            | Default              | Notes                                                                                              |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `PORT`              | `3000`               | HTTP port.                                                                                         |
| `HOST`              | `127.0.0.1`          | Binds to loopback by default — keep the origin private behind a reverse proxy.                     |
| `BASE_URL`          | —                    | Public URL of your deployment (used in OG images and links).                                       |
| `NODE_ENV`          | —                    | Set to `production` for `bun run start`.                                                            |
| `TG_BOT_TOKEN`      | —                    | Telegram bot token (admin login).                                                                  |
| `TG_BOT_USERNAME`   | —                    | Your bot's username.                                                                               |
| `OWNER_TG_USERNAME` | —                    | Your Telegram `@username` **without** the `@`. This account owns every page.                       |
| `SESSION_SECRET`    | —                    | **Required in production** — the app refuses to boot on the dev default. `openssl rand -base64 32` |
| `GEMINI_API_KEY`    | _(empty = off)_      | Optional. Enables AI auto-translation of content (ru ↔ en) via Google AI Studio.                   |
| `GEMINI_MODEL`      | `gemini-flash-latest`| Model alias; rarely needs changing.                                                                |
| `CLIENT_IP_HEADER`  | _(auto-detect)_      | Optional. Behind Cloudflare set to `cf-connecting-ip` so a spoofed `x-forwarded-for` can't dodge the rate limiter. |

### Telegram setup

The admin panel is gated by the Telegram Login Widget.

1. In [@BotFather](https://t.me/BotFather), run `/newbot` and copy the token into `TG_BOT_TOKEN`.
2. Run `/setdomain` and point the bot at your domain.
3. Put your bot's username in `TG_BOT_USERNAME` and your own `@username` (no `@`) in `OWNER_TG_USERNAME`.
4. Visit `/account` on your site and log in via Telegram.

### Friends & data

`data/friends/<slug>/config.json` is the **source of truth** for each page —
avatars live alongside it. This directory is gitignored and never committed; the
SQLite databases are derived and resync from it on boot.

- Add a friend: `bun run add-friend`
- Add a gift: `bun run add-gift` (or via the admin panel after Telegram login)

### Deployment

Deploy with [pm2](https://pm2.keymetrics.io) + Bun on Linux.

> **Build before start.** `bun run build` must run before `bun run start` —
> the backend caches `dist/index.html` at boot.

> **pm2 gotcha.** Do **not** use `pm2 start src/index.ts --interpreter bun` —
> the app is an async module and will crash. Instead, in `ecosystem.config.cjs`
> run Bun as the script:
>
> ```js
> {
>   script: "bun",
>   args: "run start",
>   interpreter: "none",
>   cwd: "/path/to/happy-birthdays/backend",
> }
> ```

Put the app behind a reverse proxy (nginx, CloudPanel, …) terminating TLS; the
origin stays bound to `127.0.0.1`. An automated installer is available at
`scripts/install.sh`.

### Project structure

<details>
<summary>Repository tree</summary>

```
happy-birthdays/
├── package.json                  # Bun workspace root + scripts
├── dev.ts                        # parallel dev runner (backend + frontend)
├── ecosystem.config.cjs.example  # pm2 deployment template
├── scripts/                      # add-friend, add-gift, install.sh
├── data/                         # friends/<slug>/config.json (gitignored source of truth)
├── backend/
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── services/             # satori OG, translation, scoring, …
│       ├── repositories/         # SQLite access
│       ├── middlewares/          # auth, rate limit
│       ├── schemas/
│       ├── models/
│       ├── handlers/
│       ├── config/               # constants.ts (env)
│       └── utils/
└── frontend/
    └── src/
        ├── page/                 # public friend page
        ├── admin/                # owner/admin panel
        ├── games/                # 5 mini-games + registry.ts
        ├── components/
        ├── pet/
        ├── lib/                  # api, i18n, hooks
        └── styles/               # theme.css (4 themes), global.css
```

</details>

### Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [AGENTS.md](AGENTS.md) — guidelines for AI coding agents
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities
- [LICENSE](LICENSE) — MIT

---

## Русский

### Что это

Happy Birthdays — небольшое self-hosted веб-приложение для тёплых персональных
поздравительных страниц. Как владелец вы создаёте страницу для каждого друга по
адресу `/:slug`: аватар, дата рождения, личное сообщение и подарок
(Lottie-анимация). На каждой странице есть несколько мини-игр.

Гости играют в игры и зарабатывают очки; вы тратите эти очки во встроенном
магазине на украшения страницы. При шере страницы в Telegram генерируется
динамическая персональная Open Graph картинка, чтобы превью выглядело личным.

### Возможности

- 🎂 **Страницы для друзей** по `/:slug` — аватар, дата рождения, личное сообщение, подарок.
- 🎁 **Lottie-подарки** — анимированные подарки через `lottie-react`.
- 🎮 **5 мини-игр** — `feed-fox`, `catch-stars`, `slide-puzzle`, `memory`, `maze`, с серверным счётом и anti-cheat токеном.
- 🛍️ **Экономика очков** — гости зарабатывают, владелец тратит их в магазине на украшения страницы.
- 🖼️ **Динамические OG-картинки** — персональные превью для соцсетей на лету через `satori` + `resvg`.
- 🎨 **Дизайн «Cozy Ramen»** — 4 темы (`light` / `dark` / `halloween` / `newyear`) через токены `[data-theme]`.
- 🌍 **Двуязычность ru/en** — интерфейс на двух языках, опционально AI-автоперевод контента.
- 🔐 **Вход через Telegram** — админка под Telegram Login Widget.

### Стек

| Слой        | Технологии                                                                          |
| ----------- | ----------------------------------------------------------------------------------- |
| Рантайм     | [Bun](https://bun.sh) монорепо (корень + `backend/` + `frontend/`)                  |
| Бэкенд      | [ElysiaJS](https://elysiajs.com) 1.4, `bun:sqlite`, `satori` + `resvg` для OG        |
| Базы данных | 4 файла SQLite: `scores`, `birthdays`, `history`, `shop`                            |
| Фронтенд    | [React 19](https://react.dev) + [Vite](https://vite.dev) + [Tailwind v4](https://tailwindcss.com) |
| Анимация    | `lottie-react`                                                                      |
| i18n        | ru / en (`frontend/src/lib/i18n.ts`)                                                |

### Быстрый старт

Нужны [Bun](https://bun.sh) (версия — в `package.json`) и POSIX-хост. На Windows
разрабатывайте внутри WSL2.

```bash
git clone <url-вашего-форка> happy-birthdays
cd happy-birthdays
bun install
cp backend/.env.example backend/.env   # затем отредактируйте (см. Конфигурация)
bun run dev                            # бэкенд :3000 + фронтенд Vite :5173
```

Откройте dev-сервер Vite и создайте первого друга через `bun run add-friend`.

### Команды

Все команды запускаются из корня репозитория.

| Команда              | Что делает                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| `bun run dev`        | Бэкенд (`:3000`) + фронтенд Vite (`:5173`) параллельно                   |
| `bun run build`      | Собирает фронтенд в `backend/dist`                                       |
| `bun run start`      | Прод: один процесс Elysia, отдающий API + собранный фронтенд             |
| `bun run typecheck`  | Тайпчек обоих пакетов                                                    |
| `bun run add-friend` | Интерактивно: создать страницу нового друга                             |
| `bun run add-gift`   | Интерактивно: добавить Lottie-подарок                                    |

### Конфигурация

Все настройки — через переменные окружения. Скопируйте `backend/.env.example` в
`backend/.env` и заполните.

| Переменная          | По умолчанию          | Примечание                                                                                          |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`              | `3000`                | HTTP-порт.                                                                                           |
| `HOST`              | `127.0.0.1`           | По умолчанию слушает loopback — держите origin приватным за reverse-proxy.                           |
| `BASE_URL`          | —                     | Публичный URL развёртывания (используется в OG-картинках и ссылках).                                 |
| `NODE_ENV`          | —                     | Для `bun run start` поставьте `production`.                                                          |
| `TG_BOT_TOKEN`      | —                     | Токен Telegram-бота (вход в админку).                                                                |
| `TG_BOT_USERNAME`   | —                     | Username вашего бота.                                                                                |
| `OWNER_TG_USERNAME` | —                     | Ваш Telegram `@username` **без** `@`. Этот аккаунт — владелец всех страниц.                          |
| `SESSION_SECRET`    | —                     | **Обязателен в проде** — приложение не стартует с дефолтом. `openssl rand -base64 32`                |
| `GEMINI_API_KEY`    | _(пусто = выключено)_ | Опционально. Включает AI-автоперевод контента (ru ↔ en) через Google AI Studio.                      |
| `GEMINI_MODEL`      | `gemini-flash-latest` | Алиас модели; менять обычно не нужно.                                                                |
| `CLIENT_IP_HEADER`  | _(автоопределение)_   | Опционально. За Cloudflare поставьте `cf-connecting-ip`, чтобы поддельный `x-forwarded-for` не обходил rate limiter. |

### Настройка Telegram

Админка защищена Telegram Login Widget.

1. В [@BotFather](https://t.me/BotFather) выполните `/newbot` и впишите токен в `TG_BOT_TOKEN`.
2. Выполните `/setdomain` и укажите свой домен.
3. Впишите username бота в `TG_BOT_USERNAME`, а свой `@username` (без `@`) — в `OWNER_TG_USERNAME`.
4. Зайдите на `/account` своего сайта и войдите через Telegram.

### Друзья и данные

`data/friends/<slug>/config.json` — **источник правды** для каждой страницы,
аватары лежат рядом. Эта директория в `.gitignore` и не коммитится; базы SQLite
производные и синхронизируются из неё при старте.

- Добавить друга: `bun run add-friend`
- Добавить подарок: `bun run add-gift` (или через админку после входа в Telegram)

### Деплой

Разворачивайте через [pm2](https://pm2.keymetrics.io) + Bun на Linux.

> **Сборка до старта.** `bun run build` обязан выполниться до `bun run start` —
> бэкенд кэширует `dist/index.html` при старте.

> **Подвох pm2.** **Не** используйте `pm2 start src/index.ts --interpreter bun` —
> приложение является async-модулем и упадёт. Вместо этого в
> `ecosystem.config.cjs` запускайте Bun как скрипт:
>
> ```js
> {
>   script: "bun",
>   args: "run start",
>   interpreter: "none",
>   cwd: "/path/to/happy-birthdays/backend",
> }
> ```

Поставьте приложение за reverse-proxy (nginx, CloudPanel, …) с TLS; origin
остаётся привязан к `127.0.0.1`. Есть автоустановщик — `scripts/install.sh`.

### Структура проекта

<details>
<summary>Дерево репозитория</summary>

```
happy-birthdays/
├── package.json                  # корень Bun-воркспейса + скрипты
├── dev.ts                        # параллельный dev-раннер (бэкенд + фронтенд)
├── ecosystem.config.cjs.example  # шаблон деплоя для pm2
├── scripts/                      # add-friend, add-gift, install.sh
├── data/                         # friends/<slug>/config.json (gitignored источник правды)
├── backend/
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── services/             # satori OG, перевод, счёт, …
│       ├── repositories/         # доступ к SQLite
│       ├── middlewares/          # auth, rate limit
│       ├── schemas/
│       ├── models/
│       ├── handlers/
│       ├── config/               # constants.ts (env)
│       └── utils/
└── frontend/
    └── src/
        ├── page/                 # публичная страница друга
        ├── admin/                # панель владельца/админа
        ├── games/                # 5 мини-игр + registry.ts
        ├── components/
        ├── pet/
        ├── lib/                  # api, i18n, хуки
        └── styles/               # theme.css (4 темы), global.css
```

</details>

### Документация

- [CONTRIBUTING.md](CONTRIBUTING.md) — как контрибьютить
- [AGENTS.md](AGENTS.md) — гайдлайны для AI-агентов
- [SECURITY.md](SECURITY.md) — сообщить об уязвимости
- [LICENSE](LICENSE) — MIT
