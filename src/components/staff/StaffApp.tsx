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
import { setStaffLang, useStaffLang, type StaffLang } from '@/lib/staffI18n'
import CustomerDetail from './CustomerDetail'
import RedemptionsTab from './RedemptionsTab'
import RewardsTab from './RewardsTab'
import TeamTab from './TeamTab'

type Tab = 'home' | 'customers' | 'redemptions' | 'rewards' | 'team'

/* ---------------------------------------------------------- language switch */

function LangSwitch({ variant }: { variant: 'dark' | 'light' }) {
  const { lang } = useStaffLang()
  const options: { key: StaffLang; label: string }[] = [
    { key: 'ar', label: 'عربي' },
    { key: 'en', label: 'EN' },
  ]
  const dark = variant === 'dark'
  return (
    <div
      dir="ltr"
      className="flex items-center gap-1 rounded-full p-1"
      style={{ background: dark ? 'rgba(251,243,223,.16)' : 'rgba(30,68,48,.08)' }}
    >
      {options.map((o) => {
        const on = lang === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setStaffLang(o.key)}
            className="rounded-full px-2.5 py-1 text-xs font-bold"
            style={
              on
                ? { background: dark ? 'var(--cream)' : 'var(--basil)', color: dark ? 'var(--basil)' : 'var(--cream)' }
                : { color: dark ? 'var(--cream)' : 'var(--basil)' }
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function StaffApp() {
  const { t, dir } = useStaffLang()
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
      <div className="staff-shell flex items-center justify-center" dir={dir}>
        <div className="text-center text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
          <p className="mt-2 font-bold">{t('جاري التحقق من الجلسة…', 'Checking session…')}</p>
        </div>
      </div>
    )
  }

  if (!token || !staff) {
    return (
      <StaffLogin
        onAuthed={(tk, s) => {
          setStaffToken(tk)
          setToken(tk)
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
  const { t, dir } = useStaffLang()
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
    <div className="staff-shell" dir={dir}>
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-5 flex justify-center">
          <LangSwitch variant="light" />
        </div>

        <div className="text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'var(--basil)' }}
          >
            <ShieldCheck size={30} color="var(--cream)" />
          </div>
          <h1 className="mt-4 text-2xl font-black" style={{ color: 'var(--basil)' }}>
            {t('لوحة الموظفين', 'Staff Dashboard')}
          </h1>
          <p className="ib-hint">Italiano Bari</p>
        </div>

        <form className="staff-card mt-6" onSubmit={submit}>
          {error && <div className="ib-error">{error}</div>}

          <label className="ib-field">
            <span>{t('اسم المستخدم', 'Username')}</span>
            <Input
              dir="ltr"
              autoComplete="username"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="ib-field">
            <span>{t('الرمز السري', 'PIN')}</span>
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
            {busy ? t('جاري الدخول…', 'Signing in…') : t('دخول', 'Sign in')}
          </Button>

          <p className="ib-hint mt-3 text-center">
            {t(
              'هذا القسم خاص بالموظفين. العملاء يستخدمون الموقع الرئيسي.',
              'This area is for staff only. Customers use the main website.',
            )}
          </p>
        </form>

        <a
          href="#/"
          className="mt-5 text-center text-sm font-bold"
          style={{ color: 'var(--basil)' }}
        >
          {t('← الرجوع إلى القائمة', '← Back to menu')}
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
  const { t, dir } = useStaffLang()
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
    { key: 'home', label: t('الرئيسية', 'Home'), icon: <Home size={14} /> },
    { key: 'customers', label: t('العملاء', 'Customers'), icon: <Users size={14} /> },
    { key: 'redemptions', label: t('الاستبدال', 'Redemptions'), icon: <Gift size={14} />, count: pending },
    { key: 'rewards', label: t('المكافآت', 'Rewards'), icon: <Gift size={14} /> },
    { key: 'team', label: t('الإعدادات', 'Settings'), icon: <Settings2 size={14} /> },
  ]

  return (
    <div className="staff-shell" dir={dir}>
      <div className="staff-topbar">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <div>
              <div className="text-sm font-black leading-tight">
                {t('لوحة الموظفين — Italiano Bari', 'Staff Dashboard — Italiano Bari')}
              </div>
              <div className="text-[11px] opacity-80">
                {staff.name} • {staff.role === 'admin' ? t('مدير', 'Admin') : t('موظف', 'Staff')}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LangSwitch variant="dark" />
            <a
              href="#/"
              className="rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(251,243,223,.16)', color: 'var(--cream)' }}
            >
              {t('القائمة', 'Menu')}
            </a>
            <Button size="sm" variant="secondary" onClick={onSignOut}>
              <LogOut size={14} /> {t('خروج', 'Sign out')}
            </Button>
          </div>
        </div>
      </div>

      <div className="staff-tabs">
        <div className="mx-auto flex gap-2" style={{ maxWidth: 1100 }}>
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className={tab === tb.key ? 'on' : ''}
              onClick={() => {
                setTab(tb.key)
                if (tb.key === 'customers') setCustomerId(null)
              }}
            >
              {tb.icon} {tb.label}
              {Boolean(tb.count) && <span className="pill-count">{tb.count}</span>}
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
  const { t } = useStaffLang()
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
          {t('نظرة عامة', 'Overview')}
        </h2>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw size={14} /> {t('تحديث', 'Refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi k={t('إجمالي العملاء', 'Total customers')} v={s?.customers ?? 0} />
        <Kpi k={t('نقاط قيد الاستخدام', 'Outstanding points')} v={s?.outstandingPoints ?? 0} />
        <Kpi k={t('طلبات بانتظار الموافقة', 'Pending requests')} v={s?.pendingRedemptions ?? 0} accent="#c33c2e" />
        <Kpi k={t('نقاط ممنوحة اليوم', 'Points earned today')} v={s?.earnedToday ?? 0} accent="#2e6b47" />
        <Kpi k={t('نقاط مستبدلة اليوم', 'Points redeemed today')} v={s?.redeemedToday ?? 0} />
        <Kpi k={t('حركات اليوم', 'Transactions today')} v={s?.transactionsToday ?? 0} />
        <Kpi k={t('نقاط العضوية الكلية', 'Lifetime points')} v={s?.lifetimePoints ?? 0} />
      </div>

      {data && data.recentRedemptions.length > 0 && (
        <div className="staff-card">
          <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
            {t('آخر الاستبدالات', 'Recent redemptions')}
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
                {r.status === 'approved' ? t('تم التسليم', 'Delivered') : t('مرفوض', 'Rejected')}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && data.recentCustomers.length > 0 && (
        <div className="staff-card">
          <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
            {t('أحدث العملاء', 'Newest customers')}
          </div>
          <div className="space-y-2">
            {data.recentCustomers.map((c) => (
              <button key={c.id} className="staff-row" onClick={() => onOpenCustomer(c.id)} type="button">
                <span className="staff-avatar">{(c.name || c.phone).slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold">{c.name || t('بدون اسم', 'No name')}</span>
                  <span dir="ltr" className="block text-left text-xs font-bold text-[var(--grey)]">
                    {c.phone}
                  </span>
                </span>
                <span className="text-sm font-black" style={{ color: 'var(--basil)' }}>
                  {c.pointsBalance} {t('نقطة', 'points')}
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
  const { t } = useStaffLang()
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
          <Search size={17} /> {t('ابحث عن عميل', 'Find a customer')}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            dir="ltr"
            inputMode="tel"
            placeholder={t('05XXXXXXXX أو الاسم', '05XXXXXXXX or name')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[180px] text-left"
          />
          <Button variant="outline" onClick={() => setShowAdd((v) => !v)}>
            {t('+ عميل جديد', '+ New customer')}
          </Button>
        </div>

        {showAdd && (
          <div className="mt-4 grid gap-3 border-t border-[rgba(30,68,48,.12)] pt-4 sm:grid-cols-2">
            <label className="ib-field mb-0">
              <span>{t('رقم الجوال', 'Mobile number')}</span>
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
              <span>{t('الاسم', 'Name')}</span>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <Button disabled={busy || !newPhone} onClick={createCustomer}>
                {t('إنشاء الحساب', 'Create account')}
              </Button>
            </div>
          </div>
        )}

        {created && (
          <div className="ib-pending mt-3">
            {t('تم إنشاء الحساب لـ', 'Account created for')} <span dir="ltr">{created.phone}</span> —{' '}
            {t('الرمز المؤقت:', 'temporary PIN:')} <b dir="ltr">{created.pin}</b>
            <div className="ib-hint mt-1">
              {t(
                'أعطِ العميل هذا الرمز. يمكنه تسجيل الدخول به من موقع القائمة وتغييره لاحقاً.',
                'Give the customer this PIN. They can sign in with it on the menu website and change it later.',
              )}
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
          {q ? t('لا نتائج مطابقة', 'No matching results') : t('لا يوجد عملاء بعد', 'No customers yet')}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <button key={c.id} className="staff-row" onClick={() => onOpenCustomer(c.id)} type="button">
              <span className="staff-avatar">{(c.name || c.phone).slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{c.name || t('بدون اسم', 'No name')}</span>
                <span dir="ltr" className="flex items-center gap-1 text-left text-xs font-bold text-[var(--grey)]">
                  <Phone size={11} /> {c.phone}
                </span>
              </span>
              <span className={`staff-badge ${c.tier}`}>{t(c.tierLabel.ar, c.tierLabel.en)}</span>
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
