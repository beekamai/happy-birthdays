#!/usr/bin/env bash
#
# bootstrap.sh — one-line installer for happy_birthdays.
#
# Clones the repo (or updates an existing checkout) and hands off to the
# interactive installer (scripts/install.sh), which detects your OS, installs
# the toolchain, writes backend/.env, builds, and sets up the service.
#
# Usage (fresh server):
#   curl -fsSL https://raw.githubusercontent.com/beekamai/happy-birthdays/main/scripts/bootstrap.sh | bash
#
# Override the source repo or target dir with env vars:
#   HB_REPO=https://github.com/you/your-fork.git HB_DIR=myapp bash bootstrap.sh

set -euo pipefail

REPO="${HB_REPO:-https://github.com/beekamai/happy-birthdays.git}"
DIR="${HB_DIR:-happy-birthdays}"

command -v git >/dev/null 2>&1 || {
  echo "git is required but not found. Install it (e.g. apt install git / brew install git) and re-run." >&2
  exit 1
}

if [ -d "$DIR/.git" ]; then
  echo "==> $DIR already exists — pulling the latest changes"
  git -C "$DIR" pull --ff-only
else
  echo "==> Cloning $REPO into $DIR"
  git clone "$REPO" "$DIR"
fi

cd "$DIR"
# Hand off to the full installer. It is idempotent and interactive.
exec ./scripts/install.sh --init
