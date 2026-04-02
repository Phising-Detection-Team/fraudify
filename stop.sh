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

# ── 1.5. Kill Celery workers ──────────────────────────────────────────────────
step "Stopping Celery workers"
_celery_pids=$(ps aux | grep "[c]elery" | awk '{print $2}') || true
if [ -n "$_celery_pids" ]; then
  echo "$_celery_pids" | xargs kill -TERM 2>/dev/null || true
  sleep 1
  echo "$_celery_pids" | xargs kill -9 2>/dev/null || true
  success "Celery workers stopped."
else
  info "Celery workers were not running."
fi

# ── 2. Kill Next.js (port 3000 + any orphaned next-server processes) ──────────
step "Stopping Next.js frontend"
_next_stopped=false
if pids=$(lsof -ti tcp:3000 2>/dev/null); then
  echo "$pids" | xargs kill -TERM 2>/dev/null || true
  _next_stopped=true
fi
# Also kill any orphaned next-server / next dev processes not bound to port 3000
if pkill -TERM -f "next-server|next dev" 2>/dev/null; then
  _next_stopped=true
fi
if [ "$_next_stopped" = true ]; then
  sleep 1
  # Force-kill anything still alive
  pkill -9 -f "next-server|next dev" 2>/dev/null || true
  success "Next.js stopped."
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
