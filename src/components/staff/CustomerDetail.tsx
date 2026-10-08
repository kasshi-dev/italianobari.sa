// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2, Minus, Plus, RefreshCw } from 'lucide-react'
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

interface Props {
  token: string
  customerId: string
  onBack: () => void
  onChanged: () => void
  onAuthLost: () => void
}

const QUICK_AMOUNTS = [50, 100, 200, 500]

export default function CustomerDetail({ token, customerId, onBack, onChanged, onAuthLost }: Props) {
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
      setFlash(`${label} — الرصيد الآن ${res.customer.pointsBalance.toLocaleString('en-US')} نقطة`)
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
      const res = await staffApi.decide(token, id, decision)
      setFlash(res.message)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowRight size={16} /> رجوع
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw size={15} /> تحديث
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
          <p className="mt-2 font-bold">جاري التحميل…</p>
        </div>
      ) : !customer ? (
        <div className="staff-card">لم يتم العثور على العميل</div>
      ) : (
        <>
          <div className="staff-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="staff-avatar">{(customer.name || customer.phone).slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold">{customer.name || 'بدون اسم'}</div>
                <div dir="ltr" className="text-left text-sm font-bold text-[var(--grey)]">
                  {customer.phone}
                </div>
              </div>
              <span className={`staff-badge ${customer.tier}`}>
                {customer.tierLabel.emoji} {customer.tierLabel.ar}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">النقاط المتاحة</div>
                <div className="text-2xl font-black text-[var(--basil)]">
                  {customer.pointsBalance.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">نقاط العضوية</div>
                <div className="text-2xl font-black text-[var(--basil)]">
                  {customer.lifetimePoints.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">الزيارات</div>
                <div className="text-2xl font-black text-[var(--basil)]">{customer.visits}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--grey)]">عضو منذ</div>
                <div className="text-sm font-bold">{formatDate(customer.memberSince)}</div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ add / deduct */}
          <div className="staff-card">
            <div className="ib-toggle" style={{ maxWidth: 320 }}>
              <button className={mode === 'bill' ? 'on' : ''} onClick={() => setMode('bill')} type="button">
                نقاط بفاتورة
              </button>
              <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')} type="button">
                نقاط يدوية
              </button>
            </div>

            {mode === 'bill' ? (
              <>
                <label className="ib-field">
                  <span>قيمة الفاتورة (ريال)</span>
                  <Input
                    inputMode="decimal"
                    placeholder="مثال: 120"
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
                      onClick={() => submitPoints({ amountSar: a }, `تمت إضافة فاتورة ${a} ريال`)}
                      disabled={busy}
                    >
                      {a} ريال
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={busy || !amount}
                  onClick={() => submitPoints({ amountSar: Number(amount) }, `تمت إضافة فاتورة ${amount} ريال`)}
                >
                  <Plus size={16} /> احتساب النقاط
                </Button>
              </>
            ) : (
              <>
                <label className="ib-field">
                  <span>عدد النقاط (سالب للخصم)</span>
                  <Input
                    inputMode="numeric"
                    placeholder="مثال: 50 أو -20"
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
                      Number(manualPoints) > 0 ? 'تمت إضافة النقاط' : 'تم خصم النقاط',
                    )
                  }
                >
                  {Number(manualPoints) < 0 ? <Minus size={16} /> : <Plus size={16} />}
                  تنفيذ
                </Button>
              </>
            )}

            <label className="ib-field mt-3 mb-0">
              <span>السبب (اختياري)</span>
              <Input
                placeholder="مثال: فاتورة طاولة ٤"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>

          {/* ------------------------------------------------- redemptions */}
          {pending.length > 0 && (
            <div className="staff-card">
              <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
                طلبات استبدال قيد الموافقة ({pending.length})
              </div>
              {pending.map((r) => (
                <div key={r.id} className="ib-pending flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">{r.rewardTitle}</div>
                    <div className="hint" style={{ fontSize: 13 }}>
                      <span dir="ltr" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                        {r.code}
                      </span>{' '}
                      • {r.pointsCost} نقطة • {formatDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => decide(r.id, 'approve')}>
                      تسليم المكافأة
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(r.id, 'reject')}>
                      رفض
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------ ledger */}
          <div className="staff-card">
            <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
              سجل النقاط
            </div>
            {transactions.length === 0 ? (
              <p className="ib-hint">لا توجد حركات.</p>
            ) : (
              transactions.map((t) => (
                <div className="ib-ledger-row" key={t.id}>
                  <div>
                    <div className="font-extrabold">{t.reason || LEDGER_LABEL[t.type] || t.type}</div>
                    <div className="when">
                      {formatDate(t.createdAt)}
                      {t.staffName ? ` • ${t.staffName}` : ''} • الرصيد {t.balanceAfter}
                    </div>
                  </div>
                  <div className={`pts ${t.points > 0 ? 'plus' : 'minus'}`}>
                    {t.points > 0 ? '+' : ''}
                    {t.points.toLocaleString('en-US')}
                  </div>
                </div>
              ))
            )}
          </div>

          {redemptions.length > 0 && (
            <div className="staff-card">
              <div className="ib-loy-title" style={{ margin: '0 0 10px' }}>
                سجل الاستبدال
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
                  <span className={`staff-badge ${r.status}`}>
                    {r.status === 'pending' ? 'قيد الموافقة' : r.status === 'approved' ? 'تم التسليم' : 'مرفوض'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
