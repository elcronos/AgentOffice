#!/usr/bin/env bash
set -euo pipefail

# Running as root: fix /shared volume ownership so tinyclaw user can write
chown tinyclaw:tinyclaw /shared 2>/dev/null || true
rm -f /shared/.restart 2>/dev/null || true

# Source API keys from shared volume if present
[ -f /shared/api.env ] && source /shared/api.env

# Create agent workspace directories and fix ownership
mkdir -p /tinyclaw-workspace/{ceo,developer,designer,manager} /home/tinyclaw/.tinyclaw
chown -R tinyclaw:tinyclaw /tinyclaw-workspace /home/tinyclaw/.tinyclaw 2>/dev/null || true

# Copy default settings if not already present (preserves user edits across restarts)
if [ ! -f /home/tinyclaw/.tinyclaw/settings.json ]; then
    cp /app/config/settings.json /home/tinyclaw/.tinyclaw/settings.json
    chown tinyclaw:tinyclaw /home/tinyclaw/.tinyclaw/settings.json
fi

# Start the HTTP server as tinyclaw user (gosu exec's node, same PID, env preserved)
cd /app/tinyclaw
gosu tinyclaw node dist/server/index.js &
SERVER_PID=$!

sleep 3

# Start the queue processor as tinyclaw user
gosu tinyclaw node dist/queue-processor.js &
QUEUE_PID=$!

echo "[tinyclaw] Server PID=$SERVER_PID  Queue PID=$QUEUE_PID"

# Restart watcher: if /shared/.restart is created (e.g. after API key update),
# re-source api.env, kill both processes, and restart them.
while true; do
  sleep 2
  if [ -f /shared/.restart ]; then
    echo "[tinyclaw] Restart signal received — reloading..."
    rm -f /shared/.restart

    # Re-source updated API keys
    [ -f /shared/api.env ] && source /shared/api.env

    # Stop existing processes gracefully
    kill "$SERVER_PID" "$QUEUE_PID" 2>/dev/null || true
    wait "$SERVER_PID" "$QUEUE_PID" 2>/dev/null || true

    # Restart both as tinyclaw user
    gosu tinyclaw node dist/server/index.js &
    SERVER_PID=$!

    sleep 3

    gosu tinyclaw node dist/queue-processor.js &
    QUEUE_PID=$!

    echo "[tinyclaw] Restarted — Server PID=$SERVER_PID  Queue PID=$QUEUE_PID"
  fi
done
