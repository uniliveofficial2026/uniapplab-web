#!/bin/bash
set -e
pnpm install --frozen-lockfile
if [ -n "${DATABASE_URL:-}" ]; then
  pnpm --filter @workspace/db push
else
  echo "Skipping db push: DATABASE_URL is not set."
fi
