#!/usr/bin/env bash
#
# install.sh — self-hosted installer for happy_birthdays.
#
# Usage:
#   ./scripts/install.sh            first-time install (interactive)
#   ./scripts/install.sh --init     same as above (explicit)
#   ./scripts/install.sh --update   pull latest, rebuild, restart service
#   ./scripts/install.sh --help      show help
#
# The script is idempotent: re-running --init skips steps that are already
# done and never clobbers an existing backend/.env without confirmation.

set -euo pipefail

# --------------------------------------------------------------------------
# Paths & constants
# --------------------------------------------------------------------------

# Resolve the repo root from this script's location (scripts/ lives in root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$ROOT_DIR/backend/.env"
ENV_EXAMPLE="$ROOT_DIR/backend/.env.example"
ECOSYSTEM_FILE="$ROOT_DIR/ecosystem.config.cjs"
BUILD_ARTIFACT="$ROOT_DIR/backend/dist/index.html"

SERVICE_NAME="happy-birthdays"
PM2_APP_NAME="happy-birthdays"

# Defaults offered in the interactive prompts.
DEFAULT_PORT="3000"
DEFAULT_HOST="127.0.0.1"

# --------------------------------------------------------------------------
# Pretty output
# --------------------------------------------------------------------------

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET="$(printf '\033[0m')"
  C_BOLD="$(printf '\033[1m')"
  C_RED="$(printf '\033[31m')"
  C_GREEN="$(printf '\033[32m')"
  C_YELLOW="$(printf '\033[33m')"
  C_BLUE="$(printf '\033[34m')"
  C_CYAN="$(printf '\033[36m')"
else
  C_RESET="" C_BOLD="" C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_CYAN=""
fi

step()  { printf '\n%s==>%s %s%s%s\n' "$C_BLUE$C_BOLD" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
info()  { printf '    %s\n' "$*"; }
ok()    { printf '%s  ok%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%swarn%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%serr %s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# yes/no prompt. $1 = question, $2 = default (y|n). Returns 0 for yes.
confirm() {
  local q="$1" def="${2:-y}" ans hint
  case "$def" in y) hint="[Y/n]" ;; *) hint="[y/N]" ;; esac
  # Non-interactive shells fall back to the default to keep CI sane.
  if [ ! -t 0 ]; then
    [ "$def" = "y" ]; return
  fi
  printf '%s %s ' "$q" "$hint" >&2
  read -r ans || true
  ans="${ans:-$def}"
  case "$ans" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# prompt VAR "label" "default". Reads into the named variable.
prompt() {
  local __var="$1" label="$2" def="${3:-}" input
  if [ ! -t 0 ]; then
    printf -v "$__var" '%s' "$def"
    return
  fi
  if [ -n "$def" ]; then
    printf '%s%s%s [%s]: ' "$C_CYAN" "$label" "$C_RESET" "$def" >&2
  else
    printf '%s%s%s: ' "$C_CYAN" "$label" "$C_RESET" >&2
  fi
  read -r input || true
  printf -v "$__var" '%s' "${input:-$def}"
}

have() { command -v "$1" >/dev/null 2>&1; }

# --------------------------------------------------------------------------
# Phase 1 — environment detection
# --------------------------------------------------------------------------

OS_KIND=""   # linux | macos
IS_WSL=0

detect_os() {
  step "Detecting operating system"
  local uname_s
  uname_s="$(uname -s 2>/dev/null || echo unknown)"
  case "$uname_s" in
    Linux*)
      OS_KIND="linux"
      if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
        IS_WSL=1
        info "Linux (WSL2) detected."
      else
        info "Linux detected."
      fi
      ;;
    Darwin*)
      OS_KIND="macos"
      info "macOS detected."
      ;;
    MINGW*|MSYS*|CYGWIN*)
      die "Native Windows shell detected. Run this inside WSL2, a Linux host, or macOS."
      ;;
    *)
      die "Unsupported OS: $uname_s. Need Linux, WSL2 or macOS."
      ;;
  esac
  ok "OS: $OS_KIND${IS_WSL:+ (WSL)}"
}

# --------------------------------------------------------------------------
# Phase 2 — toolchain (bun, git, openssl)
# --------------------------------------------------------------------------

