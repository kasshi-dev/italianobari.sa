// SPDX-License-Identifier: Apache-2.0
/**
 * Seeds the Italiano Bari loyalty program.
 *
 * Idempotent — safe to run any time, and self-healing: any account still
 * holding a PIN hash in an older format is re-hashed from its known seed PIN,
 * so this script doubles as the migration.
 *
 *   bun run scripts/seed-loyalty.ts
 */
import { prisma } from '../src/lib/db'

/* Same PBKDF2 scheme the API uses (see custom-routes.ts). */
const PIN_ITERATIONS = 120_000
const PIN_PREFIX = 'pbkdf2'
const textEncoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `${PIN_PREFIX}$${PIN_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`
}

const isCurrentHash = (h: string | null | undefined) => !!h && h.startsWith(`${PIN_PREFIX}$`)

const REWARDS = [
  { titleAr: 'خبز بالثوم', titleEn: 'Garlic Bread', emoji: '🥖', costPoints: 60, sortOrder: 1 },
  { titleAr: 'مشروب مجاني', titleEn: 'Free Drink', emoji: '🥤', costPoints: 80, sortOrder: 2 },
  { titleAr: 'سلطة مجانية', titleEn: 'Free Salad', emoji: '🥗', costPoints: 200, sortOrder: 3 },
  { titleAr: 'خصم ١٥ ريال', titleEn: 'SR 15 Off', emoji: '💸', costPoints: 150, sortOrder: 4 },
  { titleAr: 'بيتزا صغيرة مجانية', titleEn: 'Free Small Pizza', emoji: '🍕', costPoints: 400, sortOrder: 5 },
  { titleAr: 'خصم ٥٠ ريال', titleEn: 'SR 50 Off', emoji: '🎁', costPoints: 500, sortOrder: 6 },
]

// Change these before going live, from الإعدادات → حسابات الموظفين.
const STAFF = [
  { username: 'admin', name: 'المدير / Manager', pin: '4172', role: 'admin' },
  { username: 'cashier', name: 'الكاشير / Cashier', pin: '8365', role: 'staff' },
]

const DEMO_GUESTS = [
  { phone: '0501234567', name: 'أحمد', pin: '1111' },
  { phone: '0559876543', name: 'سارة', pin: '2222' },
  { phone: '0533445566', name: 'محمد باري', pin: '3333' },
]

async function main() {
  const settings = await prisma.loyaltySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', welcomeBonus: 100 },
  })
  console.log('✓ settings', {
    pointsPerSar: settings.pointsPerSar,
    silverMin: settings.silverMin,
    goldMin: settings.goldMin,
    welcomeBonus: settings.welcomeBonus,
  })

  let created = 0
  for (const r of REWARDS) {
    if (!(await prisma.reward.findFirst({ where: { titleAr: r.titleAr } }))) {
      await prisma.reward.create({ data: r })
      created++
    }
  }
  console.log(`✓ rewards (${created} created, ${await prisma.reward.count()} total)`)

  for (const s of STAFF) {
    const existing = await prisma.staffUser.findUnique({ where: { username: s.username } })
    if (!existing) {
      await prisma.staffUser.create({
        data: { username: s.username, name: s.name, role: s.role, pinHash: await hashPin(s.pin) },
      })
      console.log(`✓ staff ${s.username} / PIN ${s.pin}`)
    } else if (!isCurrentHash(existing.pinHash)) {
      await prisma.staffUser.update({ where: { id: existing.id }, data: { pinHash: await hashPin(s.pin) } })
      console.log(`↻ staff ${s.username} PIN re-hashed to the current format (${s.pin})`)
    } else {
      console.log(`· staff ${s.username} already up to date — PIN untouched`)
    }
  }

  for (const g of DEMO_GUESTS) {
    const existing = await prisma.customer.findUnique({ where: { phone: g.phone } })
    if (!existing) {
      const points = 120 + (Math.floor(Date.now() / 1000) % 380)
      await prisma.customer.create({
        data: {
          phone: g.phone,
          name: g.name,
          pinHash: await hashPin(g.pin),
          pointsBalance: points,
          lifetimePoints: points,
          visits: 2,
          transactions: {
            create: { points, type: 'earn', reason: 'فاتورة افتتاحية', balanceAfter: points },
          },
        },
      })
      console.log(`✓ guest ${g.phone} (PIN ${g.pin}) with ${points} points`)
    } else if (!isCurrentHash(existing.pinHash)) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { pinHash: await hashPin(g.pin) },
      })
      console.log(`↻ guest ${g.phone} PIN re-hashed to the current format (${g.pin})`)
    }
  }

  console.log('done', {
    rewards: await prisma.reward.count(),
    staff: await prisma.staffUser.count(),
    customers: await prisma.customer.count(),
  })
}

await main().catch((e) => {
  console.error(e)
  throw e
})
await prisma.$disconnect()
