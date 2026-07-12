#!/usr/bin/env bash
# sho0ping store — start everything with ONE command (Linux / macOS / Docker).
# The Linux/Docker twin of Start-Store.bat.
#
#   ./start-store.sh              run natively with Node.js (installs deps,
#                                 repairs the AI engine, seeds the catalog,
#                                 shows LAN URLs, starts the server)
#   ./start-store.sh docker       build + run in Docker (compose), seed once,
#                                 show URLs
#   ./start-store.sh stop         stop the store (native and/or Docker)
#   ./start-store.sh logs         follow the Docker container logs
#   ./start-store.sh seed         (re)load the sample catalog
#                                 (native: node seed.js — Docker: inside the container)
#
# First run tip: chmod +x start-store.sh   (or run it as: bash start-store.sh)
# The store then runs at http://localhost:3000 (native mode honors $PORT).

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-3000}"
MODE="${1:-native}"

say()  { printf '%s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# ---------- shared helpers ----------

show_urls() {
  say "============================================"
  say " On this computer:   http://localhost:$PORT"
  say " On your MOBILE (same Wi-Fi/LAN) use one of these:"
  {
    hostname -I 2>/dev/null ||
    ip -4 -o addr show 2>/dev/null | awk '{sub(/\/.*/,"",$4); print $4}' ||
    ifconfig 2>/dev/null | awk '/inet /{print $2}'
  } | tr ' ' '\n' | grep -Ev '^(127\.|$)' | while read -r ip; do
    say "   http://$ip:$PORT"
  done
  say "============================================"
}

open_browser() {
  if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || [ "$(uname)" = "Darwin" ]; then
    { command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT"; } >/dev/null 2>&1 &
    { command -v open     >/dev/null 2>&1 && open     "http://localhost:$PORT"; } >/dev/null 2>&1 &
  fi
}

stop_native() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  elif command -v pkill >/dev/null 2>&1; then
    pkill -f 'node server\.js' 2>/dev/null || true
  fi
}

have_docker() { command -v docker >/dev/null 2>&1; }

compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then docker-compose "$@"
  else fail "Docker Compose not found. Install the Compose plugin: https://docs.docker.com/compose/install/"
  fi
}

ai_engine_ok() {
  node -e "require('sharp');require('onnxruntime-node');require('@xenova/transformers')" >/dev/null 2>&1
}

# ---------- native (Node.js) mode — mirrors Start-Store.bat ----------

native_start() {
  command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install the LTS version from https://nodejs.org (or: sudo apt install nodejs npm)."
  command -v npm  >/dev/null 2>&1 || fail "npm is not installed (sudo apt install npm), then run this again."

  say "Stopping any old store server on port $PORT..."
  stop_native

  say "Checking dependencies (may take a few minutes on first run)..."
  npm install --no-audit --no-fund || fail "npm install failed — check your internet connection, then run this again."

  # Verify the AI engine actually loads on THIS machine; if not, reinstall clean
  if ! ai_engine_ok; then
    say "AI engine incomplete — doing a clean reinstall, please wait..."
    rm -rf node_modules package-lock.json
    npm install --no-audit --no-fund
    if ! ai_engine_ok; then
      fail "Install failed. Check your internet connection and disk space, then run this again.
If it keeps failing, copy this window's output and show it to Claude."
    fi
  fi

  if [ ! -f data/db.json ]; then
    say "Loading sample catalog..."
    node seed.js
  fi

  show_urls
  say "Starting store at http://localhost:$PORT ..."
  say "(First photo search downloads the built-in AI model ~120 MB, then it is cached.)"
  say "Stop it with Ctrl+C, or later with: ./start-store.sh stop"
  open_browser
  exec node server.js
}

# ---------- Docker mode ----------

docker_start() {
  have_docker || fail "Docker is not installed. Get it from https://docs.docker.com/engine/install/ (or run './start-store.sh' for native mode)."
  docker info >/dev/null 2>&1 || fail "Docker is installed but not reachable — start the Docker service, or add yourself to the 'docker' group (or run with sudo)."

  say "Building and starting the store container (first build takes a few minutes)..."
  compose up -d --build || fail "Docker build/start failed — see the output above."

  say "Waiting for the server to come up..."
  i=0
  while [ $i -lt 30 ]; do
    if curl -fs "http://localhost:$PORT/api/products" >/dev/null 2>&1; then break; fi
    i=$((i + 1)); sleep 1
  done

  # One-time: load the sample catalog into the persisted data volume
  if ! compose exec -T app test -f /app/data/db.json 2>/dev/null; then
    say "Loading sample catalog into the data volume (one-time)..."
    compose exec -T app npm run seed || say "  (seed failed — you can retry later with: ./start-store.sh seed)"
  fi

  show_urls
  say "Store is running in Docker (data persists in the 'appdata' volume)."
  say "  logs:  ./start-store.sh logs"
  say "  stop:  ./start-store.sh stop"
  say "(First photo search downloads the built-in AI model ~120 MB into the volume, then it is cached.)"
  open_browser
}

# ---------- other commands ----------

stop_all() {
  say "Stopping native server (port $PORT) if running..."
  stop_native
  if have_docker && docker info >/dev/null 2>&1; then
    say "Stopping Docker container if running..."
    compose down 2>/dev/null || true
  fi
  say "Done."
}

seed_cmd() {
  if have_docker && docker info >/dev/null 2>&1 && [ -n "$(compose ps -q app 2>/dev/null)" ]; then
    say "Seeding inside the Docker container..."
    compose exec -T app npm run seed
  else
    command -v node >/dev/null 2>&1 || fail "Node.js is not installed."
    say "Seeding locally (data/db.json)..."
    node seed.js
  fi
}

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

case "$MODE" in
  native|start|"") native_start ;;
  docker)          docker_start ;;
  stop|down)       stop_all ;;
  logs)            compose logs -f app ;;
  seed)            seed_cmd ;;
  -h|--help|help)  usage ;;
  *) say "Unknown option: $MODE"; usage ;;
esac
