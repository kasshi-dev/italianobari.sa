// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, staffApi, type RewardView } from '@/lib/loyalty'

interface Props {
  token: string
  onAuthLost: () => void
}

const EMOJI_CHOICES = ['🍕', '🥗', '🥤', '🍝', '🥖', '🍰', '💸', '🎁', '☕']

export default function RewardsTab({ token, onAuthLost }: Props) {
  const [rewards, setRewards] = useState<RewardView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState({ titleAr: '', titleEn: '', costPoints: '', emoji: '🎁' })
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await staffApi.rewards(token)
      setRewards(res.rewards)
      setError(null)
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) onAuthLost()
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, onAuthLost])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError(null)
    setFlash(null)
    try {
      await fn()
      setFlash(message)
      await load()
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
      {error && <div className="ib-error">{error}</div>}
      {flash && (
        <div className="ib-pending" style={{ background: 'rgba(46,107,71,.12)', borderColor: 'var(--basil-2)' }}>
          {flash}
        </div>
      )}

      <div className="staff-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-extrabold">المكافآت</div>
            <div className="ib-hint">حدّد ما يمكن للعملاء استبدال نقاطهم به</div>
          </div>
          <Button size="sm" variant={showAdd ? 'outline' : 'default'} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X size={15} /> : <Plus size={15} />}
            {showAdd ? 'إلغاء' : 'مكافأة جديدة'}
          </Button>
        </div>

        {showAdd && (
          <div className="mt-4 grid gap-3 border-t border-[rgba(30,68,48,.12)] pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="ib-field mb-0">
                <span>الاسم بالعربي</span>
                <Input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} />
              </label>
              <label className="ib-field mb-0">
                <span>الاسم بالإنجليزي</span>
                <Input value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} />
              </label>
              <label className="ib-field mb-0">
                <span>عدد النقاط</span>
                <Input
                  inputMode="numeric"
                  value={draft.costPoints}
                  onChange={(e) => setDraft({ ...draft, costPoints: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <div className="ib-field mb-0">
                <span>الرمز</span>
                <div className="flex flex-wrap gap-1">
                  {EMOJI_CHOICES.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setDraft({ ...draft, emoji: em })}
                      className="rounded-lg border px-2 py-1 text-lg"
                      style={{
                        borderColor: draft.emoji === em ? 'var(--basil)' : 'rgba(30,68,48,.15)',
                        background: draft.emoji === em ? 'rgba(30,68,48,.08)' : '#fff',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              disabled={busy || !draft.titleAr || !draft.costPoints}
              onClick={() =>
                run(async () => {
                  await staffApi.createReward(token, {
                    titleAr: draft.titleAr,
                    titleEn: draft.titleEn || draft.titleAr,
                    costPoints: Number(draft.costPoints),
                    emoji: draft.emoji,
                  })
                  setDraft({ titleAr: '', titleEn: '', costPoints: '', emoji: '🎁' })
                  setShowAdd(false)
                }, 'تمت إضافة المكافأة')
              }
            >
              حفظ المكافأة
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="staff-card text-center py-10 text-[var(--grey)]">
          <Loader2 className="ib-spin mx-auto" />
        </div>
      ) : (
        rewards.map((r) => (
          <div className="staff-card" key={r.id} style={{ opacity: r.active === false ? 0.6 : 1 }}>
            {editing === r.id ? (
              <EditRow
                reward={r}
                token={token}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(data) =>
                  run(async () => {
                    await staffApi.updateReward(token, r.id, data)
                    setEditing(null)
                  }, 'تم تحديث المكافأة')
                }
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">
                    {r.titleAr}
                    {r.active === false && (
                      <span className="staff-badge rejected" style={{ marginInlineStart: 8 }}>
                        مخفية
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-[var(--grey)]">
                    {r.titleEn} • {r.costPoints} نقطة
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r.id)}>
                    <Pencil size={14} /> تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => staffApi.updateReward(token, r.id, { active: r.active === false }),
                        r.active === false ? 'تم تفعيل المكافأة' : 'تم إخفاء المكافأة',
                      )
                    }
                  >
                    {r.active === false ? 'تفعيل' : 'إخفاء'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(() => staffApi.deleteReward(token, r.id), 'تم حذف المكافأة')
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function EditRow({
  reward,
  busy,
  onCancel,
  onSave,
}: {
  reward: RewardView
  token: string
  busy: boolean
  onCancel: () => void
  onSave: (data: Partial<RewardView>) => void
}) {
  const [titleAr, setTitleAr] = useState(reward.titleAr)
  const [titleEn, setTitleEn] = useState(reward.titleEn)
  const [cost, setCost] = useState(String(reward.costPoints))
  const [emoji, setEmoji] = useState(reward.emoji)

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="ib-field mb-0">
          <span>الاسم بالعربي</span>
          <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </label>
        <label className="ib-field mb-0">
          <span>الاسم بالإنجليزي</span>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </label>
        <label className="ib-field mb-0">
          <span>النقاط</span>
          <Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {EMOJI_CHOICES.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => setEmoji(em)}
            className="rounded-lg border px-2 py-1 text-lg"
            style={{
              borderColor: emoji === em ? 'var(--basil)' : 'rgba(30,68,48,.15)',
              background: emoji === em ? 'rgba(30,68,48,.08)' : '#fff',
            }}
          >
            {em}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() => onSave({ titleAr, titleEn, costPoints: Number(cost), emoji })}
        >
          حفظ
        </Button>
        <Button variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}
