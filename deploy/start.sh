#!/bin/sh
# Container entrypoint: make sure the schema exists, optionally seed the
# loyalty program, then hand over to the server.
set -e

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    mkdir -p "$(dirname "$DB_PATH")"
    ;;
esac

echo "→ applying database schema (idempotent)"
bun run db:push

if [ "$RUN_SEED" = "1" ]; then
  echo "→ seeding loyalty program (rewards, settings, staff accounts)"
  bun run scripts/seed-loyalty.ts
fi

echo "→ starting server on port ${PORT:-3001}"
exec bun run server.tsx
