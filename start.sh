#!/usr/bin/env bash
# start.sh — Start the full Sentra stack
# Usage: ./start.sh [--no-seed] [--reset-db]
#
#   --no-seed   Skip database seeding (use when DB already has data)
#   --reset-db  Drop and recreate the public schema before migrating (fresh start)

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
LOG_DIR="$SCRIPT_DIR/.logs"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[sentra]${RESET} $*"; }
success() { echo -e "${GREEN}[sentra]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[sentra]${RESET} $*"; }
error()   { echo -e "${RED}[sentra]${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶  $*${RESET}"; }

# ── Options ──────────────────────────────────────────────────────────────────
SEED=true
RESET_DB=false
for arg in "$@"; do
  case $arg in
    --no-seed)  SEED=false ;;
    --reset-db) RESET_DB=true ;;
    *) error "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── PID tracking for clean shutdown ──────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  step "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && info "Stopped PID $pid" || true
  done
  info "Stopping Docker services..."
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" stop 2>/dev/null || true
  success "All services stopped."
}
trap cleanup INT TERM EXIT

# ── Preflight checks ─────────────────────────────────────────────────────────
step "Preflight checks"

if ! command -v docker &>/dev/null; then
  error "docker not found. Install Docker Desktop or Docker Engine first."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker and retry."
  exit 1
fi

if [ ! -f "$VENV/python" ]; then
  error "Python venv not found at $SCRIPT_DIR/.venv"
  error "Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if ! command -v node &>/dev/null; then
  error "node not found. Install Node.js 18+."
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  warn "node_modules missing — running npm install..."
  (cd "$FRONTEND_DIR" && npm install --silent)
fi

success "All preflight checks passed."

# ── Log directory ─────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── 1. Docker services (Postgres + Redis) ────────────────────────────────────
step "Starting Docker services (Postgres + Redis)"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

info "Waiting for Postgres to be healthy..."
for i in $(seq 1 30); do
  if docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T postgres \
      pg_isready -U "${POSTGRES_USER:-phishing_user}" -d "${POSTGRES_DB:-phishing_db}" &>/dev/null; then
    success "Postgres is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Postgres did not become healthy after 30 seconds."
    exit 1
  fi
  sleep 1
done

info "Waiting for Redis to be healthy..."
for i in $(seq 1 20); do
  if docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T redis redis-cli ping &>/dev/null; then
    success "Redis is ready."
    break
  fi
  if [ "$i" -eq 20 ]; then
    error "Redis did not become healthy after 20 seconds."
    exit 1
  fi
  sleep 1
done

# ── 2. Database migrations ────────────────────────────────────────────────────
step "Running database migrations"

if [ "$RESET_DB" = true ]; then
  warn "--reset-db: Dropping and recreating the public schema..."
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T postgres \
    psql -U "${POSTGRES_USER:-phishing_user}" -d "${POSTGRES_DB:-phishing_db}" \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1 | sed 's/^/  /'
fi

(
  cd "$BACKEND_DIR"
  FLASK_APP=run.py "$VENV/flask" db upgrade head 2>&1 | sed 's/^/  /'
)
success "Migrations applied."

# ── 3. Seed database ──────────────────────────────────────────────────────────
if [ "$SEED" = true ]; then
  step "Seeding database"
  (
    cd "$BACKEND_DIR"
    FLASK_APP=run.py "$VENV/flask" seed 2>&1 | sed 's/^/  /'
  )
  success "Database seeded."
fi

# ── 4. Flask backend ──────────────────────────────────────────────────────────
step "Starting Flask backend (port 5000)"
(
  cd "$BACKEND_DIR"
  "$VENV/python" run.py 2>&1 | sed 's/^/  [flask] /'
) > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

info "Waiting for Flask to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:5000/health &>/dev/null; then
    success "Flask backend is ready at http://localhost:5000"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    error "Flask process crashed. Check logs: $LOG_DIR/backend.log"
    tail -20 "$LOG_DIR/backend.log"
    exit 1
  fi
  if [ "$i" -eq 20 ]; then
    warn "Flask health check timed out — it may still be starting."
  fi
  sleep 1
done

# ── 5. Next.js frontend ───────────────────────────────────────────────────────
step "Starting Next.js frontend (port 3000)"
# Clear stale build cache to prevent vendor-chunk 404s after package changes
if [ -d "$FRONTEND_DIR/.next" ]; then
  info "Clearing stale .next cache..."
  rm -rf "$FRONTEND_DIR/.next"
fi
(
  cd "$FRONTEND_DIR"
  npm run dev 2>&1 | sed 's/^/  [next] /'
) > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

info "Waiting for Next.js to be ready (cold compile can take ~60s)..."
for i in $(seq 1 90); do
  if curl -sfL http://localhost:3000 &>/dev/null; then
    success "Next.js frontend is ready at http://localhost:3000"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    error "Next.js process crashed. Check logs: $LOG_DIR/frontend.log"
    tail -20 "$LOG_DIR/frontend.log"
    exit 1
  fi
  if [ "$i" -eq 90 ]; then
    warn "Next.js health check timed out — it may still be compiling. Check $LOG_DIR/frontend.log"
  fi
  sleep 1
done

# ── All done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Sentra is running!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${BOLD}Frontend${RESET}   →  http://localhost:3000"
echo -e "  ${BOLD}Backend${RESET}    →  http://localhost:5000"
echo -e "  ${BOLD}Postgres${RESET}   →  localhost:5432"
echo -e "  ${BOLD}Redis${RESET}      →  localhost:6379"
echo ""
echo -e "  ${BOLD}Logs${RESET}       →  $LOG_DIR/"
echo -e "  ${CYAN}Press Ctrl+C to stop all services.${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Tail logs to terminal ─────────────────────────────────────────────────────
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
TAIL_PID=$!
PIDS+=($TAIL_PID)

# Wait for any child to die unexpectedly
wait -n "${PIDS[@]}" 2>/dev/null || true