ensure_toolchain() {
  step "Checking toolchain"

  if ! have git; then
    die "git is required but not found. Install it (e.g. apt install git / brew install git) and re-run."
  fi
  ok "git: $(git --version | awk '{print $3}')"

  if ! have bun; then
    info "Bun not found. Installing via https://bun.sh/install ..."
    curl -fsSL https://bun.sh/install | bash
    # bun installs to ~/.bun/bin; make it visible for the rest of this run.
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
    have bun || die "Bun install finished but 'bun' is still not on PATH. Open a new shell and re-run."
    ok "Bun installed: $(bun --version)"
    warn "Add Bun to your PATH permanently (the installer usually appends to ~/.bashrc): export PATH=\"\$HOME/.bun/bin:\$PATH\""
  else
    ok "bun: $(bun --version)"
  fi

  if ! have openssl; then
    warn "openssl not found — SESSION_SECRET auto-generation will fall back to Bun's crypto."
  fi
}

# Generate a 32-byte base64 secret. Prefer openssl, fall back to bun.
gen_secret() {
  if have openssl; then
    openssl rand -base64 32
  else
    bun -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'
  fi
}

# --------------------------------------------------------------------------
# Phase 3 — environment file
# --------------------------------------------------------------------------

configure_env() {
  step "Configuring backend/.env"

  if [ -f "$ENV_FILE" ]; then
    warn "$ENV_FILE already exists."
    if ! confirm "Overwrite it? Existing values will be lost." "n"; then
      info "Keeping existing .env. Skipping env configuration."
      return 0
    fi
    cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
    info "Backed up current .env."
  fi

  [ -f "$ENV_EXAMPLE" ] || die "Missing $ENV_EXAMPLE — are you running from the repo?"

  local owner token bot_user base_url port session gemini
  prompt owner    "Owner Telegram @username (without @)" ""
  prompt token    "Telegram bot token (from @BotFather)" ""
  prompt bot_user "Telegram bot username (without @)"    ""
  prompt base_url "Public BASE_URL (https://your.domain)" ""
  prompt port     "HTTP port (app binds $DEFAULT_HOST)"   "$DEFAULT_PORT"

  # SESSION_SECRET: offer auto-generation; manual entry only if declined.
  if confirm "Auto-generate SESSION_SECRET?" "y"; then
    session="$(gen_secret)"
    info "Generated a fresh SESSION_SECRET."
  else
    prompt session "SESSION_SECRET (long random string)" ""
    [ -n "$session" ] || die "SESSION_SECRET cannot be empty — the app refuses to start on the default."
  fi

  prompt gemini "GEMINI_API_KEY (optional, blank to skip)" ""

  # Warn on the obviously-broken cases without blocking — the operator may be
  # filling these in later, but they need to know the app won't run yet.
  [ -n "$owner" ]   || warn "OWNER_TG_USERNAME left empty — no one will get owner rights."
  [ -n "$token" ]   || warn "TG_BOT_TOKEN left empty — Telegram login will not work."
  [ -n "$base_url" ]|| warn "BASE_URL left empty — set it to your public https URL before going live."

  umask 077
  cat > "$ENV_FILE" <<EOF
PORT=$port
HOST=$DEFAULT_HOST
BASE_URL=$base_url
NODE_ENV=production

# Telegram Login (admin). Create a bot in @BotFather, then:
#   /newbot      -> get the token below
#   /setdomain   -> set your domain for that bot
TG_BOT_TOKEN=$token
TG_BOT_USERNAME=$bot_user
# Your Telegram @username (without @) — gets owner rights over all pages.
OWNER_TG_USERNAME=$owner
# Long random string for signing session JWTs. REQUIRED in production — the app
# refuses to start with the insecure default. Generate: openssl rand -base64 32
SESSION_SECRET=$session

# Which proxy header carries the real client IP (rate limiting + abuse tagging).
# Empty = auto-detect (cf-connecting-ip -> x-real-ip -> x-forwarded-for).
# Behind Cloudflare set this to cf-connecting-ip.
CLIENT_IP_HEADER=

# Google Generative AI (Gemini) — auto-translates page content between ru/en.
# Optional: get a free key at https://ai.google.dev. Empty disables it gracefully.
GEMINI_API_KEY=$gemini
GEMINI_MODEL=gemini-flash-latest
EOF
  chmod 600 "$ENV_FILE"
  ok "Wrote $ENV_FILE (chmod 600)."

  # Export PORT for later validation / nginx templating in this run.
  APP_PORT="$port"
}

