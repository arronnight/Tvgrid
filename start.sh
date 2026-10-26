#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR"

OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_FILE="$OPENCODE_WEB_DIR/deployment-output.json"
PORT="${PORT:-3000}"
export PORT

log() {
  printf '[start] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

run_timed() {
  local started ended status elapsed_ms
  started="$(date +%s%N)"
  log "run: $*"
  if "$@"; then
    status=0
  else
    status=$?
  fi
  ended="$(date +%s%N)"
  elapsed_ms=$(( (ended - started) / 1000000 ))
  log "done: $* (${elapsed_ms}ms, exit $status)"
  return "$status"
}

prepare_build() {
  run_timed rm -rf "$BUILD_DIR"
  run_timed mkdir -p "$BUILD_DIR"
}

install_dependencies() {
  if [[ ! -f package.json ]]; then
    log "no package.json; using the static project sources"
    return 0
  fi
  if [[ -f package-lock.json ]]; then
    run_timed npm ci --no-audit --no-fund
  else
    run_timed npm install --no-audit --no-fund
  fi
  if run_timed node -e 'const p=require("./package.json"); process.exit(p.scripts && p.scripts.build ? 0 : 1)'; then
    run_timed npm run build
  fi
}

copy_static() {
  local files=(index.html app.js channels.js premium.js styles.css server.js)
  local file
  run_timed mkdir -p "$BUILD_DIR/vendor"
  for file in "${files[@]}"; do
    if [[ ! -f "$file" ]]; then
      log "missing required static file: $file"
      return 1
    fi
    run_timed cp "$file" "$BUILD_DIR/$file"
  done
  run_timed cp -R vendor/. "$BUILD_DIR/vendor/"
}

write_deployment_output() {
  local temporary
  run_timed mkdir -p "$OPENCODE_WEB_DIR"
  temporary="$DEPLOY_FILE.tmp.$$"
  printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$BUILD_DIR" > "$temporary"
  run_timed mv "$temporary" "$DEPLOY_FILE"
}

if ! command -v node >/dev/null 2>&1; then
  log "node is required to serve the static build"
  exit 1
fi

run_timed prepare_build
run_timed install_dependencies
run_timed copy_static
run_timed write_deployment_output

log "serving $BUILD_DIR on port $PORT"
cd "$BUILD_DIR"
exec node server.js
