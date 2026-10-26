#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR"

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to a directory outside the project.}"

RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
CAPTURE_SCRIPT="$RUNTIME_DIR/scripts/default-capture.mjs"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"

log() {
  printf '[capture] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
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

case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *)
    log "CAPTURE_URL must be an http(s) URL"
    exit 1
    ;;
esac

run_timed mkdir -p "$CAPTURE_DIR"
CAPTURE_DIR="$(cd -- "$CAPTURE_DIR" && pwd -P)"

case "$CAPTURE_DIR/" in
  "$PROJECT_DIR"/*)
    log "CAPTURE_DIR must be outside the project directory"
    exit 1
    ;;
esac

if [[ ! -f "$CAPTURE_SCRIPT" ]]; then
  log "capture helper not found: $CAPTURE_SCRIPT"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  log "node is required to run the capture helper"
  exit 1
fi

export CAPTURE_URL CAPTURE_DIR
export OPENCODE_WEB_DIR
export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-#channelList li:first-child}"
export CAPTURE_AUTO_START="${CAPTURE_AUTO_START:-false}"

run_timed node "$CAPTURE_SCRIPT"
