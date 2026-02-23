#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}"; exit 1; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ─── Locate script dir ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════╗"
echo "  ║  🏢  AgentOffice Launcher     ║"
echo "  ╚═══════════════════════════════╝"
echo -e "${RESET}"

# ─── Parse flags ─────────────────────────────────────────────────────────────
REBUILD=false
STOP=false
LOGS=false
for arg in "$@"; do
  case "$arg" in
    --rebuild|-r) REBUILD=true ;;
    --stop|-s)    STOP=true ;;
    --logs|-l)    LOGS=true ;;
    --help|-h)
      echo "Usage: ./launch.sh [options]"
      echo ""
      echo "  (no flags)   Start AgentOffice (build only if images missing)"
      echo "  -r, --rebuild  Force rebuild of Docker images"
      echo "  -s, --stop     Stop and remove containers"
      echo "  -l, --logs     Tail logs after starting"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
  esac
done

# ─── Stop mode ───────────────────────────────────────────────────────────────
if $STOP; then
  info "Stopping AgentOffice containers…"
  docker compose down
  success "Stopped."
  exit 0
fi

# ─── 1. Check Docker ─────────────────────────────────────────────────────────
header "Checking prerequisites…"

if ! command -v docker &>/dev/null; then
  error "Docker not found. Install Docker Desktop from https://docker.com/products/docker-desktop"
fi

if ! docker info &>/dev/null 2>&1; then
  error "Docker daemon is not running. Start Docker Desktop and try again."
fi
success "Docker is running"

if ! docker compose version &>/dev/null 2>&1; then
  error "Docker Compose v2 not found. Update Docker Desktop to a recent version."
fi
success "Docker Compose $(docker compose version --short) available"

# ─── 2. .env setup ───────────────────────────────────────────────────────────
header "Checking environment…"

if [ ! -f .env ]; then
  warn ".env not found — creating from .env.example"
  cp .env.example .env
  echo ""
  echo -e "  ${YELLOW}Open ${BOLD}.env${RESET}${YELLOW} and paste your API key before continuing.${RESET}"
  echo -e "  ${YELLOW}Supported: Anthropic, OpenAI, or OpenRouter keys.${RESET}"
  echo ""
  read -rp "  Press Enter once you've saved your API key… "
fi

# Warn if no key is set
ANTHROPIC_KEY="$(grep -E '^ANTHROPIC_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
OPENAI_KEY="$(grep -E '^OPENAI_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
OPENROUTER_KEY="$(grep -E '^OPENROUTER_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"

if [[ -z "$ANTHROPIC_KEY" && -z "$OPENAI_KEY" && -z "$OPENROUTER_KEY" ]] || \
   [[ "$ANTHROPIC_KEY" == "your-anthropic-key-here" ]]; then
  warn "No API key set in .env — agents won't respond until you add a key in Settings."
  echo ""
else
  PREVIEW_KEY="${ANTHROPIC_KEY:-${OPENAI_KEY:-${OPENROUTER_KEY}}}"
  success ".env configured (key: ${PREVIEW_KEY:0:8}…)"
fi

# ─── 3. Build & start ────────────────────────────────────────────────────────
header "Starting services…"

BUILD_FLAG=""
if $REBUILD; then
  BUILD_FLAG="--build"
  info "Rebuilding images (tinyclaw build may take ~5 min on first run)…"
elif ! docker image inspect agentoffice-backend &>/dev/null 2>&1 || \
     ! docker image inspect agentoffice-frontend &>/dev/null 2>&1; then
  BUILD_FLAG="--build"
  info "First run — building images (tinyclaw build may take ~5 min)…"
else
  info "Images exist — starting containers…"
fi

docker compose up -d $BUILD_FLAG

# ─── 4. Wait for health ───────────────────────────────────────────────────────
header "Waiting for backend to be ready…"

RETRIES=60
HEALTHY=false
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:8000/api/health &>/dev/null; then
    HEALTHY=true
    break
  fi
  printf "  ${CYAN}▸ attempt %d/%d (tinyclaw may still be initializing)…${RESET}\r" "$i" "$RETRIES"
  sleep 3
done
echo ""

if ! $HEALTHY; then
  warn "Backend health check timed out. Showing logs:"
  docker compose logs --tail=30 backend
  echo ""
  warn "Try: ./launch.sh --rebuild"
  exit 1
fi

success "Backend is healthy"

# Verify tinyclaw is reachable
if curl -sf http://localhost:3777/api/queue/status &>/dev/null; then
  success "tinyclaw is ready"
else
  warn "tinyclaw not yet responding on port 3777 — it may still be starting"
fi

# Verify frontend is up
if curl -sf http://localhost:3000 &>/dev/null; then
  success "Frontend is ready"
else
  warn "Frontend not responding yet — it may still be starting"
fi

# ─── 5. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  AgentOffice is running!${RESET}"
echo -e "${BOLD}══════════════════════════════════════${RESET}"
echo ""
echo -e "  🌐  App       →  ${CYAN}http://localhost:3000${RESET}"
echo -e "  🔌  API       →  ${CYAN}http://localhost:8000/api/health${RESET}"
echo -e "  🤖  tinyclaw  →  ${CYAN}http://localhost:3777/api/queue/status${RESET}"
echo ""
echo -e "  ${YELLOW}First time?${RESET} Click ${BOLD}Settings${RESET} in the top-right corner"
echo -e "  and paste your API key to activate the agents."
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    ./launch.sh --logs      # tail live logs"
echo -e "    ./launch.sh --rebuild   # force image rebuild"
echo -e "    ./launch.sh --stop      # stop all containers"
echo -e "    docker compose logs -f tinyclaw  # tinyclaw logs"
echo ""

# ─── 6. Open browser ─────────────────────────────────────────────────────────
if command -v open &>/dev/null; then          # macOS
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then    # Linux
  xdg-open http://localhost:3000 &>/dev/null &
fi

# ─── 7. Optional log tail ─────────────────────────────────────────────────────
if $LOGS; then
  echo -e "${CYAN}Tailing logs (Ctrl+C to stop)…${RESET}\n"
  docker compose logs -f
fi
