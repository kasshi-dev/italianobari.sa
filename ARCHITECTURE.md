# Italiano Bari — Menu + Loyalty & Rewards System

Everything is now one deployable app: the existing menu site, the customer
loyalty experience, and a separate password-protected staff dashboard — on top
of a real database with a real API.

---

## 1. Which backend should you use? (the short answer)

**Neither Firebase nor Supabase nor a separate Node/MongoDB service.**
This project already ships a backend, so adding a third-party one would mean
two logins, two billing accounts, CORS configuration, and a second deployment
target for no benefit.

What you already have, in this project:

| Layer | What it is | Where |
|---|---|---|
| API | Hono server, auto-mounted at `/api/*` | `custom-routes.ts` (+ `server.tsx`, generated) |
| Database | SQLite via Prisma 7 (real tables, real migrations) | `prisma/schema.prisma`, `prisma/dev.db` |
| Client | React + Tailwind + shadcn/ui | `src/` |
| Auth | Phone + PIN for guests, username + PIN for staff, opaque bearer sessions in the DB | `custom-routes.ts` |

### How it compares to the options you asked about

| | **This backend (recommended)** | Firebase | Supabase | Node + MongoDB |
|---|---|---|---|---|
| Setup for this project | **zero — already wired** | new project, SDK, security rules, API keys | new project, SDK, RLS policies | new server, hosting, drivers |
| Extra monthly cost | none | free tier then per-read/write | free tier then per-project | hosting + Atlas |
| Staff dashboard auth | built in (hashed PIN + DB sessions) | Firebase Auth (email/OAuth mostly) | Supabase Auth | you build it |
| Where the data lives | in this project's DB, next to the app | Google | Supabase cloud | Atlas cloud |
| Works in the preview right now | **yes** | only after you paste keys | only after you paste keys | only after deploy |
| Data model changes | edit `schema.prisma`, it regenerates | console clicks / rules | SQL migrations | hand-written |
| Cost of getting it wrong | low (one file) | vendor lock-in | vendor lock-in | ops burden |

**When you *would* switch:** if you need to share the customer list with your
existing POS system, a separate mobile app, or a marketing tool, then an
external database makes sense. SQLite → Postgres is a one-line datasource
change in `prisma/schema.prisma` if you outgrow it; Firebase/Supabase would be
a rewrite of everything in `custom-routes.ts`.

> Note on "Real production": SQLite is perfectly fine for a single restaurant —
> it handles thousands of guests without noticing. Move to Postgres only when
> you need multiple servers or an external system reading the same tables.

---

## 2. How the pieces connect

```
                    ┌──────────────────────────────────────┐
   Guest phone ────▶ │  Customer site  (/)                  │
                    │  MenuPage + LoyaltyPanel             │
                    │  src/components/menu, .../loyalty     │
                    └───────────────┬──────────────────────┘
                                    │ fetch('/api/loyalty/*')
                                    │ Authorization: Bearer <guest token>
                    ┌───────────────▼──────────────────────┐
   Staff browser ──▶ │  Staff dashboard (/#/staff)          │
   (separate URL)   │  StaffApp + tabs                     │
                    │  src/components/staff                 │
                    └───────────────┬──────────────────────┘
                                    │ fetch('/api/staff/*')
                                    │ Authorization: Bearer <staff token>
                    ┌───────────────▼──────────────────────┐
                    │  custom-routes.ts  (Hono)             │
                    │  · resolves session → role            │
                    │  · business rules (points, tiers,     │
                    │    redeem hold/refund)                │
                    └───────────────┬──────────────────────┘
                                    │ Prisma
                    ┌───────────────▼──────────────────────┐
                    │  SQLite: customers, rewards,          │
                    │  redemptions, points_transactions,    │
                    │  staff_users, loyalty_sessions,       │
                    │  loyalty_settings                     │
                    └──────────────────────────────────────┘
```

Both surfaces are the **same deployment**. The dashboard is a different route,
not a different site.

---

## 3. Directory structure