# Read PORT from an existing .env (used on --update and when env is kept).
load_port_from_env() {
  if [ -f "$ENV_FILE" ]; then
    APP_PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  fi
  APP_PORT="${APP_PORT:-$DEFAULT_PORT}"
}

# --------------------------------------------------------------------------
# Phase 4 — install deps & build
# --------------------------------------------------------------------------

build_app() {
  step "Installing dependencies and building"

  ( cd "$ROOT_DIR" && bun install ) || die "bun install failed."
  ok "Dependencies installed."

  if confirm "Run typecheck (bun run typecheck)?" "n"; then
    if ( cd "$ROOT_DIR" && bun run typecheck ); then
      ok "Typecheck passed."
    else
      warn "Typecheck reported errors — continuing, but review them."
    fi
  fi

  # Build is mandatory: backend serves frontend assets from backend/dist.
  ( cd "$ROOT_DIR" && bun run build ) || die "bun run build failed."
  [ -f "$BUILD_ARTIFACT" ] || die "Build finished but $BUILD_ARTIFACT is missing — frontend build did not emit to backend/dist."
  ok "Frontend built into backend/dist."
}

# --------------------------------------------------------------------------
# Phase 5 — service (systemd preferred, pm2 fallback)
# --------------------------------------------------------------------------

SERVICE_MODE=""   # systemd | pm2

setup_service() {
  step "Setting up the service"

  local can_systemd=0
  if [ "$OS_KIND" = "linux" ] && [ "$IS_WSL" = "0" ] && have systemctl && [ -d /run/systemd/system ]; then
    can_systemd=1
  fi

  if [ "$can_systemd" = "1" ]; then
    if confirm "Use systemd (recommended on this host)?" "y"; then
      SERVICE_MODE="systemd"
    else
      SERVICE_MODE="pm2"
    fi
  else
    if [ "$OS_KIND" = "macos" ]; then
      info "macOS: systemd unavailable, using pm2."
    elif [ "$IS_WSL" = "1" ]; then
      info "WSL: systemd is often disabled, using pm2."
    else
      info "systemd not detected, using pm2."
    fi
    SERVICE_MODE="pm2"
  fi

  case "$SERVICE_MODE" in
    systemd) setup_systemd ;;
    pm2)     setup_pm2 ;;
  esac
}

setup_systemd() {
  local bun_path unit_path user
  bun_path="$(command -v bun)"
  user="$(id -un)"
  unit_path="/etc/systemd/system/${SERVICE_NAME}.service"

  info "Generating systemd unit (needs sudo to install it)."
  local tmp_unit
  tmp_unit="$(mktemp)"
  cat > "$tmp_unit" <<EOF
[Unit]
Description=happy_birthdays
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$ROOT_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$bun_path run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo install -m 0644 "$tmp_unit" "$unit_path"
  rm -f "$tmp_unit"
  ok "Installed $unit_path"

  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  sudo systemctl restart "$SERVICE_NAME"
  ok "systemd service '$SERVICE_NAME' enabled and started."
  info "Logs: sudo journalctl -u $SERVICE_NAME -f"
}

setup_pm2() {
  if ! have pm2; then
    if confirm "pm2 not found. Install it globally with bun?" "y"; then
      bun install -g pm2 || die "Failed to install pm2."
      export PATH="$HOME/.bun/bin:$PATH"
      have pm2 || die "pm2 installed but not on PATH. Open a new shell and re-run --init."
    else
      die "pm2 is required for this mode."
    fi
  fi
  ok "pm2: $(pm2 --version)"

  # Write ecosystem only if missing or on explicit overwrite — keep operator edits.
  if [ -f "$ECOSYSTEM_FILE" ]; then
    info "$ECOSYSTEM_FILE already exists, leaving it as is."
  else
    write_ecosystem
    ok "Wrote $ECOSYSTEM_FILE"
  fi

  # interpreter:"none" + script:"bun" run start from cwd:./backend is the only
  # combo that works — bun --interpreter on src/index.ts crashes the async module.
  ( cd "$ROOT_DIR" && pm2 startOrReload "$ECOSYSTEM_FILE" ) || die "pm2 start failed."
  pm2 save
  ok "pm2 app '$PM2_APP_NAME' started and saved."

  if confirm "Configure pm2 to start on boot (runs 'pm2 startup', may need sudo)?" "y"; then
    pm2 startup || warn "pm2 startup printed a command above — run it manually if it asked for sudo."
  fi
}

