#!/usr/bin/env bash
# stop.sh — Stop the full Sentra stack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[sentra]${RESET} $*"; }
success() { echo -e "${GREEN}[sentra]${RESET} $*"; }
step()    { echo -e "\n${BOLD}${CYAN}▶  $*${RESET}"; }

# ── 1. Kill Flask (port 5000) ─────────────────────────────────────────────────
step "Stopping Flask backend"
if pids=$(lsof -ti tcp:5000 2>/dev/null); then
  echo "$pids" | xargs kill -TERM 2>/dev/null && success "Flask stopped." || true
else
  info "Flask was not running."
fi

# ── 2. Kill Next.js (port 3000) ───────────────────────────────────────────────
step "Stopping Next.js frontend"
if pids=$(lsof -ti tcp:3000 2>/dev/null); then
  echo "$pids" | xargs kill -TERM 2>/dev/null && success "Next.js stopped." || true
else
  info "Next.js was not running."
fi

# ── 3. Stop Docker services ───────────────────────────────────────────────────
step "Stopping Docker services (Postgres + Redis)"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" stop
success "Docker services stopped."

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Sentra is down. Data is preserved.${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Run ${BOLD}./start.sh${RESET} to bring everything back up."
echo ""
