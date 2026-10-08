// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError, formatDate, staffApi, type RedemptionView } from '@/lib/loyalty'

interface Props {
  token: string
  onAuthLost: () => void
  onCountChange: (pending: number) => void
  onOpenCustomer: (id: string) => void
}

const FILTERS = [
  { key: 'pending', label: 'قيد الموافقة' },
  { key: 'approved', label: 'تم التسليم' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'all', label: 'الكل' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الموافقة',
  approved: 'تم التسليم',
  rejected: 'مرفوض',
}

export default function RedemptionsTab({ token, onAuthLost, onCountChange, onOpenCustomer }: Props) {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState<RedemptionView[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(
    async (which: string) => {
      setLoading(true)
      try {
        const res = await staffApi.redemptions(token, which)
        setRows(res.redemptions)
        onCountChange(res.pendingCount)
        setError(null)
      } catch (e) {
        const err = e as ApiError
        if (err.status === 401) onAuthLost()
        else setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [token, onAuthLost, onCountChange],
  )

  useEffect(() => {
    void load(status)
  }, [load, status])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id)
    setError(null)
    setFlash(null)
    try {
      const res = await staffApi.decide(token, id, decision)
      setFlash(res.message)
      await load(status)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="staff-tabs" style={{ position: 'static', borderRadius: 999, border: 'none', padding: 0, background: 'transparent' }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={status === f.key ? 'on' : ''} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
        <button onClick={() => void load(status)}>
          <RefreshCw size={13} style={{ display: 'inline', marginInlineEnd: 4 }} />
          تحديث
        </button>
      </div>

      {error && <div className="ib-error">{error}</div>}
      {flash && (
        <div className="ib-pending" style={{ background: 'rgba(46,107,71,.12)', borderColor: 'var(--basil-2)' }}>
          {flash}
        </div>
      )}

      {loading ? (
        <div className="staff-card text-center py-10 text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
        </div>
      ) : rows.length === 0 ? (
        <div className="staff-card text-center py-8 text-[var(--grey)] font-bold">
          لا توجد طلبات في هذه القائمة
        </div>
      ) : (
        rows.map((r) => (
          <div className="staff-card" key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold">{r.rewardTitle}</div>
                <div className="mt-1 text-sm font-bold text-[var(--grey)]">
                  <span dir="ltr" style={{ fontFamily: 'monospace', letterSpacing: 2, color: 'var(--tomato)' }}>
                    {r.code}
                  </span>{' '}
                  • {r.pointsCost} نقطة
                </div>
                <div className="mt-1 text-xs font-bold text-[var(--grey)]">
                  {formatDate(r.createdAt)}
                  {r.staffName ? ` • بواسطة ${r.staffName}` : ''}
                </div>
              </div>
              <span className={`staff-badge ${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>

            {r.customer && (
              <button
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-[rgba(30,68,48,.12)] p-2 text-right hover:border-[var(--basil)]"
                onClick={() => onOpenCustomer(r.customer!.id)}
                type="button"
              >
                <span className="staff-avatar" style={{ width: 34, height: 34, fontSize: 14 }}>
                  {(r.customer.name || r.customer.phone).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">{r.customer.name || 'بدون اسم'}</span>
                  <span dir="ltr" className="block text-left text-xs font-bold text-[var(--grey)]">
                    {r.customer.phone}
                  </span>
                </span>
                <span className="text-xs font-black text-[var(--basil)]">
                  {r.customer.pointsBalance} نقطة
                </span>
              </button>
            )}

            {r.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy === r.id} onClick={() => decide(r.id, 'approve')}>
                  <Check size={16} /> تسليم المكافأة
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, 'reject')}
                >
                  <X size={16} /> رفض وإرجاع النقاط
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
