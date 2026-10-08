// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, Plus, Save, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ApiError, formatDate, staffApi, type SettingsView, type StaffView } from '@/lib/loyalty'

interface Props {
  token: string
  me: StaffView
  onAuthLost: () => void
}

export default function TeamTab({ token, me, onAuthLost }: Props) {
  const [team, setTeam] = useState<StaffView[]>([])
  const [settings, setSettings] = useState<(SettingsView & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [newStaff, setNewStaff] = useState({ username: '', name: '', pin: '', role: 'staff' })
  const [pinFor, setPinFor] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')

  const isAdmin = me.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([staffApi.team(token), staffApi.settings(token)])
      setTeam(t.team)
      setSettings(s.settings)
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

  if (loading) {
    return (
      <div className="staff-card text-center py-10 text-[var(--grey)]">
        <Loader2 className="ib-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="ib-error">{error}</div>}
      {flash && (
        <div className="ib-pending" style={{ background: 'rgba(46,107,71,.12)', borderColor: 'var(--basil-2)' }}>
          {flash}
        </div>
      )}

      {/* ------------------------------------------------------- settings */}
      <div className="staff-card">
        <div className="ib-loy-title" style={{ margin: '0 0 12px' }}>
          إعدادات البرنامج
        </div>
        {settings && (
          <SettingsForm
            settings={settings}
            disabled={!isAdmin || busy}
            onSave={(data) => run(() => staffApi.updateSettings(token, data), 'تم حفظ الإعدادات')}
          />
        )}
        {!isAdmin && <p className="ib-hint mt-2">التعديل متاح للمدير فقط.</p>}
      </div>

      {/* ----------------------------------------------------------- team */}
      <div className="staff-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="ib-loy-title" style={{ margin: 0 }}>
              حسابات الموظفين
            </div>
            <div className="ib-hint">من يمكنه الدخول إلى لوحة التحكم</div>
          </div>
          {isAdmin && (
            <Button size="sm" variant={showAdd ? 'outline' : 'default'} onClick={() => setShowAdd((v) => !v)}>
              <UserPlus size={15} /> {showAdd ? 'إلغاء' : 'موظف جديد'}
            </Button>
          )}
        </div>

        {showAdd && isAdmin && (
          <div className="mt-4 grid gap-3 border-t border-[rgba(30,68,48,.12)] pt-4 sm:grid-cols-2">
            <label className="ib-field mb-0">
              <span>اسم المستخدم (إنجليزي)</span>
              <Input
                dir="ltr"
                value={newStaff.username}
                onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })}
              />
            </label>
            <label className="ib-field mb-0">
              <span>الاسم</span>
              <Input value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
            </label>
            <label className="ib-field mb-0">
              <span>الرمز السري (4-6 أرقام)</span>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={newStaff.pin}
                onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </label>
            <label className="ib-field mb-0">
              <span>الصلاحية</span>
              <Select value={newStaff.role} onValueChange={(v) => setNewStaff({ ...newStaff, role: v })}>
                <SelectTrigger>{newStaff.role === 'admin' ? 'مدير' : 'موظف'}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">موظف</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="sm:col-span-2">
              <Button
                disabled={busy || !newStaff.username || !newStaff.pin}
                onClick={() =>
                  run(async () => {
                    await staffApi.createStaff(token, newStaff)
                    setNewStaff({ username: '', name: '', pin: '', role: 'staff' })
                    setShowAdd(false)
                  }, 'تمت إضافة الموظف')
                }
              >
                <Plus size={15} /> إضافة
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {team.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-[rgba(30,68,48,.12)] p-3"
              style={{ opacity: t.active === false ? 0.55 : 1 }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="staff-avatar">{t.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">
                    {t.name}
                    {t.id === me.id && <span className="ib-hint"> (أنت)</span>}
                  </div>
                  <div dir="ltr" className="text-left text-xs font-bold text-[var(--grey)]">
                    @{t.username} • {t.role === 'admin' ? 'مدير' : 'موظف'}
                    {t.lastLogin ? ` • آخر دخول ${formatDate(t.lastLogin)}` : ''}
                  </div>
                </div>
                {t.active === false && <span className="staff-badge rejected">معطّل</span>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPinFor(pinFor === t.id ? null : t.id)
                      setNewPin('')
                    }}
                  >
                    <KeyRound size={14} /> الرمز
                  </Button>
                  {isAdmin && t.id !== me.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => staffApi.updateStaff(token, t.id, { active: t.active === false }),
                          t.active === false ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
                        )
                      }
                    >
                      {t.active === false ? 'تفعيل' : 'تعطيل'}
                    </Button>
                  )}
                </div>
              </div>

              {pinFor === t.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[rgba(30,68,48,.12)] pt-3">
                  <label className="ib-field mb-0">
                    <span>رمز سري جديد</span>
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </label>
                  <Button
                    disabled={busy || !/^\d{4,6}$/.test(newPin)}
                    onClick={() =>
                      run(async () => {
                        await staffApi.updateStaff(token, t.id, { pin: newPin })
                        setPinFor(null)
                        setNewPin('')
                      }, t.id === me.id ? 'تم تغيير رمزك — سجّل الدخول من جديد' : 'تم تغيير الرمز السري')
                    }
                  >
                    <Save size={15} /> حفظ
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsForm({
  settings,
  disabled,
  onSave,
}: {
  settings: SettingsView & { id: string }
  disabled: boolean
  onSave: (data: Partial<SettingsView>) => void
}) {
  const [pointsPerSar, setPointsPerSar] = useState(String(settings.pointsPerSar))
  const [silverMin, setSilverMin] = useState(String(settings.silverMin))
  const [goldMin, setGoldMin] = useState(String(settings.goldMin))
  const [welcomeBonus, setWelcomeBonus] = useState(String(settings.welcomeBonus))

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="ib-field mb-0">
        <span>نقاط لكل ١ ريال</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={pointsPerSar}
          onChange={(e) => setPointsPerSar(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>حد المستوى الفضي</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={silverMin}
          onChange={(e) => setSilverMin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>حد المستوى الذهبي</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={goldMin}
          onChange={(e) => setGoldMin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>مكافأة الترحيب</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={welcomeBonus}
          onChange={(e) => setWelcomeBonus(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button
          disabled={disabled}
          onClick={() =>
            onSave({
              pointsPerSar: Number(pointsPerSar),
              silverMin: Number(silverMin),
              goldMin: Number(goldMin),
              welcomeBonus: Number(welcomeBonus),
            })
          }
        >
          <Save size={15} /> حفظ الإعدادات
        </Button>
      </div>
    </div>
  )
}
