# Deployment

The loyalty website is **not a static site**. It is a Hono server that serves
the built SPA *and* the `/api/*` routes (guest + staff) from one process, with
a SQLite database behind it. That means a host must be able to:

1. run a long-lived process (`bun run server.tsx`), and
2. keep a file on disk between deploys — or point at a remote database.

Vercel does neither: it serves static files, so every `/api/*` request returns
`404` there. That is why staff login fails on a Vercel-only deploy.

Everything below is already wired: `server.tsx` serves `./dist` with an SPA
fallback, enables CORS, and reads `PORT` / `DATABASE_URL` from the environment.

---

## Option A — one service on Render (recommended)

Runs the whole app: website + API + database.

1. Push this project to a GitHub repository.
2. Render → **New → Blueprint** → pick the repository. It reads `render.yaml`:
   - Docker build (the container builds the SPA itself)
   - a 1 GB disk mounted at `/data` (holds `loyalty.db`)
   - `RUN_SEED=1` so the default rewards, settings and staff accounts exist
3. Deploy, then open `https://<your-service>.onrender.com/health` — expect
   `{"ok":true,...}`.
4. Open the site, then `/#/staff`, and log in with `admin` / `4172`.

> A persistent disk requires a paid instance type (Starter and up). On the free
> tier there is no disk, so remove the `disk:` block and use Option C (Turso) —
> otherwise the database is wiped on every deploy.

### Same thing on Railway / Fly / any Docker host

Any host that runs a container and lets you mount a volume works:

```
docker build -t italiano-bari .
docker run -p 3001:3001 \
  -e DATABASE_URL=file:/data/loyalty.db \
  -e RUN_SEED=1 \
  -v loyalty-data:/data \
  italiano-bari
```

---

## Option B — keep the Vercel domain, host the API elsewhere

Vercel serves the frontend; the API lives on Render/Railway/Fly.

1. Deploy the API first (Option A), and note its URL, e.g.
   `https://italiano-bari.onrender.com`. Confirm `/health` and
   `/api/loyalty/rewards` answer there.
2. On Vercel, set the environment variable
   `VITE_API_BASE=https://italiano-bari.onrender.com`
   (no trailing slash). It is read at **build** time, so redeploy after adding it.
3. Vercel build command: `bun run build` · output directory: `dist`.
4. Redeploy and open `https://italianobari.vercel.app/#/staff`.

The API already sends `Access-Control-Allow-Origin: *`, so the cross-origin
call works. The session token travels in a query parameter as well as the
`Authorization` header, because some edge proxies strip the header.

---

## Option C — no disk at all, with Turso

`src/lib/db.ts` uses the libSQL adapter, which speaks to Turso as well as a
local file. Removes the volume requirement entirely.

```sh
turso db create italiano-bari
turso db show italiano-bari --url        # libsql://italiano-bari-<org>.turso.tech
turso db tokens create italiano-bari     # token
```

Then set, on the host:

```
DATABASE_URL=libsql://italiano-bari-<org>.turso.tech
TURSO_AUTH_TOKEN=<token>
RUN_SEED=1
```

---

## Before real customers use it

- [ ] **Change the default staff PINs.** `4172` (admin) and `8365` (cashier)
      are published demo values. Staff dashboard → *حسابات الموظفين* → the 🔑
      button on each row.
- [ ] Delete the demo guests (`0501234567`, `0559876543`, `0533445566`) or
      keep one for training.
- [ ] Confirm the rewards and point values in *الإعدادات* match what you will
      honour at the counter.
- [ ] Set `RUN_SEED=0` once the live database is populated, so a redeploy can
      never re-create demo rows.

## Gotchas

- **Do not deploy a `dist/` folder built inside the Shogo preview.** Its asset
  URLs are rewritten to `/p/<project-id>/...` and return 404 everywhere else.
  Let the container/host run `bun run build` instead — the Dockerfile does.
- `bun run db:push` runs on every boot. It is additive and safe; the SQLite
  file keeps its data as long as the volume is mounted.
- The frontend uses **hash routing** (`/#/staff`). A host does not need SPA
  rewrite rules for deep links.

## Troubleshooting

### Vercel: `Failed to resolve /src/main.tsx from /vercel/path0/index.html`

The build cannot find the app source, so `index.html` has nothing to load. This
is not a code or config problem — **the repository is missing the `src/`
folder** (usually only a handful of files were committed or uploaded).

Fix: make sure the whole project is in the repository, not just the top-level
files. Then confirm the source is really tracked:

```sh
git ls-files src | head          # must list files, e.g. src/main.tsx
git ls-files | wc -l             # should be ~100, not a handful
```

If that list is short, add everything and push again:

```sh
git add -A
git commit -m "Add full app source"
git push
```

`.gitignore` in this project ignores `node_modules`, `dist` and `.env*` only —
never `src/`. `vercel.json` already sets the build command, the Vite framework
preset and the `dist` output directory, so no dashboard settings are needed.

### Staff login returns 404 on the deployed site

The frontend is deployed but the API is not. Vercel serves static files only;
check with `curl <site>/api/staff/rewards` — a **401** means the API is healthy,
while **404** or an HTML body means only the frontend is there. Deploy the API
(Option A) and point the frontend at it with `VITE_API_BASE` (Option B).

## Verify a deployment

```sh
BASE=https://your-host
curl -s $BASE/health                       # {"ok":true,...}
curl -s $BASE/                          && echo   # 200 — the SPA
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/staff/rewards
#   401 is correct here: the API is mounted, the call just has no token.
#   A 200 with HTML, or a 404, means the API is NOT running — only the
#   static frontend is deployed.
curl -s -X POST $BASE/api/staff/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","pin":"4172"}'   # {"ok":true,"token":"..."}
```