write_ecosystem() {
  cat > "$ECOSYSTEM_FILE" <<EOF
// pm2 ecosystem for happy_birthdays.
// IMPORTANT: interpreter must be "none" and the script must be plain "bun"
// running "run start" from ./backend. Using "--interpreter bun" directly on
// src/index.ts crashes because the entry is an async module.
module.exports = {
  apps: [
    {
      name: "$PM2_APP_NAME",
      script: "bun",
      args: "run start",
      interpreter: "none",
      cwd: "./backend",
      env: { NODE_ENV: "production" },
    },
  ],
};
EOF
}

# --------------------------------------------------------------------------
# Phase 6 — optional nginx reverse proxy
# --------------------------------------------------------------------------

setup_nginx() {
  step "Reverse proxy (nginx)"

  if [ "$OS_KIND" != "linux" ]; then
    info "Skipping nginx automation on $OS_KIND. Configure your proxy to point at $DEFAULT_HOST:$APP_PORT manually."
    return 0
  fi
  if ! have nginx; then
    info "nginx not installed — skipping. The app binds $DEFAULT_HOST:$APP_PORT and needs a reverse proxy in front of it."
    return 0
  fi
  if ! confirm "Generate an nginx site config now?" "y"; then
    info "Skipped nginx config."
    return 0
  fi

  local server_name
  prompt server_name "Server name (your domain, e.g. hb.example.com)" "_"

  local conf_path="/etc/nginx/sites-available/${SERVICE_NAME}"
  local link_path="/etc/nginx/sites-enabled/${SERVICE_NAME}"
  local tmp_conf
  tmp_conf="$(mktemp)"
  cat > "$tmp_conf" <<EOF
server {
    listen 80;
    server_name $server_name;

    # Uploads (avatars / gifts) — allow large bodies.
    client_max_body_size 50M;

    location / {
        proxy_pass http://$DEFAULT_HOST:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  if [ -d /etc/nginx/sites-available ]; then
    sudo install -m 0644 "$tmp_conf" "$conf_path"
    [ -e "$link_path" ] || sudo ln -s "$conf_path" "$link_path"
    rm -f "$tmp_conf"
    ok "Wrote $conf_path and enabled it."
  else
    warn "/etc/nginx/sites-available not found (non-Debian layout)."
    info "Generated config printed below — place it under your nginx conf.d and reload manually:"
    printf '%s\n' "----8<----"
    cat "$tmp_conf"
    printf '%s\n' "---->8----"
    rm -f "$tmp_conf"
    return 0
  fi

  if sudo nginx -t; then
    sudo systemctl reload nginx || sudo nginx -s reload || true
    ok "nginx reloaded."
    info "TLS: enable HTTPS with certbot, e.g. sudo certbot --nginx -d $server_name"
  else
    warn "nginx -t failed — fix the config before reloading."
  fi
}

# --------------------------------------------------------------------------
# Phase 7 — health check & next steps
# --------------------------------------------------------------------------

validate() {
  step "Validating the running app"

  local url="http://$DEFAULT_HOST:$APP_PORT/"
  local i=0 code=""
  # Give the service a few seconds to bind the port.
  while [ "$i" -lt 10 ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)"
    [ "$code" != "000" ] && break
    i=$((i + 1))
    sleep 1
  done

  if [ "$code" = "000" ]; then
    warn "No response from $url. Check service logs:"
    if [ "$SERVICE_MODE" = "systemd" ]; then
      info "  sudo journalctl -u $SERVICE_NAME -e"
    else
      info "  pm2 logs $PM2_APP_NAME"
    fi
  else
    ok "App responded on $url (HTTP $code)."
  fi
}

next_steps() {
  step "Next steps"
  cat <<EOF
  1. In @BotFather run /setdomain for your bot and point it at your public domain
     (must match BASE_URL), otherwise Telegram login will fail.
  2. Open your site, go to /account and sign in with the Telegram account whose
     @username you set as OWNER_TG_USERNAME — that account owns every page.
  3. Create your first page right in the browser: the owner dashboard has a
     "create" button with the full form (name, date, avatar, message, gifts).
     Prefer the terminal? "cd $ROOT_DIR && bun run add-friend" works too.

  Service management:
EOF
  if [ "$SERVICE_MODE" = "systemd" ]; then
    cat <<EOF
     status : sudo systemctl status $SERVICE_NAME
     restart: sudo systemctl restart $SERVICE_NAME
     logs   : sudo journalctl -u $SERVICE_NAME -f
EOF
  else
    cat <<EOF
     status : pm2 status
     restart: pm2 restart $PM2_APP_NAME
     logs   : pm2 logs $PM2_APP_NAME
EOF
  fi
  printf '\n%sInstallation complete.%s\n' "$C_GREEN$C_BOLD" "$C_RESET"
}

# --------------------------------------------------------------------------
# --update flow
# --------------------------------------------------------------------------

detect_service_mode() {
  # Figure out how the app is currently managed so --update restarts it right.
  if have systemctl && systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
    SERVICE_MODE="systemd"
  elif have pm2 && pm2 jlist 2>/dev/null | grep -q "\"name\":\"$PM2_APP_NAME\""; then
    SERVICE_MODE="pm2"
  else
    SERVICE_MODE=""
  fi
}

restart_service() {
  case "$SERVICE_MODE" in
    systemd)
      sudo systemctl restart "$SERVICE_NAME"
      ok "Restarted systemd service '$SERVICE_NAME'."
      ;;
    pm2)
      ( cd "$ROOT_DIR" && pm2 startOrReload "$ECOSYSTEM_FILE" 2>/dev/null ) \
        || pm2 restart "$PM2_APP_NAME"
      pm2 save >/dev/null 2>&1 || true
      ok "Restarted pm2 app '$PM2_APP_NAME'."
      ;;
    *)
      warn "Could not detect a managed service. Start it manually: cd \"$ROOT_DIR\" && bun run start"
      ;;
  esac
}

