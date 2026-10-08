// SPDX-License-Identifier: Apache-2.0
/**
 * Typed client for the loyalty + staff API.
 *
 * Sessions are opaque bearer tokens issued by `/api/loyalty/login` and
 * `/api/staff/login`. Guest and staff tokens live under separate keys so a
 * cashier can be signed in on the dashboard and on the menu at the same time.
 */

const CUSTOMER_TOKEN_KEY = 'ib_customer_token'
const STAFF_TOKEN_KEY = 'ib_staff_token'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setCustomerToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
    else localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    /* private mode — the session simply won't persist */
  }
}

export function getStaffToken(): string | null {
  try {
    return sessionStorage.getItem(STAFF_TOKEN_KEY) ?? localStorage.getItem(STAFF_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStaffToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(STAFF_TOKEN_KEY, token)
    else {
      sessionStorage.removeItem(STAFF_TOKEN_KEY)
      localStorage.removeItem(STAFF_TOKEN_KEY)
    }
  } catch {
    /* ignore */
  }
}

/** A usable server message: plain text, no markup from a host's HTML error page. */
function isPlainMessage(value: string): boolean {
  const text = value.trim()
  if (!text || text.length > 160) return false
  if (/[<>]|<!doctype|not[_ ]?found/i.test(text)) return false
  return true
}

/** Pull the server's own message out of an error body so the UI can show it. */
function errorMessage(body: unknown, status: number): string {
  const err = (body as { error?: unknown })?.error
  if (typeof err === 'string' && isPlainMessage(err)) return err
  if (err && typeof err === 'object') {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string' && isPlainMessage(msg)) return msg
  }
  // 404 on /api/* means the static host served the frontend without the
  // backend mounted — say so instead of leaking the host's HTML 404 page.
  if (status === 404) {
    return 'خدمة الحسابات غير متوفرة على هذا النطاق (404). تأكّد من تشغيل الواجهة الخلفية.'
  }
  return `خطأ في الاتصال بالخادم (${status})`
}

/**
 * Carry the session token in the query string as well as the Authorization
 * header.
 *
 * Some edge proxies between the public site and the API drop `Authorization`
 * (and any custom auth header) before the request reaches the server — the same
 * call then returns 401 through the public URL while working perfectly from
 * inside the runtime, which silently logs every guest out. Query parameters are
 * forwarded everywhere, so the token is sent both ways; the server accepts
 * either. These URLs come from `fetch()`, so the token never lands in the
 * address bar or the browser history.
 */
function withToken(path: string, token?: string | null): string {
  if (!token) return path
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

/**
 * Absolute API base, for split deployments (frontend on Vercel/Netlify, the
 * Hono server on a Node host). Leave it unset in the single-service setup,
 * where the server serves the SPA and `/api` from the same origin.
 */
const API_BASE = String((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')

async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api${withToken(path, token)}`, {
      method,
      cache: 'no-store',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}`, 'x-loyalty-token': token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم. تحقّق من الإنترنت وحاول مرة أخرى', 0)
  }

  const text = await res.text()
  let parsed: unknown = {}
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { error: text.slice(0, 200) }
    }
  }

  if (!res.ok) throw new ApiError(errorMessage(parsed, res.status), res.status)
  return parsed as T
}

/* ----------------------------------------------------------------- types */

export type Tier = 'bronze' | 'silver' | 'gold'

export interface CustomerView {
  id: string
  phone: string
  name: string | null
  pointsBalance: number
  lifetimePoints: number
  visits: number
  memberSince: string
  tier: Tier
  tierLabel: { ar: string; en: string; emoji: string }
  progress: {
    tier: Tier
    next: Tier | null
    current: number
    target: number
    remaining: number
    percent: number
  }
}

export interface SettingsView {
  pointsPerSar: number
  silverMin: number
  goldMin: number
  welcomeBonus: number
}

export interface RewardView {
  id: string
  titleAr: string
  titleEn: string
  descAr: string | null
  emoji: string
  costPoints: number
  affordable?: boolean
  active?: boolean
  sortOrder?: number
}

export interface LedgerRow {
  id: string
  points: number
  type: string
  reason: string | null
  staffName: string | null
  balanceAfter: number
  createdAt: string
}

export interface RedemptionView {
  id: string
  code: string
  rewardTitle: string
  pointsCost: number
  status: 'pending' | 'approved' | 'rejected' | string
  staffName: string | null
  decidedAt: string | null
  createdAt: string
  customerId?: string
  customer?: { id: string; phone: string; name: string | null; pointsBalance: number }
}

export interface GuestPayload {
  customer: CustomerView
  settings: SettingsView
  rewards: RewardView[]
  redemptions: RedemptionView[]
  transactions: LedgerRow[]
}

export interface StaffView {
  id: string
  username: string
  name: string
  role: 'admin' | 'staff'
  active?: boolean
  lastLogin?: string | null
}

export interface StaffOverview {
  stats: {
    customers: number
    outstandingPoints: number
    lifetimePoints: number
    pendingRedemptions: number
    earnedToday: number
    redeemedToday: number
    transactionsToday: number
  }
  recentRedemptions: RedemptionView[]
  recentCustomers: { id: string; phone: string; name: string | null; pointsBalance: number; createdAt: string }[]
}

/* ------------------------------------------------------------ guest calls */

