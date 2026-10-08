// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Gift,
  Home,
  Loader2,
  LogOut,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  formatDate,
  getStaffToken,
  setStaffToken,
  staffApi,
  type CustomerView,
  type StaffOverview,
  type StaffView,
} from '@/lib/loyalty'
import CustomerDetail from './CustomerDetail'
import RedemptionsTab from './RedemptionsTab'
import RewardsTab from './RewardsTab'
import TeamTab from './TeamTab'

type Tab = 'home' | 'customers' | 'redemptions' | 'rewards' | 'team'

export default function StaffApp() {
  const [token, setToken] = useState<string | null>(() => getStaffToken())
  const [staff, setStaff] = useState<StaffView | null>(null)
  const [checking, setChecking] = useState(Boolean(getStaffToken()))

  // restore an existing dashboard session
  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }
    let alive = true
    staffApi
      .me(token)
      .then((res) => {
        if (alive) setStaff(res.staff)
      })
      .catch(() => {
        if (alive) {
          setStaffToken(null)
          setToken(null)
        }
      })
      .finally(() => {
        if (alive) setChecking(false)
      })
    return () => {
      alive = false
    }
  }, [token])

  const signOut = async () => {
    if (token) await staffApi.logout(token).catch(() => {})
    setStaffToken(null)
    setToken(null)
    setStaff(null)
  }

  if (checking) {
    return (
      <div className="staff-shell flex items-center justify-center">
        <div className="text-center text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
          <p className="mt-2 font-bold">جاري التحقق من الجلسة…</p>
        </div>
      </div>
    )
  }

  if (!token || !staff) {
    return (
      <StaffLogin
        onAuthed={(t, s) => {
          setStaffToken(t)
          setToken(t)
          setStaff(s)
        }}
      />
    )
  }

  return (
    <Shell
      token={token}
      staff={staff}
      onSignOut={signOut}
      onAuthLost={() => {
        setStaffToken(null)
        setToken(null)
        setStaff(null)
      }}
    />
  )
}

/* ------------------------------------------------------------------ login */

function StaffLogin({ onAuthed }: { onAuthed: (token: string, staff: StaffView) => void }) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await staffApi.login({ username: username.trim().toLowerCase(), pin })
      onAuthed(res.token, res.staff)
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="staff-shell">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-10">
        <div className="text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'var(--basil)' }}
          >
            <ShieldCheck size={30} color="var(--cream)" />
          </div>
          <h1 className="mt-4 text-2xl font-black" style={{ color: 'var(--basil)' }}>
            لوحة الموظفين
          </h1>
          <p className="ib-hint">Italiano Bari — Staff Dashboard</p>
        </div>

        <form className="staff-card mt-6" onSubmit={submit}>
          {error && <div className="ib-error">{error}</div>}

          <label className="ib-field">
            <span>اسم المستخدم</span>
            <Input
              dir="ltr"
              autoComplete="username"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="ib-field">
            <span>الرمز السري</span>
            <Input
              dir="ltr"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </label>

          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="ib-spin" /> : null}
            {busy ? 'جاري الدخول…' : 'دخول'}
          </Button>

          <p className="ib-hint mt-3 text-center">
            هذا القسم خاص بالموظفين. العملاء يستخدمون الموقع الرئيسي.
          </p>
        </form>

        <a
          href="#/"
          className="mt-5 text-center text-sm font-bold"
          style={{ color: 'var(--basil)' }}
        >
          ← الرجوع إلى القائمة
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ shell */