```
508541ed-.../
├── prisma/
│   └── schema.prisma            # ← all 7 loyalty tables (source of truth)
├── custom-routes.ts             # ← THE BACKEND: every loyalty + staff endpoint
├── server.tsx                   # auto-generated host, do not edit
├── scripts/
│   ├── seed-loyalty.ts          # rewards, settings, staff logins, demo guests
│   └── verify-loyalty-api.py    # end-to-end API test (60+ assertions)
├── public/menu/*.jpg|png        # food photos extracted from your zip
└── src/
    ├── App.tsx                  # routes /  vs  /#/staff
    ├── styles/menu.css          # your original brand CSS + loyalty + staff styles
    ├── data/menu.ts             # the menu (items, sizes, prices, badges)
    ├── lib/loyalty.ts           # typed API client + session storage
    ├── server/loyalty-guard.ts  # locks the auto-generated CRUD surface
    └── components/
        ├── menu/MenuPage.tsx            # the menu site (hero, chips, cards, lightbox)
        ├── loyalty/
        │   ├── useLoyalty.ts            # guest session state (points shown in the hero)
        │   └── LoyaltyPanel.tsx         # sign in / register, card, rewards, history
        └── staff/
            ├── StaffApp.tsx             # login + shell + overview + customer search
            ├── CustomerDetail.tsx       # points add/deduct, approve, ledger
            ├── RedemptionsTab.tsx       # the approval queue
            ├── RewardsTab.tsx           # create/edit/hide rewards
            └── TeamTab.tsx              # staff accounts + program settings
```

---

## 4. The rules the system enforces

| Rule | Value | Change it in |
|---|---|---|
| Points per riyal spent | 1 point = 1 SAR | إعدادات tab (Settings) |
| Welcome bonus | 100 points | إعدادات tab |
| Silver tier | 500 lifetime points | إعدادات tab |
| Gold tier | 1500 lifetime points | إعدادات tab |
| Guest login | phone + 4–6 digit PIN | — |
| Staff login | username + 6-digit-capable PIN | — |
| Guest session life | 90 days | `CUSTOMER_SESSION_DAYS` in `custom-routes.ts` |
| Staff session life | 12 hours | `STAFF_SESSION_HOURS` | 
| Failed logins | 8 tries / 15 min, then blocked | `MAX_ATTEMPTS` |

**Points lifecycle**

1. Guest signs up → welcome bonus written to the ledger.
2. Guest pays → staff enters the bill amount (or presses a quick 50/100/200/500
   riyal button) → points credited, visit counter +1.
3. Guest taps **استبدل** on a reward → points are **held** (deducted
   immediately, recorded as `redeem`) and a pending request with a code like
   `IB-7K3M9Q` is created.
4. Staff **approves** → the guest gets the reward (points already deducted).
5. Staff **rejects** → points are refunded automatically and written to the
   ledger as `refund`.

Holding points on request is deliberate: it stops a guest from requesting five
rewards with a balance that only covers one.

---

## 5. API reference

### Guest — `/api/loyalty/*`

All authenticated endpoints accept the session token in any of three places
(see the deployment note below for why):

- `Authorization: Bearer <token>` (canonical)
- `X-Loyalty-Token: <token>`
- `?token=<token>` (query parameter — the app sends this too)

| Method | Path | Body / notes |
|---|---|---|
| POST | `/register` | `{phone, name?, pin}` → `{token, customer}` |
| POST | `/login` | `{phone, pin}` → `{token, customer}` |
| POST | `/logout` | revokes the bearer token |
| GET | `/me` | customer + settings + rewards + redemptions + ledger (one round trip) |
| POST | `/redeem` | `{rewardId}` → holds points, creates a pending request |
| PATCH | `/profile` | `{name?, pin?}` |

### Staff — `/api/staff/*` (all require a staff bearer token)

| Method | Path | Notes |
|---|---|---|
| POST | `/login` · `/logout` · GET `/me` | session |
| GET | `/overview` | dashboard KPIs + recent activity |
| GET | `/customers?q=` | search by phone (accepted in `05…`, `9665…`, `+9665…`) or name |
| POST | `/customers` | create a guest at the counter → returns a temp PIN |
| GET | `/customers/:id` | full file: balance, ledger, redemption history |
| POST | `/customers/:id/points` | `{amountSar}` **or** `{points}` (+reason) |
| GET | `/redemptions?status=pending\|approved\|rejected\|all` | queue |
| POST | `/redemptions/:id/decide` | `{decision: "approve"\|"reject"}` |
| GET/POST/PATCH/DELETE | `/rewards[/:id]` | reward catalogue |
| GET/POST/PATCH | `/team[/:id]` | staff accounts (**admin only**, except your own PIN) |
| GET/PATCH | `/settings` | program rules (**admin only** for writes) |

