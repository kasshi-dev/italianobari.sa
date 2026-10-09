// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Minus, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  formatDate,
  LEDGER_LABEL,
  staffApi,
  type CustomerView,
  type LedgerRow,
  type RedemptionView,
} from '@/lib/loyalty'
import { useStaffLang } from '@/lib/staffI18n'

interface Props {
  token: string
  customerId: string
  onBack: () => void
  onChanged: () => void
  onAuthLost: () => void
}

const QUICK_AMOUNTS = [50, 100, 200, 500]

const LEDGER_EN: Record<string, string> = {
  earn: 'Points earned',
  redeem: 'Redemption',
  refund: 'Refund',
  adjust: 'Adjustment',
  welcome: 'Welcome bonus',
}

export default function CustomerDetail({ token, customerId, onBack, onChanged, onAuthLost }: Props) {
  const { t, lang } = useStaffLang()
  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft

  const [customer, setCustomer] = useState<(CustomerView & { notes?: string | null }) | null>(null)
  const [transactions, setTransactions] = useState<LedgerRow[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [mode, setMode] = useState<'bill' | 'manual'>('bill')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [manualPoints, setManualPoints] = useState('')
  const [busy, setBusy] = useState(false)

  const ledgerName = (type: string) =>
    t((LEDGER_LABEL as Record<string, string>)[type] ?? type, LEDGER_EN[type] ?? type)

  const statusName = (status: string) =>
    status === 'pending'
      ? t('قيد الموافقة', 'Pending')
      : status === 'approved'
        ? t('تم التسليم', 'Delivered')
        : t('مرفوض', 'Rejected')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await staffApi.customer(token, customerId)
      setCustomer(res.customer)
      setTransactions(res.transactions)
      setRedemptions(res.redemptions)
      setError(null)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, customerId, onAuthLost])

  useEffect(() => {
    void load()
  }, [load])

  const submitPoints = async (payload: { amountSar?: number; points?: number }, label: string) => {
    setBusy(true)
    setError(null)
    setFlash(null)
    try {
      const res = await staffApi.addPoints(token, customerId, { ...payload, reason: reason || undefined })
      setCustomer(res.customer)
      setFlash(
        `${label} — ${t('الرصيد الآن', 'balance now')} ${res.customer.pointsBalance.toLocaleString('en-US')} ${t('نقطة', 'points')}`,
      )
      setAmount('')
      setManualPoints('')
      setReason('')
      await load()
      onChanged()
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      await staffApi.decide(token, id, decision)
      setFlash(
        decision === 'approve'
          ? t('تم تسليم المكافأة', 'Reward delivered')
          : t('تم رفض الطلب وإرجاع النقاط', 'Request rejected and points refunded'),
      )
      await load()
      onChanged()
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const pending = redemptions.filter((r) => r.status === 'pending')
  const sar = t('ريال', 'SAR')
  const pts = t('نقطة', 'points')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <BackIcon size={16} /> {t('رجوع', 'Back')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw size={15} /> {t('تحديث', 'Refresh')}
        </Button>
      </div>

      {error && <div className="ib-error">{error}</div>}
      {flash && (
        <div className="ib-pending" style={{ background: 'rgba(46,107,71,.12)', borderColor: 'var(--basil-2)' }}>
          {flash}
        </div>
      )}

      {loading && !customer ? (
        <div className="staff-card text-center py-10 text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
          <p className="mt-2 font-bold">{t('جاري التحميل…', 'Loading…')}</p>
        </div>
      ) : !customer ? (
        <div className="staff-card">{t('لم يتم العثور على العميل', 'Customer not found')}</div>
      ) : (
        <>
          <div className="staff-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="staff-avatar">{(customer.name || customer.phone).slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold">{customer.name || t('بدون اسم', 'No name')}</div>
                <div dir="ltr" className="text-left text-sm font-bold text-[var(--grey)]">
                  {customer.phone}
                </div>
              </div>
              <span className={`staff-badge ${customer.tier}`}>
                {customer.tierLabel.emoji} {t(customer.tierLabel.ar, customer.tierLabel.en)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">{t('النقاط المتاحة', 'Available points')}</div>
                <div className="text-2xl font-black text-[var(--basil)]">
                  {customer.pointsBalance.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">{t('نقاط العضوية', 'Lifetime points')}</div>
                <div className="text-2xl font-black text-[var(--basil)]">
                  {customer.lifetimePoints.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">{t('الزيارات', 'Visits')}</div>
                <div className="text-2xl font-black text-[var(--basil)]">{customer.visits}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">{t('عضو منذ', 'Member since')}</div>
                <div className="text-sm font-bold">{formatDate(customer.memberSince)}</div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ add / deduct */}
          <div className="staff-card">
            <div className="ib-toggle" style={{ maxWidth: 320 }}>
              <button className={mode === 'bill' ? 'on' : ''} onClick={() => setMode('bill')} type="button">
                {t('نقاط بفاتورة', 'From a bill')}
              </button>
              <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')} type="button">
                {t('نقاط يدوية', 'Manual points')}
              </button>
            </div>

            {mode === 'bill' ? (
              <>
                <label className="ib-field">
                  <span>{t('قيمة الفاتورة (ريال)', 'Bill amount (SAR)')}</span>
                  <Input
                    inputMode="decimal"
                    placeholder={t('مثال: 120', 'e.g. 120')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((a) => (
                    <Button
                      key={a}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        submitPoints(
                          { amountSar: a },
                          t(`تمت إضافة فاتورة ${a} ريال`, `Bill of ${a} SAR added`),
                        )
                      }
                      disabled={busy}
                    >
                      {a} {sar}
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={busy || !amount}
                  onClick={() =>
                    submitPoints(
                      { amountSar: Number(amount) },
                      t(`تمت إضافة فاتورة ${amount} ريال`, `Bill of ${amount} SAR added`),
                    )
                  }
                >
                  <Plus size={16} /> {t('احتساب النقاط', 'Add points')}
                </Button>
              </>
            ) : (
              <>
                <label className="ib-field">
                  <span>{t('عدد النقاط (سالب للخصم)', 'Points (negative to deduct)')}</span>
                  <Input
                    inputMode="numeric"
                    placeholder={t('مثال: 50 أو -20', 'e.g. 50 or -20')}
                    value={manualPoints}
                    onChange={(e) => setManualPoints(e.target.value.replace(/[^\d-]/g, ''))}
                  />
                </label>
                <Button
                  className="w-full"
                  disabled={busy || !manualPoints || Number(manualPoints) === 0}
                  onClick={() =>
                    submitPoints(
                      { points: Number(manualPoints) },
                      Number(manualPoints) > 0
                        ? t('تمت إضافة النقاط', 'Points added')
                        : t('تم خصم النقاط', 'Points deducted'),
                    )
                  }
                >
                  {Number(manualPoints) < 0 ? <Minus size={16} /> : <Plus size={16} />}
                  {t('تنفيذ', 'Apply')}
                </Button>
              </>
            )}

            <label className="ib-field mt-3 mb-0">
              <span>{t('السبب (اختياري)', 'Reason (optional)')}</span>
              <Input
                placeholder={t('مثال: فاتورة طاولة ٤', 'e.g. Table 4 bill')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>

          {/* ------------------------------------------------- redemptions */}
          {pending.length > 0 && (
            <div className="staff-card">
              <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
                {t('طلبات استبدال قيد الموافقة', 'Pending redemption requests')} ({pending.length})
              </div>
              {pending.map((r) => (
                <div key={r.id} className="ib-pending flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">{r.rewardTitle}</div>
                    <div className="hint" style={{ fontSize: 13 }}>
                      <span dir="ltr" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                        {r.code}
                      </span>{' '}
                      • {r.pointsCost} {pts} • {formatDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => decide(r.id, 'approve')}>
                      {t('تسليم المكافأة', 'Deliver reward')}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(r.id, 'reject')}>
                      {t('رفض', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------ ledger */}
          <div className="staff-card">
            <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
              {t('سجل النقاط', 'Points history')}
            </div>
            {transactions.length === 0 ? (
              <p className="ib-hint">{t('لا توجد حركات.', 'No transactions.')}</p>
            ) : (
              transactions.map((tx) => (
                <div className="ib-ledger-row" key={tx.id}>
                  <div>
                    <div className="font-extrabold">{tx.reason || ledgerName(tx.type)}</div>
                    <div className="when">
                      {formatDate(tx.createdAt)}
                      {tx.staffName ? ` • ${tx.staffName}` : ''} • {t('الرصيد', 'balance')} {tx.balanceAfter}
                    </div>
                  </div>
                  <div className={`pts ${tx.points > 0 ? 'plus' : 'minus'}`}>
                    {tx.points > 0 ? '+' : ''}
                    {tx.points.toLocaleString('en-US')}
                  </div>
                </div>
              ))
            )}
          </div>

          {redemptions.length > 0 && (
            <div className="staff-card">
              <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
                {t('سجل الاستبدال', 'Redemption history')}
              </div>
              {redemptions.map((r) => (
                <div className="ib-ledger-row" key={r.id}>
                  <div>
                    <div className="font-extrabold">{r.rewardTitle}</div>
                    <div className="when">
                      <span dir="ltr" style={{ fontFamily: 'monospace' }}>
                        {r.code}
                      </span>{' '}
                      • {formatDate(r.createdAt)}
                      {r.staffName ? ` • ${r.staffName}` : ''}
                    </div>
                  </div>
                  <span className={`staff-badge ${r.status}`}>{statusName(r.status)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
