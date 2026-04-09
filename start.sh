#!/usr/bin/env bash
# start.sh — Start the full Sentra stack
# Usage: ./start.sh [--no-seed] [--reset-db] [--detach]
#
#   --no-seed   Skip database seeding (use when DB already has data)
#   --reset-db  Drop and recreate the public schema before migrating (fresh start)
#   --detach    Run all services in the background and exit

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Windows (Git Bash / MSYS) uses Scripts/, Unix uses bin/
if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || -d "$SCRIPT_DIR/.venv/Scripts" ]]; then
  VENV="$SCRIPT_DIR/.venv/Scripts"
else
  VENV="$SCRIPT_DIR/.venv/bin"
fi
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
DETACH=false
for arg in "$@"; do
  case $arg in
    --no-seed)  SEED=false ;;
    --reset-db) RESET_DB=true ;;
    --detach)   DETACH=true ;;
    *) error "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── PID tracking for clean shutdown ──────────────────────────────────────────
PIDS=()

cleanup() {
  # In detached mode the trap only fires if startup itself fails;
  # normal shutdown is handled by stop.sh.
  if [ "$DETACH" = true ]; then
    return
  fi
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

# ── 1. Docker services (Postgres + Redis + Ollama) ───────────────────────────
step "Starting Docker services (Postgres + Redis + Ollama)"
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

info "Waiting for Ollama to be healthy..."
OLLAMA_READY=false
for i in $(seq 1 30); do
  if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    OLLAMA_READY=true
    success "Ollama is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "Ollama did not become healthy — GGUF mode will fall back to Standard on first scan."
  fi
  sleep 1
done

if [ "$OLLAMA_READY" = true ]; then
  _OLLAMA_MODEL="${OLLAMA_MODEL:-hf.co/duyle240820/sentra-utoledo-v2.0}"
  if curl -sf -X POST http://localhost:11434/api/show \
       -H "Content-Type: application/json" \
       -d "{\"name\":\"$_OLLAMA_MODEL\"}" &>/dev/null; then
    success "Ollama model already present: $_OLLAMA_MODEL"
  else
    info "Pulling Ollama model '$_OLLAMA_MODEL' in background (~900 MB, one-time)..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T ollama \
      ollama pull "$_OLLAMA_MODEL" >> "$LOG_DIR/ollama.log" 2>&1 &
    info "Pull running in background — check $LOG_DIR/ollama.log"
    info "First GGUF scan will wait until the pull finishes."
  fi
fi

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
) >> "$LOG_DIR/backend.log" 2>&1 &
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

# ── 4.5. Celery worker ────────────────────────────────────────────────────────
step "Starting Celery worker"
# Kill any leftover workers from a previous run before starting fresh
_stale_celery=$(ps aux | grep "[c]elery" | awk '{print $2}') || true
if [ -n "$_stale_celery" ]; then
  echo "$_stale_celery" | xargs kill -9 2>/dev/null || true
  sleep 1
fi
(
  cd "$BACKEND_DIR"
  "$VENV/celery" -A celery_worker worker --loglevel=info --concurrency=2 2>&1 | sed 's/^/  [celery] /'
) >> "$LOG_DIR/celery.log" 2>&1 &
CELERY_PID=$!
PIDS+=($CELERY_PID)
sleep 3
if kill -0 "$CELERY_PID" 2>/dev/null; then
  success "Celery worker started (PID $CELERY_PID)"
else
  error "Celery worker crashed. Check $LOG_DIR/celery.log"
fi

# ── 5. Next.js frontend ───────────────────────────────────────────────────────
step "Starting Next.js frontend (port 3000)"

# Kill any orphaned next processes from previous runs
pkill -TERM -f "next-server|next dev" 2>/dev/null || true
sleep 1
pkill -9 -f "next-server|next dev" 2>/dev/null || true

info "Clearing Next.js build cache..."
rm -rf "$FRONTEND_DIR/.next"
rm -rf "$FRONTEND_DIR/node_modules/.cache"

(
  cd "$FRONTEND_DIR"
  npm run dev 2>&1 | sed 's/^/  [next] /'
) >> "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

info "Waiting for Next.js to be ready (cold compile takes ~90s without cache)..."
for i in $(seq 1 150); do
  # Check if the server responds — accept any HTTP status (200, 307, 404 all mean it's up)
  if curl -s --max-time 2 http://localhost:3000 -o /dev/null 2>/dev/null; then
    success "Next.js frontend is ready at http://localhost:3000"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    error "Next.js process crashed. Check logs: $LOG_DIR/frontend.log"
    tail -20 "$LOG_DIR/frontend.log"
    exit 1
  fi
  if [ "$i" -eq 150 ]; then
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
echo -e "  ${BOLD}Ollama${RESET}     →  http://localhost:11434"
echo ""
echo -e "  ${BOLD}Logs${RESET}       →  $LOG_DIR/"

# ── Detach mode: save PIDs and exit ──────────────────────────────────────────
if [ "$DETACH" = true ]; then
  echo -e "  ${CYAN}Run ./stop.sh to stop all services.${RESET}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  # Detach child processes from this shell so they survive after exit
  disown "${PIDS[@]}"
  exit 0
fi

echo -e "  ${CYAN}Press Ctrl+C to stop all services.${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Tail logs to terminal ─────────────────────────────────────────────────────
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
TAIL_PID=$!
PIDS+=($TAIL_PID)

wait -n "${PIDS[@]}" 2>/dev/null || true