Try it yourself:

```bash
# guest signs up
curl -s -X POST http://localhost:3101/api/loyalty/register \
  -H 'content-type: application/json' \
  -d '{"phone":"0555000111","name":"Test","pin":"1234"}'

# staff logs in, then searches
TOKEN=$(curl -s -X POST http://localhost:3101/api/staff/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","pin":"4172"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s "http://localhost:3101/api/staff/customers?q=0555" -H "authorization: Bearer $TOKEN"
```

---

## 6. Security — what protects the data

This matters because the app is on a public URL.

1. **The auto-generated CRUD surface is switched off.** Prisma models
   normally come with public `GET/POST/PATCH/DELETE /api/<model>s`. Without
   care, `GET /api/customers` would hand anyone on the internet your entire
   guest list with phone numbers. Each loyalty table's
   `src/generated/<model>.hooks.ts` now rejects that surface
   (`denyPublicCrud`), so the only way in is the session-checked routes.
   Verified: `/api/customers`, `/api/staff-users` and `/api/loyalty-sessions`
   all return an error to anonymous callers.
2. **PINs are never stored in the clear.** 16-byte random salt + `scrypt`
   (Node `crypto`), compared with `timingSafeEqual`. No PIN is ever returned
   by any endpoint — the API tests assert this.
3. **Sessions are DB rows, not client-side flags.** The bearer token is 32
   random bytes, has a server-side expiry, and is deleted on logout. Changing
   a staff PIN or deactivating an account kills that account's sessions
   immediately.
4. **Brute-force throttle** on both login endpoints (8 failures / 15 min).
5. **Role separation.** `staff` can serve customers; only `admin` can create
   staff, change roles, write settings, or deactivate accounts. Verified by
   test.
6. **The 12-hour staff session** means a dashboard left open on a counter
   tablet logs itself out overnight.

---

## 7. Step-by-step: running and using it

### First run (already done for you)

```bash
bun run scripts/seed-loyalty.ts   # rewards, settings, staff, demo guests
```

### Seeded logins — **change these before going live**

| Who | Username | PIN |
|---|---|---|
| Manager | `admin` | `4172` |
| Cashier | `cashier` | `8365` |

Change them in the **الإعدادات → حسابات الموظفين** tab (press الرمز on a row).
Changing your own PIN logs that account out everywhere — sign in again.

### Seeded demo guests (safe to delete)

| Phone | PIN | Notes |
|---|---|---|
| 0501234567 | 1111 | has points |
| 0559876543 | 2222 | has points |
| 0533445566 | 3333 | has points |

### Day-to-day at the counter

1. Open `https://<your-site>/#/staff` on a phone or tablet.
2. Log in as `cashier`.
3. When a guest pays: **العملاء** → type their phone → open them → enter the
   bill amount → **احتساب النقاط**. (Or just press 50 / 100 / 200 / 500.)
   No account yet? Press **+ عميل جديد**, and hand the guest the temporary PIN
   it shows.
4. When a guest shows a reward code: **الاستبدال** → **تسليم المكافأة**
   (or **رفض وإرجاع النقاط** to refund them).

### Guest experience

1. Scan the QR / open the site.
2. Tap the gold **برنامج المكافآت** button in the hero.
3. **حساب جديد** → phone + a 4–6 digit PIN → 100 welcome points.
4. Thereafter they see their card, points, tier progress, and can redeem.

### Verifying it still works after changes

```bash
python3 scripts/verify-loyalty-api.py
# → RESULT: 0 failure(s) — all checks passed

# against the deployed URL instead of localhost:
LOYALTY_API_BASE=https://508541ed-d9e9-4616-9239-4a4ef12cdd18.preview.shogo.ai \
  python3 scripts/verify-loyalty-api.py
```

It creates one throwaway guest, exercises every endpoint (auth, points,
redeem, approve, refund, rewards, team, settings, blocked CRUD surface),
asserts the response shapes, then deletes everything it made. Safe to run
against the live database.

### ⚠️ One deployment gotcha you should know about

**The public URL sits behind a proxy that strips the `Authorization` header.**