export const loyalty = {
  register: (data: { phone: string; name?: string; pin: string }) =>
    request<{ token: string; customer: CustomerView; settings: SettingsView }>('/loyalty/register', {
      method: 'POST',
      body: data,
    }),

  login: (data: { phone: string; pin: string }) =>
    request<{ token: string; customer: CustomerView; settings: SettingsView }>('/loyalty/login', {
      method: 'POST',
      body: data,
    }),

  logout: (token: string) => request<{ ok: true }>('/loyalty/logout', { method: 'POST', token }),

  me: (token: string) => request<GuestPayload>('/loyalty/me', { token }),

  redeem: (token: string, rewardId: string) =>
    request<{ ok: true; redemption: RedemptionView; pointsBalance: number; message: string }>(
      '/loyalty/redeem',
      { method: 'POST', token, body: { rewardId } },
    ),

  updateProfile: (token: string, data: { name?: string; pin?: string }) =>
    request<{ ok: true; customer: CustomerView }>('/loyalty/profile', {
      method: 'PATCH',
      token,
      body: data,
    }),
}

/* ------------------------------------------------------------ staff calls */

export const staffApi = {
  login: (data: { username: string; pin: string }) =>
    request<{ token: string; staff: StaffView }>('/staff/login', { method: 'POST', body: data }),

  logout: (token: string) => request<{ ok: true }>('/staff/logout', { method: 'POST', token }),

  me: (token: string) => request<{ staff: StaffView }>('/staff/me', { token }),

  overview: (token: string) => request<StaffOverview>('/staff/overview', { token }),

  searchCustomers: (token: string, q: string) =>
    request<{ customers: CustomerView[] }>(`/staff/customers?q=${encodeURIComponent(q)}`, { token }),

  customer: (token: string, id: string) =>
    request<{ customer: CustomerView & { notes: string | null }; transactions: LedgerRow[]; redemptions: RedemptionView[] }>(
      `/staff/customers/${id}`,
      { token },
    ),

  createCustomer: (token: string, data: { phone: string; name?: string }) =>
    request<{ customer: CustomerView; tempPin: string }>('/staff/customers', {
      method: 'POST',
      token,
      body: data,
    }),

  addPoints: (
    token: string,
    id: string,
    data: { points?: number; amountSar?: number; reason?: string },
  ) =>
    request<{ ok: true; customer: CustomerView }>(`/staff/customers/${id}/points`, {
      method: 'POST',
      token,
      body: data,
    }),

  redemptions: (token: string, status = 'pending') =>
    request<{ redemptions: RedemptionView[]; pendingCount: number }>(
      `/staff/redemptions?status=${status}`,
      { token },
    ),

  decide: (token: string, id: string, decision: 'approve' | 'reject') =>
    request<{ ok: true; redemption: RedemptionView; message: string }>(
      `/staff/redemptions/${id}/decide`,
      { method: 'POST', token, body: { decision } },
    ),

  rewards: (token: string) => request<{ rewards: RewardView[] }>('/staff/rewards', { token }),

  createReward: (token: string, data: Partial<RewardView>) =>
    request<{ ok: true; reward: RewardView }>('/staff/rewards', { method: 'POST', token, body: data }),

  updateReward: (token: string, id: string, data: Partial<RewardView>) =>
    request<{ ok: true; reward: RewardView }>(`/staff/rewards/${id}`, {
      method: 'PATCH',
      token,
      body: data,
    }),

  deleteReward: (token: string, id: string) =>
    request<{ ok: true }>(`/staff/rewards/${id}`, { method: 'DELETE', token }),

  team: (token: string) => request<{ team: StaffView[] }>('/staff/team', { token }),

  createStaff: (token: string, data: { username: string; name: string; pin: string; role?: string }) =>
    request<{ ok: true; staff: StaffView }>('/staff/team', { method: 'POST', token, body: data }),

  updateStaff: (token: string, id: string, data: { name?: string; pin?: string; active?: boolean; role?: string }) =>
    request<{ ok: true; staff: StaffView }>(`/staff/team/${id}`, { method: 'PATCH', token, body: data }),

  settings: (token: string) =>
    request<{ settings: SettingsView & { id: string } }>('/staff/settings', { token }),

  updateSettings: (token: string, data: Partial<SettingsView>) =>
    request<{ ok: true; settings: SettingsView }>('/staff/settings', {
      method: 'PATCH',
      token,
      body: data,
    }),
}

/* --------------------------------------------------------------- helpers */

/** Saudi-friendly: 05XXXXXXXX -> 9665XXXXXXXX (for display / tel: links). */
export function toInternational(phone: string): string {
  if (phone.startsWith('05')) return `966${phone.slice(1)}`
  return phone
}

export function formatPoints(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }) +
    ' • ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export const LEDGER_LABEL: Record<string, string> = {
  welcome: 'مكافأة ترحيبية',
  earn: 'نقاط مكتسبة',
  adjust: 'تعديل يدوي',
  redeem: 'استبدال مكافأة',
  refund: 'إرجاع نقاط',
}

export const LEDGER_LABEL_EN: Record<string, string> = {
  welcome: 'Welcome bonus',
  earn: 'Points earned',
  adjust: 'Manual adjustment',
  redeem: 'Reward redeemed',
  refund: 'Points refunded',
}
