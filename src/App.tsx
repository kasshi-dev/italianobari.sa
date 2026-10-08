// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react'
import MenuPage from '@/components/menu/MenuPage'
import LoyaltyPanel from '@/components/loyalty/LoyaltyPanel'
import StaffApp from '@/components/staff/StaffApp'
import { useLoyalty } from '@/components/loyalty/useLoyalty'
import { I18nProvider, useI18n } from '@/lib/i18n'
import '@/styles/menu.css'

/**
 * Two surfaces in one deploy:
 *   /            guest menu + loyalty card   (hash: anything not #/staff)
 *   /#/staff     staff dashboard
 *
 * Hash routing keeps the staff portal reachable on any static host without
 * needing a server-side SPA rewrite.
 */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}

function Shell() {
  const hash = useHashRoute()
  const { lang } = useI18n()
  const session = useLoyalty()
  const [panelOpen, setPanelOpen] = useState(false)

  const isStaffRoute = hash.startsWith('#/staff')

  useEffect(() => {
    if (hash === '#loyalty') setPanelOpen(true)
  }, [hash])

  useEffect(() => {
    document.title = isStaffRoute
      ? lang === 'ar'
        ? 'Italiano Bari — لوحة الموظفين'
        : 'Italiano Bari — Staff Dashboard'
      : lang === 'ar'
        ? 'Italiano Bari — القائمة والمكافآت'
        : 'Italiano Bari — Menu & Rewards'
    window.scrollTo({ top: 0 })
  }, [isStaffRoute, lang])

  if (isStaffRoute) return <StaffApp />

  return (
    <>
      <MenuPage session={session} onOpenLoyalty={() => setPanelOpen(true)} />
      <LoyaltyPanel open={panelOpen} onClose={() => setPanelOpen(false)} session={session} />
    </>
  )
}
