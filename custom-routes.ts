// SPDX-License-Identifier: Apache-2.0
/**
 * Italiano Bari — Loyalty & Rewards API
 *
 * Mounted under `/api`. Two distinct surfaces:
 *
 *   /api/loyalty/*  guest-facing   (session role = "customer")
 *   /api/staff/*    staff dashboard (session role = "staff")
 *
 * Guests authenticate with phone + 4-6 digit PIN, staff with username + PIN.
 * Both receive an opaque bearer token stored in the `loyalty_sessions` table,
 * so sessions are revocable and expire on their own.
 *
 * The auto-generated CRUD routes for the loyalty tables are disabled in
 * `src/generated/<model>.hooks.ts` — every read/write below goes through
 * Prisma directly and is scoped to the caller.
 */

import { Hono } from 'hono'
import { prisma } from './src/lib/db.js'

const app = new Hono()

/**
 * Never let an API response be cached.
 *
 * Without this, an unauthenticated 401 (e.g. the first `/loyalty/me` call a
 * fresh visitor makes) can be cached by an intermediary and then replayed for
 * later requests that DO carry a valid bearer token — the app looks signed out
 * forever. `Vary: Authorization` additionally tells any compliant cache that
 * the response depends on the caller's credentials.
 */
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  c.res.headers.set('Pragma', 'no-cache')
  c.res.headers.set('Vary', 'Authorization')
})

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const CUSTOMER_SESSION_DAYS = 90
const STAFF_SESSION_HOURS = 12

/**
 * PIN hashing.
 *
 * PBKDF2-SHA256 (120k iterations) in place of scrypt: it is the same strength
 * class for a 4-6 digit secret, and it runs on the standard Web Crypto API that
 * Bun and every browser already provide — no Node-specific imports, no polyfill.
 * Stored format: `pbkdf2$<iterations>$<saltHex>$<keyHex>`.
 */
