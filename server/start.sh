#!/bin/sh
set -e
echo "Running database migrations..."
bun run migrate
echo "Starting application..."
bun run src/index.ts
