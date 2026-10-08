# Italiano Bari — loyalty website + API in one container.
#
# `server.tsx` serves both the built SPA (./dist) and the /api routes, so a
# single service is enough. The database is SQLite, so it needs a volume
# mounted at /data (or set DATABASE_URL to a remote libSQL/Turso URL).
#
# Build the image from source on purpose: never ship a `dist/` folder that was
# built inside the Shogo preview, because its asset paths are rewritten to
# /p/<project-id>/... and 404 on any other host.

FROM oven/bun:1

WORKDIR /app

# Dependencies first so edits to app code don't re-download them.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Prisma client -> src/generated/prisma, then the SPA -> dist/
RUN bun run db:generate && bun run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=file:/data/loyalty.db

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3001

CMD ["sh", "/app/deploy/start.sh"]