const PIN_ITERATIONS = 120_000
const PIN_PREFIX = 'pbkdf2'
const textEncoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function derivePin(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

/** Constant-time-ish comparison of two equal-length hex strings. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await derivePin(pin, salt, PIN_ITERATIONS)
  return `${PIN_PREFIX}$${PIN_ITERATIONS}$${toHex(salt)}$${key}`
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iterations, saltHex, keyHex] = (stored ?? '').split('$')
  if (scheme !== PIN_PREFIX || !saltHex || !keyHex) return false
  const rounds = Number(iterations)
  if (!Number.isFinite(rounds) || rounds <= 0) return false
  const candidate = await derivePin(pin, fromHex(saltHex), rounds)
  return safeEqualHex(candidate, keyHex)
}

/** True when a stored hash is in the current format (used by the seed script). */
function isCurrentPinHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${PIN_PREFIX}$`)
}

type Tier = 'bronze' | 'silver' | 'gold'

const TIER_LABEL: Record<Tier, { ar: string; en: string; emoji: string }> = {
  bronze: { ar: 'برونزي', en: 'Bronze', emoji: '🥉' },
  silver: { ar: 'فضي', en: 'Silver', emoji: '🥈' },
  gold: { ar: 'ذهبي', en: 'Gold', emoji: '🥇' },
}

/** Random integer in [0, max) via Web Crypto, rejection-sampled to stay unbiased. */
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max
  const buf = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

/**
 * Normalize a Saudi mobile number to `05XXXXXXXX`.
 * Accepts 05xxxxxxxx, 5xxxxxxxx, +9665xxxxxxxx, 009665xxxxxxxx, with or
 * without spaces/dashes. Returns null when it cannot be a local mobile.
 */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const latin = raw.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
  let d = latin.replace(/[^\d]/g, '')
  if (d.startsWith('00966')) d = d.slice(5)
  else if (d.startsWith('966')) d = d.slice(3)
  if (d.startsWith('5') && d.length === 9) d = '0' + d
  if (d.startsWith('05') && d.length === 10) return d
  return null
}

const isPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4,6}$/.test(v)

function newToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

function redemptionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[randomIndex(alphabet.length)]
  return `IB-${out}`
}

async function getSettings() {
  const existing = await prisma.loyaltySettings.findUnique({ where: { id: 'default' } })
  if (existing) return existing
  return prisma.loyaltySettings.create({ data: { id: 'default' } })
}

function tierFor(lifetimePoints: number, s: { silverMin: number; goldMin: number }): Tier {
  if (lifetimePoints >= s.goldMin) return 'gold'
  if (lifetimePoints >= s.silverMin) return 'silver'
  return 'bronze'
}

/** Progress data for the loyalty card: points into the current tier and the next one. */
function tierProgress(lifetimePoints: number, s: { silverMin: number; goldMin: number }) {
  const tier = tierFor(lifetimePoints, s)
  if (tier === 'gold') {
    return { tier, next: null, current: lifetimePoints, target: lifetimePoints, remaining: 0, percent: 100 }
  }
  const target = tier === 'silver' ? s.goldMin : s.silverMin
  const floor = tier === 'silver' ? s.silverMin : 0
  const span = Math.max(1, target - floor)
  const current = lifetimePoints - floor
  return {
    tier,
    next: tier === 'silver' ? ('gold' as Tier) : ('silver' as Tier),
    current,
    target: span,
    remaining: Math.max(0, target - lifetimePoints),
    percent: Math.min(100, Math.round((current / span) * 100)),
  }
}

/** Public shape of a customer. Never leaks pinHash. */
function publicCustomer(c: any, settings: { silverMin: number; goldMin: number; pointsPerSar: number }) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name ?? null,
    pointsBalance: c.pointsBalance,
    lifetimePoints: c.lifetimePoints,
    visits: c.visits,
    memberSince: c.createdAt,
    tier: tierFor(c.lifetimePoints, settings),
    tierLabel: TIER_LABEL[tierFor(c.lifetimePoints, settings)],
    progress: tierProgress(c.lifetimePoints, settings),
  }
}

function publicStaff(s: any) {
  return { id: s.id, username: s.username, name: s.name, role: s.role }
}

async function readJson(c: any): Promise<Record<string, any>> {
  try {
    const body = await c.req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

/* -------------------------------------------------------------------------- */
/* sessions                                                                   */
/* -------------------------------------------------------------------------- */

async function createSession(role: 'customer' | 'staff', subjectId: string) {
  const hours = role === 'staff' ? STAFF_SESSION_HOURS : CUSTOMER_SESSION_DAYS * 24
  const token = newToken()
  await prisma.loyaltySession.create({
    data: {
      token,
      role,
      subjectId,
      expiresAt: new Date(Date.now() + hours * 3600 * 1000),
    },
  })
  return token
}

/**
 * Extract the caller's session token.
 *
 * The canonical transport is `Authorization: Bearer <token>`. Some edge
 * proxies between the public URL and this app strip `Authorization` before the
 * request arrives (observed on the preview host: the same request returns 200
 * from inside the runtime and 401 through the public origin), which would log
 * every guest out. So the same opaque token is also accepted from a private
 * `X-Loyalty-Token` header and from a `?token=` query parameter. All three are
 * the same server-issued secret; none of them weakens the check.
 */
function bearer(c: any): string | null {
  const h = c.req.header('authorization') || c.req.header('Authorization')
  const m = h ? /^Bearer\s+(.+)$/i.exec(h.trim()) : null
  const fromAuthorization = m ? m[1].trim() : null
  const fromHeader = (c.req.header('x-loyalty-token') || '').trim()
  const fromQuery = (c.req.query('token') || '').trim()
  return fromAuthorization || fromHeader || fromQuery || null
}

/** Resolves the caller's session, or returns null. */
async function currentSession(c: any) {
  const token = bearer(c)
  if (!token) return null
  const session = await prisma.loyaltySession.findUnique({ where: { token } })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.loyaltySession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  return session
}

async function requireCustomer(c: any) {
  const session = await currentSession(c)
  if (!session || session.role !== 'customer') return null
  return prisma.customer.findUnique({ where: { id: session.subjectId } })
}

async function requireStaff(c: any) {
  const session = await currentSession(c)
  if (!session || session.role !== 'staff') return null
  const staff = await prisma.staffUser.findUnique({ where: { id: session.subjectId } })
  if (!staff || !staff.active) return null
  return staff
}

/* -------------------------------------------------------------------------- */
/* brute-force throttle (in-memory; resets with the server)                    */
/* -------------------------------------------------------------------------- */

const attempts = new Map<string, { count: number; until: number }>()
const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

function throttled(key: string): number {
  const rec = attempts.get(key)
  if (!rec) return 0
  if (rec.count < MAX_ATTEMPTS) return 0
  const left = rec.until - Date.now()
  return left > 0 ? Math.ceil(left / 1000) : 0
}

function noteFailure(key: string) {
  const rec = attempts.get(key) ?? { count: 0, until: 0 }
  rec.count += 1
  rec.until = Date.now() + WINDOW_MS
  attempts.set(key, rec)
}

function clearFailures(key: string) {
  attempts.delete(key)
}

/* ========================================================================== */
/* GUEST API — /api/loyalty/*                                                  */
/* ========================================================================== */

app.post('/loyalty/register', async (c) => {
  const body = await readJson(c)
  const phone = normalizePhone(body.phone)
  if (!phone) {
    return c.json({ error: 'رقم الجوال غير صحيح. استخدم رقم سعودي مثل 05XXXXXXXX' }, 400)
  }
  if (!isPin(body.pin)) {
    return c.json({ error: 'الرمز السري يجب أن يكون من 4 إلى 6 أرقام' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''

  const existing = await prisma.customer.findUnique({ where: { phone } })
  if (existing) {
    return c.json({ error: 'هذا الرقم مسجل بالفعل. سجّل الدخول بدلاً من ذلك' }, 409)
  }

  const settings = await getSettings()
  const bonus = settings.welcomeBonus

  const customer = await prisma.customer.create({
    data: {
      phone,
      name: name || null,
      pinHash: await hashPin(body.pin),
      pointsBalance: bonus,
      lifetimePoints: bonus,
      transactions: bonus
        ? {
            create: {
              points: bonus,
              type: 'welcome',
              reason: 'مكافأة الترحيب / Welcome bonus',
              balanceAfter: bonus,
            },
          }
        : undefined,
    },
  })

  const token = await createSession('customer', customer.id)
  return c.json({
    token,
    customer: publicCustomer(customer, settings),
    settings: { pointsPerSar: settings.pointsPerSar, welcomeBonus: settings.welcomeBonus },
  })
})

app.post('/loyalty/login', async (c) => {
  const body = await readJson(c)
  const phone = normalizePhone(body.phone)
  if (!phone) return c.json({ error: 'رقم الجوال غير صحيح' }, 400)

  const wait = throttled(`cust:${phone}`)
  if (wait) return c.json({ error: `محاولات كثيرة. حاول بعد ${wait} ثانية` }, 429)

  const customer = await prisma.customer.findUnique({ where: { phone } })
  if (!customer || !(await verifyPin(body.pin, customer.pinHash))) {
    noteFailure(`cust:${phone}`)
    return c.json({ error: 'الرقم أو الرمز السري غير صحيح' }, 401)
  }
  clearFailures(`cust:${phone}`)

  const settings = await getSettings()
  const token = await createSession('customer', customer.id)
  return c.json({
    token,
    customer: publicCustomer(customer, settings),
    settings: { pointsPerSar: settings.pointsPerSar, welcomeBonus: settings.welcomeBonus },
  })
})

app.post('/loyalty/logout', async (c) => {
  const token = bearer(c)
  if (token) await prisma.loyaltySession.deleteMany({ where: { token } })
  return c.json({ ok: true })
})

/** Everything the guest app needs in one round trip. */
app.get('/loyalty/me', async (c) => {
  const customer = await requireCustomer(c)
  if (!customer) return c.json({ error: 'غير مصرح. الرجاء تسجيل الدخول' }, 401)

  const settings = await getSettings()
  const [rewards, redemptions, transactions] = await Promise.all([
    prisma.reward.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.redemption.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.pointsTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  return c.json({
    customer: publicCustomer(customer, settings),
    settings: {
      pointsPerSar: settings.pointsPerSar,
      silverMin: settings.silverMin,
      goldMin: settings.goldMin,
      welcomeBonus: settings.welcomeBonus,
    },
    rewards: rewards.map((r) => ({
      id: r.id,
      titleAr: r.titleAr,
      titleEn: r.titleEn,
      descAr: r.descAr,
      emoji: r.emoji,
      costPoints: r.costPoints,
      affordable: customer.pointsBalance >= r.costPoints,
    })),
    redemptions,
    transactions,
  })
})

/** Spend points on a reward. Points are held immediately; staff approve or reject. */
app.post('/loyalty/redeem', async (c) => {
  const customer = await requireCustomer(c)
  if (!customer) return c.json({ error: 'غير مصرح. الرجاء تسجيل الدخول' }, 401)

  const body = await readJson(c)
  const reward = await prisma.reward.findUnique({ where: { id: String(body.rewardId ?? '') } })
  if (!reward || !reward.active) return c.json({ error: 'المكافأة غير متاحة' }, 404)
  if (customer.pointsBalance < reward.costPoints) {
    return c.json({ error: `تحتاج ${reward.costPoints - customer.pointsBalance} نقطة إضافية` }, 400)
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { pointsBalance: { decrement: reward.costPoints } },
    })
    await tx.pointsTransaction.create({
      data: {
        customerId: customer.id,
        points: -reward.costPoints,
        type: 'redeem',
        reason: `طلب استبدال: ${reward.titleAr}`,
        balanceAfter: updated.pointsBalance,
      },
    })
    return tx.redemption.create({
      data: {
        code: redemptionCode(),
        customerId: customer.id,
        rewardId: reward.id,
        rewardTitle: reward.titleAr,
        pointsCost: reward.costPoints,
        status: 'pending',
      },
    })
  })

  return c.json({
    ok: true,
    redemption: result,
    pointsBalance: result ? customer.pointsBalance - reward.costPoints : customer.pointsBalance,
    message: 'تم إرسال الطلب. أظهر الرقم للكاشير للحصول على المكافأة',
  })
})

app.patch('/loyalty/profile', async (c) => {
  const customer = await requireCustomer(c)
  if (!customer) return c.json({ error: 'غير مصرح' }, 401)
  const body = await readJson(c)
  const data: Record<string, any> = {}
  if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 60) || null
  if (isPin(body.pin)) data.pinHash = await hashPin(body.pin)
  if (!Object.keys(data).length) return c.json({ error: 'لا يوجد تغيير' }, 400)
  const updated = await prisma.customer.update({ where: { id: customer.id }, data })
  const settings = await getSettings()
  return c.json({ ok: true, customer: publicCustomer(updated, settings) })
})

/* ========================================================================== */
/* STAFF API — /api/staff/*                                                    */
/* ========================================================================== */

app.post('/staff/login', async (c) => {
  const body = await readJson(c)
  const username = String(body.username ?? '').trim().toLowerCase()
  if (!username) return c.json({ error: 'اسم المستخدم مطلوب' }, 400)

  const wait = throttled(`staff:${username}`)
  if (wait) return c.json({ error: `محاولات كثيرة. حاول بعد ${wait} ثانية` }, 429)

  const staff = await prisma.staffUser.findUnique({ where: { username } })
  if (!staff || !staff.active || !(await verifyPin(body.pin, staff.pinHash))) {
    noteFailure(`staff:${username}`)
    return c.json({ error: 'اسم المستخدم أو الرمز السري غير صحيح' }, 401)
  }
  clearFailures(`staff:${username}`)
  await prisma.staffUser.update({ where: { id: staff.id }, data: { lastLogin: new Date() } })

  const token = await createSession('staff', staff.id)
  return c.json({ token, staff: publicStaff(staff) })
})

app.post('/staff/logout', async (c) => {
  const token = bearer(c)
  if (token) await prisma.loyaltySession.deleteMany({ where: { token } })
  return c.json({ ok: true })
})

app.get('/staff/me', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة. الرجاء تسجيل الدخول مرة أخرى' }, 401)
  return c.json({ staff: publicStaff(staff) })
})

/** Headline numbers for the dashboard home. */
app.get('/staff/overview', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [customers, pointsAgg, pending, todayTx, recentRedemptions, recentCustomers] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.aggregate({ _sum: { pointsBalance: true, lifetimePoints: true } }),
    prisma.redemption.count({ where: { status: 'pending' } }),
    prisma.pointsTransaction.findMany({ where: { createdAt: { gte: startOfDay } } }),
    prisma.redemption.findMany({
      where: { status: { not: 'pending' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
  ])

  const earnedToday = todayTx.filter((t) => t.points > 0).reduce((a, t) => a + t.points, 0)
  const redeemedToday = todayTx.filter((t) => t.points < 0).reduce((a, t) => a + Math.abs(t.points), 0)

  return c.json({
    stats: {
      customers,
      outstandingPoints: pointsAgg._sum.pointsBalance ?? 0,
      lifetimePoints: pointsAgg._sum.lifetimePoints ?? 0,
      pendingRedemptions: pending,
      earnedToday,
      redeemedToday,
      transactionsToday: todayTx.length,
    },
    recentRedemptions,
    recentCustomers: recentCustomers.map((r) => ({
      id: r.id,
      phone: r.phone,
      name: r.name,
      pointsBalance: r.pointsBalance,
      createdAt: r.createdAt,
    })),
  })
})

/** Search guests by phone (or name). Used at the counter. */
app.get('/staff/customers', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const q = (c.req.query('q') ?? '').trim()
  const settings = await getSettings()
  const where = q
    ? {
        OR: [
          { phone: { contains: q.replace(/[^\d]/g, '') || q } },
          { name: { contains: q } },
        ],
      }
    : {}

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 40,
  })

  return c.json({
    customers: customers.map((cust) => ({
      ...publicCustomer(cust, settings),
      updatedAt: cust.updatedAt,
    })),
  })
})

/** Full guest file: balance, ledger, redemption history. */
app.get('/staff/customers/:id', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const customer = await prisma.customer.findUnique({
    where: { id: c.req.param('id') },
    include: {
      transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      redemptions: { orderBy: { createdAt: 'desc' }, take: 25 },
    },
  })
  if (!customer) return c.json({ error: 'العميل غير موجود' }, 404)

  const settings = await getSettings()
  return c.json({
    customer: {
      ...publicCustomer(customer, settings),
      notes: customer.notes,
    },
    transactions: customer.transactions,
    redemptions: customer.redemptions,
  })
})

/** Create a guest from the counter (no PIN set yet — they use "set PIN" on the site). */
app.post('/staff/customers', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const body = await readJson(c)
  const phone = normalizePhone(body.phone)
  if (!phone) return c.json({ error: 'رقم الجوال غير صحيح' }, 400)
  if (await prisma.customer.findUnique({ where: { phone } })) {
    return c.json({ error: 'هذا الرقم مسجل بالفعل' }, 409)
  }

  const settings = await getSettings()
  const tempPin = String(1000 + randomIndex(9000))
  const customer = await prisma.customer.create({
    data: {
      phone,
      name: typeof body.name === 'string' ? body.name.trim().slice(0, 60) || null : null,
      pinHash: await hashPin(tempPin),
      pointsBalance: settings.welcomeBonus,
      lifetimePoints: settings.welcomeBonus,
    },
  })
  return c.json({ customer: publicCustomer(customer, settings), tempPin })
})

/**
 * Add or deduct points.
 * Body: { points: number } XOR { amountSar: number }, optional `reason`.
 * A positive `amountSar` awards `amountSar * pointsPerSar` and counts a visit.
 */
app.post('/staff/customers/:id/points', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const body = await readJson(c)
  const settings = await getSettings()

  let points: number
  let type = 'adjust'
  let reason: string = String(body.reason ?? '').slice(0, 120)

  if (body.amountSar !== undefined && body.amountSar !== null && body.amountSar !== '') {
    const amount = Number(body.amountSar)
    if (!Number.isFinite(amount) || amount === 0) return c.json({ error: 'المبلغ غير صحيح' }, 400)
    points = Math.round(amount * settings.pointsPerSar)
    type = amount > 0 ? 'earn' : 'adjust'
    reason = reason || (amount > 0 ? `فاتورة ${amount} ريال` : `تصحيح ${amount} ريال`)
  } else {
    const raw = Number(body.points)
    if (!Number.isFinite(raw) || raw === 0) return c.json({ error: 'عدد النقاط غير صحيح' }, 400)
    points = Math.round(raw)
    type = points > 0 ? 'earn' : 'adjust'
    reason = reason || (points > 0 ? 'إضافة يدوية' : 'خصم يدوي')
  }

  const target = await prisma.customer.findUnique({ where: { id: c.req.param('id') } })
  if (!target) return c.json({ error: 'العميل غير موجود' }, 404)

  if (points < 0 && target.pointsBalance + points < 0) {
    return c.json({ error: 'الخصم أكبر من رصيد النقاط الحالي' }, 400)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.customer.update({
      where: { id: target.id },
      data: {
        pointsBalance: { increment: points },
        lifetimePoints: points > 0 ? { increment: points } : undefined,
        visits: type === 'earn' ? { increment: 1 } : undefined,
      },
    })
    await tx.pointsTransaction.create({
      data: {
        customerId: target.id,
        points,
        type,
        reason,
        staffName: staff.name,
        balanceAfter: next.pointsBalance,
      },
    })
    return next
  })

  return c.json({ ok: true, customer: publicCustomer(updated, settings) })
})

async function listRedemptions(status?: string) {
  const where = status && status !== 'all' ? { status } : {}
  return prisma.redemption.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { customer: { select: { id: true, phone: true, name: true, pointsBalance: true } } },
  })
}

app.get('/staff/redemptions', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  const status = c.req.query('status') ?? 'pending'
  const [rows, pendingCount] = await Promise.all([
    listRedemptions(status),
    prisma.redemption.count({ where: { status: 'pending' } }),
  ])
  return c.json({ redemptions: rows, pendingCount })
})

/** Approve (guest gets the reward) or reject (points are refunded). */
app.post('/staff/redemptions/:id/decide', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const body = await readJson(c)
  const decision = String(body.decision ?? '')
  if (!['approve', 'reject'].includes(decision)) {
    return c.json({ error: 'القرار غير صحيح' }, 400)
  }

  const redemption = await prisma.redemption.findUnique({ where: { id: c.req.param('id') } })
  if (!redemption) return c.json({ error: 'الطلب غير موجود' }, 404)
  if (redemption.status !== 'pending') {
    return c.json({ error: `تم البت في هذا الطلب مسبقاً (${redemption.status})` }, 409)
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.redemption.update({
      where: { id: redemption.id },
      data: {
        status: decision === 'approve' ? 'approved' : 'rejected',
        staffName: staff.name,
        decidedAt: new Date(),
      },
    })
    if (decision === 'reject') {
      const cust = await tx.customer.update({
        where: { id: redemption.customerId },
        data: { pointsBalance: { increment: redemption.pointsCost } },
      })
      await tx.pointsTransaction.create({
        data: {
          customerId: redemption.customerId,
          points: redemption.pointsCost,
          type: 'refund',
          reason: `إرجاع نقاط: ${redemption.rewardTitle}`,
          staffName: staff.name,
          balanceAfter: cust.pointsBalance,
        },
      })
    }
    return updated
  })

  return c.json({ ok: true, redemption: result, message: decision === 'approve' ? 'تم تسليم المكافأة' : 'تم رفض الطلب وإرجاع النقاط' })
})

/* --------------------------- reward management ---------------------------- */

app.get('/staff/rewards', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  const rewards = await prisma.reward.findMany({ orderBy: { sortOrder: 'asc' } })
  return c.json({ rewards })
})

app.post('/staff/rewards', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const body = await readJson(c)
  const titleAr = String(body.titleAr ?? '').trim()
  const cost = Number(body.costPoints)
  if (!titleAr) return c.json({ error: 'الاسم العربي مطلوب' }, 400)
  if (!Number.isFinite(cost) || cost <= 0) return c.json({ error: 'تكلفة النقاط غير صحيحة' }, 400)

  const reward = await prisma.reward.create({
    data: {
      titleAr,
      titleEn: String(body.titleEn ?? '').trim() || titleAr,
      descAr: String(body.descAr ?? '').trim() || null,
      emoji: String(body.emoji ?? '🎁').slice(0, 4),
      costPoints: Math.round(cost),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 99,
      active: body.active === false ? false : true,
    },
  })
  return c.json({ ok: true, reward })
})

app.patch('/staff/rewards/:id', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const body = await readJson(c)
  const data: Record<string, any> = {}
  if (typeof body.titleAr === 'string' && body.titleAr.trim()) data.titleAr = body.titleAr.trim()
  if (typeof body.titleEn === 'string') data.titleEn = body.titleEn.trim() || data.titleAr
  if (typeof body.descAr === 'string') data.descAr = body.descAr.trim() || null
  if (typeof body.emoji === 'string') data.emoji = body.emoji.slice(0, 4)
  if (body.costPoints !== undefined && Number.isFinite(Number(body.costPoints))) {
    data.costPoints = Math.round(Number(body.costPoints))
  }
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder)
  }
  if (typeof body.active === 'boolean') data.active = body.active
  if (!Object.keys(data).length) return c.json({ error: 'لا يوجد تغيير' }, 400)

  try {
    const reward = await prisma.reward.update({ where: { id: c.req.param('id') }, data })
    return c.json({ ok: true, reward })
  } catch {
    return c.json({ error: 'المكافأة غير موجودة' }, 404)
  }
})

app.delete('/staff/rewards/:id', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  const used = await prisma.redemption.count({ where: { rewardId: c.req.param('id') } })
  if (used > 0) {
    // Keep history intact — deactivate instead of hard-deleting.
    const reward = await prisma.reward.update({
      where: { id: c.req.param('id') },
      data: { active: false },
    })
    return c.json({ ok: true, reward, message: 'تم إخفاء المكافأة (لها سجل سابق)' })
  }
  await prisma.reward.delete({ where: { id: c.req.param('id') } })
  return c.json({ ok: true })
})

/* ---------------------------- staff management ---------------------------- */

app.get('/staff/team', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  const team = await prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } })
  return c.json({ team: team.map((t) => ({ ...publicStaff(t), active: t.active, lastLogin: t.lastLogin })) })
})

app.post('/staff/team', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  if (staff.role !== 'admin') return c.json({ error: 'هذه الصلاحية للمدير فقط' }, 403)

  const body = await readJson(c)
  const username = String(body.username ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    return c.json({ error: 'اسم المستخدم: 3-20 حرف إنجليزي/رقم' }, 400)
  }
  if (!isPin(body.pin)) return c.json({ error: 'الرمز السري يجب أن يكون 4-6 أرقام' }, 400)
  if (await prisma.staffUser.findUnique({ where: { username } })) {
    return c.json({ error: 'اسم المستخدم محجوز' }, 409)
  }

  const created = await prisma.staffUser.create({
    data: {
      username,
      name: String(body.name ?? '').trim().slice(0, 60) || username,
      pinHash: await hashPin(body.pin),
      role: body.role === 'admin' ? 'admin' : 'staff',
    },
  })
  return c.json({ ok: true, staff: publicStaff(created) })
})

app.patch('/staff/team/:id', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)

  const id = c.req.param('id')
  const isSelf = id === staff.id
  if (!isSelf && staff.role !== 'admin') return c.json({ error: 'هذه الصلاحية للمدير فقط' }, 403)

  const body = await readJson(c)
  const data: Record<string, any> = {}
  if (isPin(body.pin)) data.pinHash = await hashPin(body.pin)
  if (staff.role === 'admin') {
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 60)
    if (typeof body.active === 'boolean') {
      if (id === staff.id && body.active === false) {
        return c.json({ error: 'لا يمكنك تعطيل حسابك الحالي' }, 400)
      }
      data.active = body.active
    }
    if (body.role === 'admin' || body.role === 'staff') data.role = body.role
  }
  if (!Object.keys(data).length) return c.json({ error: 'لا يوجد تغيير' }, 400)

  try {
    const updated = await prisma.staffUser.update({ where: { id }, data })
    if (data.pinHash || data.active === false) {
      // force re-login everywhere for this account
      await prisma.loyaltySession.deleteMany({ where: { role: 'staff', subjectId: id } })
    }
    return c.json({ ok: true, staff: publicStaff(updated) })
  } catch {
    return c.json({ error: 'المستخدم غير موجود' }, 404)
  }
})

/* ------------------------------ program settings --------------------------- */

app.get('/staff/settings', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  return c.json({ settings: await getSettings() })
})

app.patch('/staff/settings', async (c) => {
  const staff = await requireStaff(c)
  if (!staff) return c.json({ error: 'انتهت الجلسة' }, 401)
  if (staff.role !== 'admin') return c.json({ error: 'هذه الصلاحية للمدير فقط' }, 403)

  await getSettings()
  const body = await readJson(c)
  const data: Record<string, any> = {}
  for (const key of ['pointsPerSar', 'silverMin', 'goldMin', 'welcomeBonus'] as const) {
    if (body[key] !== undefined) {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n < 0) return c.json({ error: `قيمة غير صحيحة: ${key}` }, 400)
      data[key] = Math.round(n)
    }
  }
  if (!Object.keys(data).length) return c.json({ error: 'لا يوجد تغيير' }, 400)

  const settings = await prisma.loyaltySettings.update({ where: { id: 'default' }, data })
  return c.json({ ok: true, settings })
})

export default app
