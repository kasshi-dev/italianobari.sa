// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react'
import { Loader2, LogOut, Gift, Receipt, Phone, UserRound, RefreshCw } from 'lucide-react'
import {
  ApiError,
  formatDate,
  LEDGER_LABEL,
  LEDGER_LABEL_EN,
  loyalty,
  type GuestPayload,
  type RedemptionView,
} from '@/lib/loyalty'
import { useI18n, type Lang } from '@/lib/i18n'
import type { Loyalty } from './useLoyalty'

interface Props {
  open: boolean
  onClose: () => void
  session: Loyalty
}

export default function LoyaltyPanel({ open, onClose, session }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const { pick, lang } = useI18n()

  useEffect(() => {
    if (open) {
      setError(null)
      setNotice(null)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^\d{4,6}$/.test(pin)) {
      setError(pick('الرمز السري يجب أن يكون من 4 إلى 6 أرقام', 'The PIN must be 4 to 6 digits'))
      return
    }
    setBusy(true)
    try {
      const res =
        mode === 'login'
          ? await loyalty.login({ phone, pin })
          : await loyalty.register({ phone, name, pin })
      session.acceptSession(res.token)
      setPin('')
      setNotice(
        mode === 'register'
          ? pick('مرحباً بك! تم إنشاء حساب المكافآت', 'Welcome! Your rewards account is ready')
          : null,
      )
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }

  const redeem = async (rewardId: string, title: string) => {
    if (!session.token) return
    setRedeeming(rewardId)
    setError(null)
    setNotice(null)
    try {
      const res = await loyalty.redeem(session.token, rewardId)
      setNotice(`${res.message} — ${title} (${res.redemption.code})`)
      await session.refresh()
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setRedeeming(null)
    }
  }

  return (
    <div className="ib-loy-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ib-loy-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ib-loy-head">
          <div>
            <h2>
              {session.isSignedIn
                ? pick('بطاقة الولاء', 'Loyalty Card')
                : pick('برنامج الولاء والمكافآت', 'Loyalty & Rewards Program')}
            </h2>
            <p>
              {session.isSignedIn
                ? pick('اجمع النقاط واستبدلها بمكافآت', 'Collect points and redeem them for rewards')
                : pick(
                    'سجّل برقم جوالك واجمع النقاط مع كل زيارة',
                    'Sign up with your mobile number and earn points on every visit',
                  )}
            </p>
          </div>
          <button
            className="ib-loy-close"
            onClick={onClose}
            aria-label={pick('إغلاق', 'Close')}
          >
            ×
          </button>
        </div>

        <div className="ib-loy-body">
          {notice && (
            <div
              className="ib-pending"
              style={{ background: 'rgba(46,107,71,.12)', borderColor: 'var(--basil-2)' }}
            >
              {notice}
            </div>
          )}
          {error && <div className="ib-error">{error}</div>}

          {session.token && !session.payload ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--grey)' }}>
              <Loader2 className="ib-spin" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: 10, fontWeight: 700 }}>{pick('جاري التحميل…', 'Loading…')}</p>
            </div>
          ) : session.token && session.payload ? (
            <SignedIn
              payload={session.payload}
              redeeming={redeeming}
              onRedeem={redeem}
              onSignOut={async () => {
                await session.signOut()
                setNotice(null)
              }}
              onRefresh={session.refresh}
            />
          ) : (
            <Auth
              mode={mode}
              setMode={setMode}
              phone={phone}
              setPhone={setPhone}
              name={name}
              setName={setName}
              pin={pin}
              setPin={setPin}
              busy={busy}
              onSubmit={submit}
              lang={lang}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ auth */

function Auth(props: {
  mode: 'login' | 'register'
  setMode: (m: 'login' | 'register') => void
  phone: string
  setPhone: (v: string) => void
  name: string
  setName: (v: string) => void
  pin: string
  setPin: (v: string) => void
  busy: boolean
  onSubmit: (e: React.FormEvent) => void
  lang: Lang
}) {
  const { mode, setMode } = props
  const { pick } = useI18n()
  return (
    <>
      <div className="ib-toggle">
        <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')} type="button">
          {pick('تسجيل الدخول', 'Sign in')}
        </button>
        <button
          className={mode === 'register' ? 'on' : ''}
          onClick={() => setMode('register')}
          type="button"
        >
          {pick('حساب جديد', 'New account')}
        </button>
      </div>

      <form onSubmit={props.onSubmit}>
        <label className="ib-field">
          <span>
            <Phone size={13} style={{ display: 'inline', marginInlineEnd: 5 }} />
            {pick('رقم الجوال', 'Mobile number')}
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XXXXXXXX"
            dir="ltr"
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            required
          />
        </label>

        {mode === 'register' && (
          <label className="ib-field">
            <span>
              <UserRound size={13} style={{ display: 'inline', marginInlineEnd: 5 }} />
              {pick('الاسم (اختياري)', 'Name (optional)')}
            </span>
            <input
              type="text"
              placeholder={pick('اسمك', 'Your name')}
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
            />
          </label>
        )}

        <label className="ib-field">
          <span>{pick('الرمز السري (4-6 أرقام)', 'PIN (4-6 digits)')}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••"
            dir="ltr"
            value={props.pin}
            onChange={(e) => props.setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </label>

        <button className="ib-btn" type="submit" disabled={props.busy}>
          {props.busy
            ? pick('جاري المعالجة…', 'Working…')
            : mode === 'login'
              ? pick('دخول', 'Sign in')
              : pick('إنشاء الحساب', 'Create account')}
        </button>
      </form>

      <p className="ib-hint" style={{ marginTop: 14, textAlign: 'center' }}>
        {pick(
          'كل ١ ريال = ١ نقطة. أعطِ رقم جوالك للكاشير عند الدفع لتُضاف نقاطك تلقائياً.',
          'Every 1 SAR = 1 point. Give your mobile number to the cashier when you pay and your points are added automatically.',
        )}
      </p>
    </>
  )
}

/* -------------------------------------------------------------- signed in */

function SignedIn({
  payload,
  redeeming,
  onRedeem,
  onSignOut,
  onRefresh,
}: {
  payload: GuestPayload
  redeeming: string | null
  onRedeem: (id: string, title: string) => void
  onSignOut: () => void
  onRefresh: () => void
}) {
  const { customer, rewards, redemptions, transactions, settings } = payload
  const pending = redemptions.filter((r) => r.status === 'pending')
  const { pick, lang } = useI18n()

  return (
    <>
      <div className="ib-card">
        <div className="ib-card-top">
          <div>
            <div className="ib-card-brand">Italiano Bari</div>
            <div className="ib-card-phone" dir="ltr">{customer.phone}</div>
          </div>
          <span className="ib-card-tier">
            {customer.tierLabel.emoji} {lang === 'ar' ? customer.tierLabel.ar : customer.tierLabel.en}
          </span>
        </div>

        <div className="ib-card-name">{customer.name || pick('عضو جديد', 'New member')}</div>

        <div className="ib-card-points">
          <b>{customer.pointsBalance.toLocaleString('en-US')}</b>
          <span>{pick('نقطة متاحة', 'points available')}</span>
        </div>

        <div className="ib-progress-track">
          <div className="ib-progress-fill" style={{ width: `${customer.progress.percent}%` }} />
        </div>
        <div className="ib-card-next">
          {customer.progress.next
            ? pick(
                `تبقّى ${customer.progress.remaining.toLocaleString('en-US')} نقطة للوصول إلى ${
                  customer.progress.next === 'gold' ? 'الذهبي 🥇' : 'الفضي 🥈'
                }`,
                `${customer.progress.remaining.toLocaleString('en-US')} points to reach ${
                  customer.progress.next === 'gold' ? 'Gold 🥇' : 'Silver 🥈'
                }`,
              )
            : pick('وصلت إلى أعلى مستوى — شكراً لك! 🥇', 'You have reached the top tier — thank you! 🥇')}
        </div>

        <div className="ib-card-code">
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {pick('أظهر هذا الرقم للكاشير', 'Show this number to the cashier')}
          </span>
          <span className="ib-code-val" dir="ltr">{customer.phone}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="ib-btn ghost" onClick={onRefresh} type="button">
          <RefreshCw size={14} style={{ display: 'inline', marginInlineEnd: 6 }} />
          {pick('تحديث', 'Refresh')}
        </button>
        <button className="ib-btn ghost" onClick={onSignOut} type="button">
          <LogOut size={14} style={{ display: 'inline', marginInlineEnd: 6 }} />
          {pick('خروج', 'Sign out')}
        </button>
      </div>

      {pending.length > 0 && (
        <>
          <div className="ib-loy-title">
            <Gift size={17} /> {pick('طلبات قيد الموافقة', 'Pending approvals')}
          </div>
          {pending.map((r) => (
            <div className="ib-pending" key={r.id}>
              {r.rewardTitle} — <span className="code">{r.code}</span>
              <div className="ib-hint" style={{ marginTop: 4 }}>
                {pick('أظهر الرقم للكاشير للاستلام', 'Show the code to the cashier to collect')}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="ib-loy-title">
        <Gift size={17} /> {pick('المكافآت المتاحة', 'Available rewards')}
      </div>
      <div className="ib-reward-grid">
        {rewards.map((r) => {
          const affordable = customer.pointsBalance >= r.costPoints
          return (
            <div className={`ib-reward${affordable ? '' : ' locked'}`} key={r.id}>
              <span className="emoji">{r.emoji}</span>
              <div className="meta">
                <div className="t">{lang === 'ar' ? r.titleAr : r.titleEn}</div>
                <div className="s">{lang === 'ar' ? r.titleEn : r.titleAr}</div>
                <div className="cost">
                  {r.costPoints.toLocaleString('en-US')} {pick('نقطة', 'points')}
                </div>
              </div>
              <button
                disabled={!affordable || redeeming === r.id}
                onClick={() => onRedeem(r.id, lang === 'ar' ? r.titleAr : r.titleEn)}
                type="button"
              >
                {redeeming === r.id
                  ? '…'
                  : affordable
                    ? pick('استبدل', 'Redeem')
                    : pick('ناقص', 'Not enough')}
              </button>
            </div>
          )
        })}
      </div>

      {redemptions.length > 0 && (
        <>
          <div className="ib-loy-title">
            <Receipt size={17} /> {pick('سجل الاستبدال', 'Redemption history')}
          </div>
          {redemptions.map((r) => (
            <HistoryRow key={r.id} r={r} />
          ))}
        </>
      )}

      <div className="ib-loy-title">
        <Receipt size={17} /> {pick('سجل النقاط', 'Points history')}
      </div>
      {transactions.length === 0 ? (
        <p className="ib-hint">{pick('لا توجد حركات بعد.', 'No activity yet.')}</p>
      ) : (
        transactions.map((t) => (
          <div className="ib-ledger-row" key={t.id}>
            <div>
              <div style={{ fontWeight: 800 }}>
                {t.reason || (lang === 'ar' ? LEDGER_LABEL[t.type] : LEDGER_LABEL_EN[t.type]) || t.type}
              </div>
              <div className="when">
                {formatDate(t.createdAt)}
                {t.staffName ? ` • ${t.staffName}` : ''}
              </div>
            </div>
            <div className={`pts ${t.points > 0 ? 'plus' : 'minus'}`}>
              {t.points > 0 ? '+' : ''}
              {t.points.toLocaleString('en-US')}
            </div>
          </div>
        ))
      )}

      <p className="ib-hint" style={{ marginTop: 18, textAlign: 'center' }}>
        {pick(
          `${settings.pointsPerSar} نقطة لكل ١ ريال • مكافأة الترحيب ${settings.welcomeBonus} نقطة`,
          `${settings.pointsPerSar} point per 1 SAR • ${settings.welcomeBonus} point welcome bonus`,
        )}
      </p>
    </>
  )
}

function HistoryRow({ r }: { r: RedemptionView }) {
  const { lang } = useI18n()
  const label: Record<string, string> = {
    pending: lang === 'ar' ? 'قيد الموافقة' : 'Pending',
    approved: lang === 'ar' ? 'تم التسليم' : 'Collected',
    rejected: lang === 'ar' ? 'مرفوض' : 'Rejected',
  }
  return (
    <div className="ib-ledger-row">
      <div>
        <div style={{ fontWeight: 800 }}>{r.rewardTitle}</div>
        <div className="when">
          <span style={{ direction: 'ltr', display: 'inline-block' }}>{r.code}</span> •{' '}
          {formatDate(r.createdAt)}
        </div>
      </div>
      <span className={`staff-badge ${r.status}`}>{label[r.status] ?? r.status}</span>
    </div>
  )
}
