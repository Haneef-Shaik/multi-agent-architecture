#!/bin/bash
set -e

# Ensure workspace permissions
if [ -d "/workspace" ]; then
    chown -R sandbox:sandbox /workspace 2>/dev/null || true
fi

# Start supervisor (manages file watcher and other background processes)
exec "$@"