run_update() {
  detect_os
  ensure_toolchain
  load_port_from_env
  detect_service_mode

  step "Pulling latest changes"
  ( cd "$ROOT_DIR" && git pull --ff-only ) || die "git pull failed (uncommitted changes or non-fast-forward?)."
  ok "Repo updated."

  build_app

  step "Restarting the service"
  restart_service

  validate
  printf '\n%sUpdate complete.%s\n' "$C_GREEN$C_BOLD" "$C_RESET"
}

# --------------------------------------------------------------------------
# --init flow
# --------------------------------------------------------------------------

run_init() {
  detect_os
  ensure_toolchain
  configure_env
  # If env was kept (not overwritten), APP_PORT may be unset — read it back.
  : "${APP_PORT:=}"
  [ -n "$APP_PORT" ] || load_port_from_env
  build_app
  setup_service
  setup_nginx
  validate
  next_steps
}

# --------------------------------------------------------------------------
# Help & dispatch
# --------------------------------------------------------------------------

usage() {
  cat <<EOF
${C_BOLD}happy_birthdays installer${C_RESET}

Usage:
  ./scripts/install.sh            First-time install (interactive).
  ./scripts/install.sh --init     Same as above (explicit).
  ./scripts/install.sh --update   Pull latest, rebuild, restart the service.
  ./scripts/install.sh --help     Show this help.

Phases (--init): OS detect -> toolchain (bun/git) -> backend/.env ->
bun install + build -> service (systemd/pm2) -> optional nginx -> health check.
EOF
}

main() {
  local cmd="${1:---init}"
  case "$cmd" in
    --init|init|"") run_init ;;
    --update|update) run_update ;;
    -h|--help|help) usage ;;
    *) usage; die "Unknown argument: $cmd" ;;
  esac
}

main "$@"
