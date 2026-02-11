#!/bin/sh
set -e

echo "Starting ICO API Service..."

# Start cron daemon in background (as root)
# DISABLED: Server resources are too limited for daily updates
# crond -b -L /app/logs/cron.log

# echo "Cron daemon started"
echo "Starting API server on port ${PORT:-26002} as apiuser..."

# Start API server as apiuser
exec su-exec apiuser:nodejs node dist/api/server.js