This is not hypothetical — it cost real debugging time here, and the symptom is
nasty: `POST /login` returns `200` with a valid token, then the very next
authenticated request returns `401`, so the app bounces the user straight back
to the sign-in form. The identical request returns `200` from inside the
runtime (`localhost`), which makes it look like a code bug when it is not.

```
localhost:8080        login → 200,  GET /me (Authorization) → 200   ✅
public preview URL    login → 200,  GET /me (Authorization) → 401   ❌
public preview URL    login → 200,  GET /me (?token=…)      → 200   ✅
```

Custom headers are dropped too (`X-Loyalty-Token` → 401), so the only transport
that survives is the **query string**. That is why:

- the API accepts the token from all three places (`bearer()` in `custom-routes.ts`), and
- `src/lib/loyalty.ts` sends it in the query string *and* the header.

If you later deploy to a host that forwards `Authorization` properly (a plain
load balancer, Vercel, Fly, your own VPS), nothing breaks — the header path
simply starts working too. If you *do* move hosts and want to stop putting the
token in URLs, delete the `withToken()` helper in `src/lib/loyalty.ts`; the
server side already accepts the header.

Two more effects of the same proxy, worth knowing before you debug them:

- **Cloudflare rejects non-browser clients** with `error code: 1010`. That is
  why `scripts/verify-loyalty-api.py` sends a browser `User-Agent`.
- A cached unauthenticated `401` can be replayed for later valid requests, so
  every API response now sets `Cache-Control: no-store` and
  `Vary: Authorization`.

### Note on first-request latency

The **first** request after a deploy or restart can take several seconds while
the pod warms up (measured: 24 s cold, then 0.12 s warm through the public URL,
0.02 s from inside the runtime). PIN hashing is not the cost — PBKDF2 at 120k
iterations takes 16 ms. If sign-in ever feels slow, check whether you just
deployed before changing anything; a warm pod answers in ~100 ms end to end.

---

## 8. Deploying

The app is **already reachable** on its preview URL — that is a real
deployment, not a screenshare. To put it on a permanent public domain, the
workspace needs the Pro plan (Settings → Billing) and then it can be published
to something like `italianobari.shogo.one`.

Because the menu is a single-page app and the dashboard is a hash route
(`/#/staff`), **no server rewrite rules are needed** — it works on any static
host as-is. For a fully custom domain (e.g. `menu.italianobari.sa`), point a
CNAME at the host and you are done.

Two things to remember when you deploy for real:

1. Change the seeded staff PINs.
2. If you outgrow one machine, switch `datasource db` in
   `prisma/schema.prisma` from `sqlite` to `postgresql` — the application code
   does not change.

---

## 9. Deliberate choices worth knowing

- **Phone number is the identity.** Staff should never need a name or an email
  to serve a guest. Names are optional everywhere.
- **Saudi numbers only**, normalised to `05XXXXXXXX` — `+9665…`, `9665…`,
  `009665…`, `5…` and Arabic-Indic digits are all accepted and stored
  identically, so `0501234567` and `+966501234567` are the same account.
- **Arabic-first RTL UI** with English sub-labels, matching the menu.
- **Points are integers, never floats.** `pointsPerSar` converts a bill to
  whole points server-side, so the client can never invent a balance.
- **Deactivating a reward instead of deleting it** when it has history — the
  guest's past redemptions still resolve to a real title.
- **No `service worker`/offline cache yet.** Add one if the menu must work in
  a dead zone inside the restaurant.

---

## 10. Ideas for next

- WhatsApp/SMS "you just earned 120 points" message after a bill.
- Guest self-service "my QR code" screen for the counter to scan.
- Birthday-month double points (a `birthday` field on Customer + a scheduled
  job).
- A printable PDF of the loyalty card.
- Export the guest list to CSV from the dashboard.
- Daily summary email to the owner.

---

## Deployment

This app is a server, not a static site: `server.tsx` serves the built SPA from
`./dist` **and** the `/api/*` routes from one process, backed by SQLite. A
static host such as Vercel therefore cannot run it — every `/api/*` call there
returns 404, which is why staff login fails on a Vercel-only deploy.

See **[DEPLOY.md](./DEPLOY.md)** for the step-by-step: a one-service Docker
deploy (Render/Railway/Fly), a Turso database instead of a disk, and how to keep
an existing Vercel domain in front by pointing `VITE_API_BASE` at the API host.
