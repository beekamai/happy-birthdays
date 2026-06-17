# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through GitHub: go to the repository's
**Security** tab and **open a private security advisory**
("Report a vulnerability"). This keeps the details confidential until a fix is
available.

When reporting, include:

- A description of the issue and its impact
- Steps to reproduce (proof of concept if possible)
- Affected version / commit, and your environment

We'll acknowledge the report, work on a fix, and coordinate disclosure with you.

## Security model — highlights

This is how the application defends itself. Useful context for both reporters
and self-hosters.

- **Authentication.** Admin access uses the Telegram Login Widget, verified
  server-side against the bot token. A session is issued as a JWT stored in an
  **`httpOnly` cookie (`hb_session`)** — `secure` in production, `sameSite=lax`.
  The owner is matched by Telegram username (case-insensitive); a friend can
  edit only their own page.
- **`SESSION_SECRET` is mandatory in production.** The app **refuses to start**
  on the insecure dev default (or a too-short secret), because anyone who knew
  it could forge owner sessions.
- **Rate limiting** is applied to abuse-prone endpoints (game score
  submission, translation).
- **Trusted client IP.** The real client IP for rate limiting is read from a
  proxy header. Behind Cloudflare set `CLIENT_IP_HEADER=cf-connecting-ip` so a
  spoofed `x-forwarded-for` can't bypass the limiter. The origin binds
  `127.0.0.1` by default and is meant to sit behind a reverse proxy.
- **Server-authoritative game scoring.** Scores are computed/validated on the
  server, gated by a **one-time anti-cheat token**, so clients can't post
  arbitrary scores.
- **Secrets stay out of VCS.** `data/` and `*.db` files are git-ignored;
  secrets live only in env files / the pm2 ecosystem config (also ignored).

## Self-hosting requirements

If you deploy your own instance, you **MUST**:

1. Set a strong `SESSION_SECRET` (e.g. `openssl rand -base64 32`). The app will
   not boot in production without one.
2. Run it behind an **HTTPS reverse proxy**. The origin binds loopback; never
   expose it directly. Set `CLIENT_IP_HEADER` to match your proxy.
3. Keep dependencies up to date.
