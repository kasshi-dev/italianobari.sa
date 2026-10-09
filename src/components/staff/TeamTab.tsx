// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, Plus, Save, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ApiError, formatDate, staffApi, type SettingsView, type StaffView } from '@/lib/loyalty'
import { useStaffLang } from '@/lib/staffI18n'

interface Props {
  token: string
  me: StaffView
  onAuthLost: () => void
}

export default function TeamTab({ token, me, onAuthLost }: Props) {
  const { t } = useStaffLang()
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
      const [teamRes, settingsRes] = await Promise.all([staffApi.team(token), staffApi.settings(token)])
      setTeam(teamRes.team)
      setSettings(settingsRes.settings)
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

  const roleName = (role: string) => (role === 'admin' ? t('مدير', 'Admin') : t('موظف', 'Staff'))

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
          {t('إعدادات البرنامج', 'Program settings')}
        </div>
        {settings && (
          <SettingsForm
            settings={settings}
            disabled={!isAdmin || busy}
            onSave={(data) =>
              run(() => staffApi.updateSettings(token, data), t('تم حفظ الإعدادات', 'Settings saved'))
            }
          />
        )}
        {!isAdmin && (
          <p className="ib-hint mt-2">{t('التعديل متاح للمدير فقط.', 'Only an admin can edit these.')}</p>
        )}
      </div>

      {/* ----------------------------------------------------------- team */}
      <div className="staff-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="ib-loy-title" style={{ margin: 0 }}>
              {t('حسابات الموظفين', 'Staff accounts')}
            </div>
            <div className="ib-hint">
              {t('من يمكنه الدخول إلى لوحة التحكم', 'Who can sign in to the dashboard')}
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant={showAdd ? 'outline' : 'default'} onClick={() => setShowAdd((v) => !v)}>
              <UserPlus size={15} /> {showAdd ? t('إلغاء', 'Cancel') : t('موظف جديد', 'New staff')}
            </Button>
          )}
        </div>

        {showAdd && isAdmin && (
          <div className="mt-4 grid gap-3 border-t border-[rgba(30,68,48,.12)] pt-4 sm:grid-cols-2">
            <label className="ib-field mb-0">
              <span>{t('اسم المستخدم (إنجليزي)', 'Username (English)')}</span>
              <Input
                dir="ltr"
                value={newStaff.username}
                onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })}
              />
            </label>
            <label className="ib-field mb-0">
              <span>{t('الاسم', 'Name')}</span>
              <Input value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
            </label>
            <label className="ib-field mb-0">
              <span>{t('الرمز السري (4-6 أرقام)', 'PIN (4-6 digits)')}</span>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={newStaff.pin}
                onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </label>
            <label className="ib-field mb-0">
              <span>{t('الصلاحية', 'Role')}</span>
              <Select value={newStaff.role} onValueChange={(v) => setNewStaff({ ...newStaff, role: v })}>
                <SelectTrigger>{roleName(newStaff.role)}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">{t('موظف', 'Staff')}</SelectItem>
                  <SelectItem value="admin">{t('مدير', 'Admin')}</SelectItem>
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
                  }, t('تمت إضافة الموظف', 'Staff member added'))
                }
              >
                <Plus size={15} /> {t('إضافة', 'Add')}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {team.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-[rgba(30,68,48,.12)] p-3"
              style={{ opacity: m.active === false ? 0.55 : 1 }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="staff-avatar">{m.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">
                    {m.name}
                    {m.id === me.id && <span className="ib-hint"> {t('(أنت)', '(you)')}</span>}
                  </div>
                  <div dir="ltr" className="text-left text-xs font-bold text-[var(--grey)]">
                    @{m.username} • {roleName(m.role)}
                    {m.lastLogin ? ` • ${t('آخر دخول', 'last login')} ${formatDate(m.lastLogin)}` : ''}
                  </div>
                </div>
                {m.active === false && <span className="staff-badge rejected">{t('معطّل', 'Disabled')}</span>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPinFor(pinFor === m.id ? null : m.id)
                      setNewPin('')
                    }}
                  >
                    <KeyRound size={14} /> {t('الرمز', 'PIN')}
                  </Button>
                  {isAdmin && m.id !== me.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => staffApi.updateStaff(token, m.id, { active: m.active === false }),
                          m.active === false
                            ? t('تم تفعيل الحساب', 'Account enabled')
                            : t('تم تعطيل الحساب', 'Account disabled'),
                        )
                      }
                    >
                      {m.active === false ? t('تفعيل', 'Enable') : t('تعطيل', 'Disable')}
                    </Button>
                  )}
                </div>
              </div>

              {pinFor === m.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[rgba(30,68,48,.12)] pt-3">
                  <label className="ib-field mb-0">
                    <span>{t('رمز سري جديد', 'New PIN')}</span>
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
                      run(
                        async () => {
                          await staffApi.updateStaff(token, m.id, { pin: newPin })
                          setPinFor(null)
                          setNewPin('')
                        },
                        m.id === me.id
                          ? t('تم تغيير رمزك — سجّل الدخول من جديد', 'Your PIN was changed — please sign in again')
                          : t('تم تغيير الرمز السري', 'PIN changed'),
                      )
                    }
                  >
                    <Save size={15} /> {t('حفظ', 'Save')}
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
  const { t } = useStaffLang()
  const [pointsPerSar, setPointsPerSar] = useState(String(settings.pointsPerSar))
  const [silverMin, setSilverMin] = useState(String(settings.silverMin))
  const [goldMin, setGoldMin] = useState(String(settings.goldMin))
  const [welcomeBonus, setWelcomeBonus] = useState(String(settings.welcomeBonus))

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="ib-field mb-0">
        <span>{t('نقاط لكل ١ ريال', 'Points per 1 SAR')}</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={pointsPerSar}
          onChange={(e) => setPointsPerSar(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>{t('حد المستوى الفضي', 'Silver tier threshold')}</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={silverMin}
          onChange={(e) => setSilverMin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>{t('حد المستوى الذهبي', 'Gold tier threshold')}</span>
        <Input
          inputMode="numeric"
          disabled={disabled}
          value={goldMin}
          onChange={(e) => setGoldMin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <label className="ib-field mb-0">
        <span>{t('مكافأة الترحيب', 'Welcome bonus')}</span>
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
          <Save size={15} /> {t('حفظ الإعدادات', 'Save settings')}
        </Button>
      </div>
    </div>
  )
}