function Shell({
  token,
  staff,
  onSignOut,
  onAuthLost,
}: {
  token: string
  staff: StaffView
  onSignOut: () => void
  onAuthLost: () => void
}) {
  const [tab, setTab] = useState<Tab>('home')
  const [pending, setPending] = useState(0)
  const [customerId, setCustomerId] = useState<string | null>(null)

  const refreshPending = useCallback(
    async (): Promise<number> => {
      try {
        const res = await staffApi.redemptions(token, 'pending')
        setPending(res.pendingCount)
        return res.pendingCount
      } catch {
        return 0
      }
    },
    [token],
  )

  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  const openCustomer = (id: string) => {
    setCustomerId(id)
    setTab('customers')
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'home', label: 'الرئيسية', icon: <Home size={14} /> },
    { key: 'customers', label: 'العملاء', icon: <Users size={14} /> },
    { key: 'redemptions', label: 'الاستبدال', icon: <Gift size={14} />, count: pending },
    { key: 'rewards', label: 'المكافآت', icon: <Gift size={14} /> },
    { key: 'team', label: 'الإعدادات', icon: <Settings2 size={14} /> },
  ]

  return (
    <div className="staff-shell">
      <div className="staff-topbar">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <div>
              <div className="text-sm font-black leading-tight">لوحة الموظفين — Italiano Bari</div>
              <div className="text-[11px] opacity-80">
                {staff.name} • {staff.role === 'admin' ? 'مدير' : 'موظف'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#/"
              className="rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(251,243,223,.16)', color: 'var(--cream)' }}
            >
              القائمة
            </a>
            <Button size="sm" variant="secondary" onClick={onSignOut}>
              <LogOut size={14} /> خروج
            </Button>
          </div>
        </div>
      </div>

      <div className="staff-tabs">
        <div className="mx-auto flex gap-2" style={{ maxWidth: 1100 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'on' : ''}
              onClick={() => {
                setTab(t.key)
                if (t.key === 'customers') setCustomerId(null)
              }}
            >
              {t.icon} {t.label}
              {Boolean(t.count) && <span className="pill-count">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        {tab === 'home' && (
          <HomeTab token={token} onAuthLost={onAuthLost} onOpenCustomer={openCustomer} onPending={setPending} />
        )}

        {tab === 'customers' &&
          (customerId ? (
            <CustomerDetail
              token={token}
              customerId={customerId}
              onBack={() => setCustomerId(null)}
              onChanged={() => void refreshPending()}
              onAuthLost={onAuthLost}
            />
          ) : (
            <CustomersTab token={token} onAuthLost={onAuthLost} onOpenCustomer={setCustomerId} />
          ))}

        {tab === 'redemptions' && (
          <RedemptionsTab
            token={token}
            onAuthLost={onAuthLost}
            onCountChange={setPending}
            onOpenCustomer={openCustomer}
          />
        )}

        {tab === 'rewards' && <RewardsTab token={token} onAuthLost={onAuthLost} />}

        {tab === 'team' && <TeamTab token={token} me={staff} onAuthLost={onAuthLost} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- home */

function HomeTab({
  token,
  onAuthLost,
  onOpenCustomer,
  onPending,
}: {
  token: string
  onAuthLost: () => void
  onOpenCustomer: (id: string) => void
  onPending: (n: number) => void
}) {
  const [data, setData] = useState<StaffOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await staffApi.overview(token)
      setData(res)
      onPending(res.stats.pendingRedemptions)
      setError(null)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, onAuthLost, onPending])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="staff-card text-center py-10 text-[var(--grey)]">
        <Loader2 className="ib-spin mx-auto" />
      </div>
    )
  }

  const s = data?.stats

  return (
    <div className="space-y-4">
      {error && <div className="ib-error">{error}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black" style={{ color: 'var(--basil)' }}>
          نظرة عامة
        </h2>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw size={14} /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi k="إجمالي العملاء" v={s?.customers ?? 0} />
        <Kpi k="نقاط قيد الاستخدام" v={s?.outstandingPoints ?? 0} />
        <Kpi k="طلبات بانتظار الموافقة" v={s?.pendingRedemptions ?? 0} accent="#c33c2e" />
        <Kpi k="نقاط ممنوحة اليوم" v={s?.earnedToday ?? 0} accent="#2e6b47" />
        <Kpi k="نقاط مستبدلة اليوم" v={s?.redeemedToday ?? 0} />
        <Kpi k="حركات اليوم" v={s?.transactionsToday ?? 0} />
        <Kpi k="نقاط العضوية الكلية" v={s?.lifetimePoints ?? 0} />
      </div>

      {data && data.recentRedemptions.length > 0 && (
        <div className="staff-card">
          <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
            آخر الاستبدالات
          </div>
          {data.recentRedemptions.map((r) => (
            <div className="ib-ledger-row" key={r.id}>
              <div>
                <div className="font-extrabold">{r.rewardTitle}</div>
                <div className="when">
                  <span dir="ltr" style={{ fontFamily: 'monospace' }}>
                    {r.code}
                  </span>{' '}
                  • {formatDate(r.createdAt)}
                </div>
              </div>
              <span className={`staff-badge ${r.status}`}>
                {r.status === 'approved' ? 'تم التسليم' : 'مرفوض'}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && data.recentCustomers.length > 0 && (
        <div className="staff-card">
          <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
            أحدث العملاء
          </div>
          <div className="space-y-2">
            {data.recentCustomers.map((c) => (
              <button key={c.id} className="staff-row" onClick={() => onOpenCustomer(c.id)} type="button">
                <span className="staff-avatar">{(c.name || c.phone).slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold">{c.name || 'بدون اسم'}</span>
                  <span dir="ltr" className="block text-left text-xs font-bold text-[var(--grey)]">
                    {c.phone}
                  </span>
                </span>
                <span className="text-sm font-black" style={{ color: 'var(--basil)' }}>
                  {c.pointsBalance} نقطة
                </span>
                <ArrowUpRight size={16} style={{ color: 'var(--grey)' }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ k, v, accent }: { k: string; v: number; accent?: string }) {
  return (
    <div className="staff-kpi">
      <div className="k">{k}</div>
      <div className="v" style={accent ? { color: accent } : undefined}>
        {v.toLocaleString('en-US')}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- customers */

function CustomersTab({
  token,
  onAuthLost,
  onOpenCustomer,
}: {
  token: string
  onAuthLost: () => void
  onOpenCustomer: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CustomerView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [created, setCreated] = useState<{ phone: string; pin: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const search = useCallback(
    async (term: string) => {
      setLoading(true)
      try {
        const res = await staffApi.searchCustomers(token, term)
        setRows(res.customers)
        setError(null)
      } catch (e) {
        const err = e as ApiError
        if (err.status === 401) onAuthLost()
        else setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [token, onAuthLost],
  )

  useEffect(() => {
    const id = setTimeout(() => void search(q), 250)
    return () => clearTimeout(id)
  }, [q, search])

  const createCustomer = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await staffApi.createCustomer(token, { phone: newPhone, name: newName })
      setCreated({ phone: res.customer.phone, pin: res.tempPin })
      setNewPhone('')
      setNewName('')
      setShowAdd(false)
      await search(q)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="staff-card">
        <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
          <Search size={17} /> ابحث عن عميل
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            dir="ltr"
            inputMode="tel"
            placeholder="05XXXXXXXX أو الاسم"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[180px] text-left"
          />
          <Button variant="outline" onClick={() => setShowAdd((v) => !v)}>
            + عميل جديد
          </Button>
        </div>

        {showAdd && (
          <div className="mt-4 grid gap-3 border-t border-[rgba(30,68,48,.12)] pt-4 sm:grid-cols-2">
            <label className="ib-field mb-0">
              <span>رقم الجوال</span>
              <Input
                dir="ltr"
                inputMode="tel"
                placeholder="05XXXXXXXX"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="text-left"
              />
            </label>
            <label className="ib-field mb-0">
              <span>الاسم</span>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <Button disabled={busy || !newPhone} onClick={createCustomer}>
                إنشاء الحساب
              </Button>
            </div>
          </div>
        )}

        {created && (
          <div className="ib-pending mt-3">
            تم إنشاء الحساب لـ <span dir="ltr">{created.phone}</span> — الرمز المؤقت:{' '}
            <b dir="ltr">{created.pin}</b>
            <div className="ib-hint mt-1">
              أعطِ العميل هذا الرمز. يمكنه تسجيل الدخول به من موقع القائمة وتغييره لاحقاً.
            </div>
          </div>
        )}
      </div>

      {error && <div className="ib-error">{error}</div>}

      {loading ? (
        <div className="staff-card text-center py-10 text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
        </div>
      ) : rows.length === 0 ? (
        <div className="staff-card text-center py-8 font-bold text-[var(--grey)]">
          {q ? 'لا نتائج مطابقة' : 'لا يوجد عملاء بعد'}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <button key={c.id} className="staff-row" onClick={() => onOpenCustomer(c.id)} type="button">
              <span className="staff-avatar">{(c.name || c.phone).slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{c.name || 'بدون اسم'}</span>
                <span dir="ltr" className="flex items-center gap-1 text-left text-xs font-bold text-[var(--grey)]">
                  <Phone size={11} /> {c.phone}
                </span>
              </span>
              <span className={`staff-badge ${c.tier}`}>{c.tierLabel.ar}</span>
              <span className="text-sm font-black" style={{ color: 'var(--basil)' }}>
                {c.pointsBalance.toLocaleString('en-US')}
              </span>
              <ArrowUpRight size={16} style={{ color: 'var(--grey)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
